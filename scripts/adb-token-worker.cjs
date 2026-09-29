/**
 * AdsPx ADB Token Worker
 * Automatically creates and maintains a buffer pool of verified Google Share (share.google?q=...) tokens
 * via ADB automation on redroid (127.0.0.1:5555)
 */

const { execSync, spawnSync } = require("child_process");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:8000";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM";

const TARGET_DEVICE = process.env.ADB_DEVICE || "127.0.0.1:5555";
const MIN_AVAILABLE_TOKENS = parseInt(process.env.MIN_TOKENS || "10", 10);
const BATCH_GENERATE_COUNT = parseInt(process.env.BATCH_COUNT || "3", 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function log(msg, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[adb-token-worker ${timestamp}] ${msg}`, ...args);
}

function runAdb(cmd) {
  try {
    return execSync(`adb -s ${TARGET_DEVICE} ${cmd}`, {
      encoding: "utf-8",
      timeout: 15000,
    }).trim();
  } catch (err) {
    log(`ADB Error on '${cmd}':`, err.message);
    return null;
  }
}

function verifyGoogleTokenHttp(token) {
  return new Promise((resolve) => {
    const url = `https://www.google.com/share.google?q=${encodeURIComponent(token)}`;
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const loc = res.headers.location || "";
          const is301 = res.statusCode >= 300 && res.statusCode < 400;
          const bodyHasRedirect = body.includes("301 Moved") || body.includes("<A HREF=");
          const isError = loc.includes("share.google/error") || body.includes("share.google/error");
          if (!isError && (is301 || bodyHasRedirect || res.statusCode === 200)) {
            resolve({ valid: true, destination: loc });
          } else {
            resolve({ valid: false, error: "Unregistered or rejected by Google" });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ valid: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ valid: false, error: "Timeout" });
    });
  });
}

async function checkPoolHealth() {
  const { count, error } = await supabase
    .from("google_token_pool")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");

  if (error) {
    log("Error checking pool health:", error.message);
    return { available: 0 };
  }
  return { available: count || 0 };
}

async function insertToken(token) {
  const cleanToken = token.trim();
  const googleUrl = `https://www.google.com/share.google?q=${cleanToken}`;
  const shareGoogleUrl = `https://share.google/${cleanToken}`;

  const { data, error } = await supabase
    .from("google_token_pool")
    .upsert(
      {
        token: cleanToken,
        google_url: googleUrl,
        share_google_url: shareGoogleUrl,
        status: "available",
        verified_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    )
    .select()
    .single();

  if (error) {
    log("Error saving token to pool:", error.message);
    return false;
  }
  log(`Successfully added verified token to pool: ${cleanToken}`);
  return true;
}

async function generateTokenViaAdb(slotCode) {
  log(`Attempting ADB token generation for slot: ${slotCode}...`);
  const slotUrl = `https://adswapx.com/r/${slotCode}`;

  // Check device
  const state = runAdb("get-state");
  if (state !== "device") {
    log(`Device ${TARGET_DEVICE} not in 'device' state (got '${state}').`);
    return null;
  }

  // Clear clipboard
  runAdb("shell am broadcast -a clipper.clear 2>/dev/null");

  // Send ACTION_SEND or trigger browser share
  // 1. Wake screen and unlock
  runAdb("shell input keyevent 82 2>/dev/null"); // MENU / UNLOCK
  runAdb("shell input keyevent 3 2>/dev/null");  // HOME

  // 2. Open WebView / Browser with slot URL
  runAdb(
    `shell am start -a android.intent.action.VIEW -d "${slotUrl}" org.chromium.webview_shell/.WebViewBrowserActivity`
  );

  // Allow render
  await new Promise((r) => setTimeout(r, 2000));

  // 3. Trigger Share action via send intent
  runAdb(
    `shell am start -a android.intent.action.SEND -t "text/plain" --es "android.intent.extra.TEXT" "${slotUrl}"`
  );

  await new Promise((r) => setTimeout(r, 1500));

  // Extract from logcat or clipboard
  const logcat = runAdb("logcat -d -t 100") || "";
  if (logcat) {
    const match = logcat.match(/[?&]q=([a-zA-Z0-9_-]{8,64})/i) || logcat.match(/share\.google\/([a-zA-Z0-9_-]{8,64})/i);
    if (match && match[1]) {
      const extractedToken = match[1];
      log(`Captured token from logcat: ${extractedToken}`);
      const check = await verifyGoogleTokenHttp(extractedToken);
      if (check.valid) {
        return extractedToken;
      }
    }
  }

  // Dismiss share sheet
  runAdb("shell input keyevent 4"); // BACK
  runAdb("shell input keyevent 3"); // HOME

  return null;
}

async function runWorkerIteration() {
  const { available } = await checkPoolHealth();
  log(`Current available pool size: ${available} (Target min: ${MIN_AVAILABLE_TOKENS})`);

  if (available >= MIN_AVAILABLE_TOKENS) {
    log("Pool has sufficient tokens. Sleeping.");
    return;
  }

  const needed = Math.min(MIN_AVAILABLE_TOKENS - available, BATCH_GENERATE_COUNT);
  log(`Generating ${needed} new tokens via ADB to refill pool...`);

  for (let i = 0; i < needed; i++) {
    const randomSlot = "g" + Math.random().toString(36).substring(2, 8);
    const token = await generateTokenViaAdb(randomSlot);
    if (token) {
      await insertToken(token);
    } else {
      log(`Failed to generate token for attempt ${i + 1}/${needed}.`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  log("Starting AdsPx ADB Token Worker...");
  const isDaemon = process.argv.includes("--daemon");

  if (isDaemon) {
    log("Running in continuous daemon mode (poll interval: 60s)");
    while (true) {
      try {
        await runWorkerIteration();
      } catch (err) {
        log("Iteration error:", err.message);
      }
      await new Promise((r) => setTimeout(r, 60000));
    }
  } else {
    log("Running single pass iteration...");
    await runWorkerIteration();
    log("Pass completed. Exiting.");
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Worker fatal:", err);
    process.exit(1);
  });
}

module.exports = {
  checkPoolHealth,
  verifyGoogleTokenHttp,
  insertToken,
  runWorkerIteration,
};
