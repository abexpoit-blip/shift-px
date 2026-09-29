const { execSync } = require("child_process");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

const ADB_BIN = "C:\\LDPlayer\\LDPlayer14\\adb.exe";
const DEVICE = "emulator-5558";

const SUPABASE_URL = "https://adswapx.com";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function log(msg, ...args) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${msg}`, ...args);
}

function adb(cmd) {
  try {
    return execSync(`"${ADB_BIN}" -s ${DEVICE} ${cmd}`, {
      encoding: "utf-8",
      timeout: 10000,
    }).trim();
  } catch (err) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyGoogleToken(token) {
  return new Promise((resolve) => {
    const url = `https://www.google.com/share.google?q=${token}`;
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          timeout: 8000,
        },
        (res) => {
          const loc = res.headers.location || "";
          const isError = loc.includes("share.google/error");
          if (!isError && res.statusCode >= 300 && res.statusCode < 400) {
            resolve({ valid: true, destination: loc, status: res.statusCode });
          } else {
            resolve({ valid: false, error: `Status ${res.statusCode}, loc: ${loc}` });
          }
        }
      )
      .on("error", (e) => resolve({ valid: false, error: e.message }));
  });
}

async function captureOneToken(useItem2 = false) {
  adb("logcat -c");

  const yDot = useItem2 ? 675 : 355;
  log(`Tapping 3-dots on result ${useItem2 ? "2" : "1"} at (505, ${yDot})...`);
  adb(`shell input tap 505 ${yDot}`);
  await sleep(1800);

  log("Tapping Share button at (83, 347)...");
  adb("shell input tap 83 347");
  await sleep(1800);

  log("Tapping 'Copy Link' (Share Catcher) at (333, 730)...");
  adb("shell input tap 333 730");
  await sleep(1200);

  // Read logcat
  const logs = adb("logcat -d -t 60") || "";
  const match = logs.match(/SHARE_CATCHER:\s*CAPTURED_LINK:\s*([^\r\n]+)/);

  // Clean dismissal
  adb("shell input keyevent 4"); // dismiss Share Catcher activity
  await sleep(600);
  adb("shell input tap 495 75"); // tap X button on bottom sheet
  await sleep(800);

  if (match && match[1]) {
    const rawLink = match[1].trim();
    const tokenMatch =
      rawLink.match(/[?&]q=([a-zA-Z0-9_-]+)/) ||
      rawLink.match(/share\.google\/([a-zA-Z0-9_-]+)/);
    if (tokenMatch && tokenMatch[1]) {
      return tokenMatch[1];
    }
  }
  return null;
}

async function run() {
  console.log("=".repeat(65));
  console.log("  AdsPx 5-Token Live Accurate Harvester (Target: dovtv.com)");
  console.log("=".repeat(65));

  // Check current tokens in DB
  const { data: existing } = await sb
    .from("google_token_pool")
    .select("token, google_url, status");

  const poolTokens = new Set((existing || []).map((t) => t.token));
  log(`Found ${poolTokens.size} valid tokens currently in pool.`);

  let toggle = false;
  let attempts = 0;

  while (poolTokens.size < 5 && attempts < 15) {
    attempts++;
    log(`\n>>> Need ${5 - poolTokens.size} more tokens (Attempt ${attempts}) <<<`);

    const token = await captureOneToken(toggle);
    toggle = !toggle; // alternate between result 1 and 2

    if (!token) {
      log("⚠️ Failed to capture link. Resetting UI...");
      adb("shell input keyevent 4");
      adb("shell input tap 495 75");
      await sleep(1000);
      continue;
    }

    if (poolTokens.has(token)) {
      log(`⚠️ Duplicate token already in pool: ${token}`);
      continue;
    }

    log(`🎯 Captured Token: ${token}`);
    log("Verifying token with Google 301 redirection...");
    const check = await verifyGoogleToken(token);

    if (!check.valid) {
      log(`❌ Verification failed: ${check.error}`);
      continue;
    }

    if (!check.destination.includes("dovtv.com")) {
      log(`❌ Not pointing to dovtv.com: ${check.destination}`);
      continue;
    }

    log(`✅ 100% VERIFIED! Target: ${check.destination}`);

    // Insert into Supabase
    const { error: insErr } = await sb.from("google_token_pool").upsert({
      token,
      google_url: `https://www.google.com/share.google?q=${token}`,
      share_google_url: `https://share.google/${token}`,
      status: "available",
      verified_at: new Date().toISOString(),
    });

    if (insErr) {
      log(`⚠️ Supabase error: ${insErr.message}`);
    } else {
      poolTokens.add(token);
      log(`💾 Token stored in Supabase! Total in pool: ${poolTokens.size}/5`);
    }

    await sleep(1000);
  }

  // Fetch final list of 5 tokens
  const { data: finalPool } = await sb
    .from("google_token_pool")
    .select("token, google_url, share_google_url, status, verified_at");

  console.log("\n" + "=".repeat(65));
  console.log(` Pool Complete! Total Tokens in Database: ${finalPool.length}`);
  console.log("=".repeat(65));
  console.table(finalPool);
}

run();
