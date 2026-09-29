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

async function captureOneToken() {
  adb("logcat -c");

  // Step 1: Tap 3 dots on the first result
  log("Step 1: Tapping 3 dots on result 1 at (505, 355)...");
  adb("shell input tap 505 355");
  await sleep(1500);

  // Step 2: Tap Share pill at (83, 347)
  log("Step 2: Tapping Share pill at (83, 347)...");
  adb("shell input tap 83 347");
  await sleep(1500);

  // Step 3: Tap 'Copy Link' (com.adspx.sharecatcher) at (333, 730)
  log("Step 3: Tapping 'Copy Link' (Share Catcher) at (333, 730)...");
  adb("shell input tap 333 730");
  await sleep(1200);

  // Step 4: Extract link from logcat
  const logs = adb("logcat -d -t 60") || "";
  const match = logs.match(/SHARE_CATCHER:\s*CAPTURED_LINK:\s*([^\r\n]+)/);

  // Step 5: Cleanly close current page / sheet / activity before 2nd or next attempt
  log("Step 5: Closing dialogs and returning cleanly to search results...");
  adb("shell input keyevent 4"); // dismiss Share Catcher activity
  await sleep(600);
  adb("shell input tap 495 75"); // tap X button on bottom sheet
  await sleep(600);
  adb("shell input keyevent 4"); // safety back
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
  console.log("  AdsPx 5-Token Live Harvester (Target: dovtv.com)");
  console.log("=".repeat(65));

  const { data: existing } = await sb
    .from("google_token_pool")
    .select("token, google_url, status");

  const pool = new Set((existing || []).map((x) => x.token));
  log(`Current valid tokens in pool: ${pool.size}/5`);

  let attempts = 0;
  while (pool.size < 5 && attempts < 10) {
    attempts++;
    log(`\n>>> Harvesting Token ${pool.size + 1} of 5 (Attempt ${attempts}) <<<`);

    const token = await captureOneToken();

    if (!token) {
      log("⚠️ Failed to capture link from logcat. Retrying...");
      // Clean reset
      adb("shell input keyevent 4");
      adb("shell input tap 495 75");
      await sleep(1000);
      continue;
    }

    if (pool.has(token)) {
      log(`⚠️ Duplicate token already captured: ${token}. Waiting for fresh generation...`);
      await sleep(1500);
      continue;
    }

    log(`🎯 Captured Token: ${token}`);
    log("Verifying token redirection with Google...");
    const check = await verifyGoogleToken(token);

    if (!check.valid) {
      log(`❌ Verification failed: ${check.error}`);
      continue;
    }

    if (!check.destination.includes("dovtv.com")) {
      log(`❌ Target is not dovtv.com: ${check.destination}`);
      continue;
    }

    log(`✅ 100% VERIFIED TARGET: ${check.destination}`);

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
      pool.add(token);
      log(`💾 Token saved to Supabase! Current Pool Size: ${pool.size}/5`);
    }

    // Small delay before next attempt
    await sleep(1500);
  }

  // Display final pool
  const { data: finalPool } = await sb
    .from("google_token_pool")
    .select("token, google_url, share_google_url, status, verified_at");

  console.log("\n" + "=".repeat(65));
  console.log(` Pool Complete! Total Tokens in Database: ${finalPool.length}/5`);
  console.log("=".repeat(65));
  console.table(finalPool);
}

run();
