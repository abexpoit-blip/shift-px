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
    https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        timeout: 6000,
      },
      (res) => {
        const loc = res.headers.location || "";
        const isError = loc.includes("share.google/error");
        if (!isError && res.statusCode >= 300 && res.statusCode < 400) {
          resolve({ valid: true, destination: loc });
        } else {
          resolve({ valid: false, error: "Not redirecting or error: " + loc });
        }
      }
    ).on("error", (e) => resolve({ valid: false, error: e.message }));
  });
}

async function captureOneToken(yDots) {
  // Clear logcat
  adb("logcat -c");

  // Step 1: Tap 3 dots
  log(`Tapping 3 dots at (535, ${yDots})...`);
  adb(`shell input tap 535 ${yDots}`);
  await sleep(1500);

  // Step 2: Tap Share pill at (85, 360)
  log("Tapping Share pill at (85, 360)...");
  adb("shell input tap 85 360");
  await sleep(1500);

  // Step 3: Tap Copy Link at (200, 760)
  log("Tapping Copy Link icon at (200, 760)...");
  adb("shell input tap 200 760");
  await sleep(1200);

  // Step 4: Extract from logcat
  const logs = adb("logcat -d -t 60") || "";
  const match = logs.match(/SHARE_CATCHER:\s*CAPTURED_LINK:\s*([^\r\n]+)/);

  // Step 5: Clean reset to search page
  // Tap back to dismiss Share Catcher
  adb("shell input keyevent 4");
  await sleep(600);
  // Tap X button at (495, 75) to dismiss bottom sheet
  adb("shell input tap 495 75");
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

async function main() {
  console.log("=".repeat(60));
  console.log("  AdsPx 5-Token Live Generation Batch");
  console.log("=".repeat(60));

  const validTokens = [];
  const yCoords = [235, 555]; // First 2 results on current view

  for (let i = 0; i < 5; i++) {
    log(`\n>>> Generating Token ${validTokens.length + 1} of 5 <<<`);

    if (i >= 2 && i % 2 === 0) {
      log("Scrolling down to reveal next search results...");
      adb("shell input swipe 270 750 270 350 250");
      await sleep(1500);
    }

    const y = yCoords[i % yCoords.length];
    const token = await captureOneToken(y);

    if (!token) {
      log(`⚠️ Could not capture token on attempt ${i + 1}`);
      // In case sheet is still open, hit X and back
      adb("shell input tap 495 75");
      adb("shell input keyevent 4");
      await sleep(600);
      continue;
    }

    log(`🎯 Captured Token: ${token}`);
    log(`Verifying redirect path with Google...`);
    const check = await verifyGoogleToken(token);

    if (!check.valid) {
      log(`❌ Verification failed: ${check.error}`);
      continue;
    }

    log(`✅ Verified! Google 301 Target: ${check.destination}`);

    // Insert into Supabase Pool
    const { error: insErr } = await sb.from("google_token_pool").upsert({
      token,
      google_url: `https://www.google.com/share.google?q=${token}`,
      share_google_url: `https://share.google/${token}`,
      status: "available",
      verified_at: new Date().toISOString(),
    });

    if (insErr) {
      log(`⚠️ DB Error: ${insErr.message}`);
    } else {
      validTokens.push({ token, destination: check.destination });
      log(`🌟 Token #${validTokens.length} successfully saved to DB pool!`);
    }

    if (validTokens.length >= 5) break;
    await sleep(1000);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  BATCH COMPLETE: ${validTokens.length} TOKENS IN POOL`);
  console.log("=".repeat(60));
  validTokens.forEach((vt, idx) => {
    console.log(`  [${idx + 1}] Token: ${vt.token}`);
    console.log(`      Google URL : https://www.google.com/share.google?q=${vt.token}`);
    console.log(`      Target Site: ${vt.destination}`);
  });
  console.log("=".repeat(60));
}

main().catch(console.error);
