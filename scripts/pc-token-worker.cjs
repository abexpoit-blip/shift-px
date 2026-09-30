/**
 * AdsPx PC Token Worker & Buffer Pool Synchronizer
 * Automated Google Token Minting Engine via LDPlayer Emulator
 *
 * Strategy: WEB_SEARCH intent → loads Custom Tab directly inside Google App
 * No typing, no coordinate clicks on search bar → zero misclick, 100% accurate
 */

const { execSync } = require("child_process");
const https = require("https");
const http = require("http");
const fs = require("fs");

const API_ENDPOINT =
  process.env.TOKEN_API_URL || "https://adspx.com/api/public/token-pool";

// ─── ADB ─────────────────────────────────────────────────────────────────────

function findAdbPath() {
  const candidates = [
    "C:\\LDPlayer\\LDPlayer14\\adb.exe",
    "C:\\LDPlayer\\Blue LDPlayer9 Magisk\\adb.exe",
    "adb.exe",
    "adb",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return "C:\\LDPlayer\\LDPlayer14\\adb.exe";
}

const ADB_BIN = findAdbPath();

function log(msg, ...args) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${msg}`, ...args);
}

function runAdb(device, cmd, timeout = 12000) {
  try {
    const fullCmd = `"${ADB_BIN}" ${device ? `-s ${device}` : ""} ${cmd}`;
    return execSync(fullCmd, { encoding: "utf-8", timeout }).trim();
  } catch {
    return null;
  }
}

function getActiveDevice() {
  try {
    const out = execSync(`"${ADB_BIN}" devices`, { encoding: "utf-8" });
    const lines = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("List of"));
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts[1] === "device") return parts[0];
    }
  } catch {}
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function generateRandomCode(length = 7) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let res = "";
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiRequest(urlStr, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(
      parsed,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 12000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function checkPoolStock() {
  try {
    const res = await apiRequest(API_ENDPOINT, "GET");
    if (
      res.status === 200 &&
      res.data &&
      typeof res.data.available === "number"
    ) {
      return res.data.available;
    }
    return null;
  } catch {
    return null;
  }
}

async function submitTokenToApi(tokenData) {
  try {
    const res = await apiRequest(API_ENDPOINT, "POST", tokenData);
    if (res.status === 200 && res.data && res.data.success) {
      return { ok: true, total: res.data.total_available };
    }
    return { ok: false, error: res.data?.error || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── CORE MINT ────────────────────────────────────────────────────────────────

/**
 * Mints ONE Google share token for a given dovtv short code.
 *
 * Flow (zero search-bar clicks):
 *  1. Force-stop Google App & Chrome → clean slate
 *  2. Clear logcat buffer
 *  3. Fire WEB_SEARCH intent → Google App opens Custom Tab directly with URL loaded
 *  4. Tap Share icon at (370, 75)
 *  5. Tap "Copy Link" at (207, 610) → Share Catcher captures share.google token
 *  6. Read logcat for SHARE_CATCHER pattern
 *  7. Close Custom Tab via back arrow at (65, 80)
 *  8. Force-stop Google App → clean for next round
 */
async function mintOneToken(device) {
  const shortCode = generateRandomCode(7);
  const targetUrl = `https://dovtv.com/?p=${shortCode}`;

  log(`\n--------------------------------------------------`);
  log(`🔹 Target: ${targetUrl}`);

  // ── Step 1: Force stop both apps for a completely clean state ──
  log(`🧹 Force-stopping Google App & Chrome...`);
  runAdb(device, "shell am force-stop com.google.android.googlequicksearchbox");
  await sleep(500);
  runAdb(device, "shell am force-stop com.android.chrome");
  await sleep(400);

  // ── Step 2: Clear logcat buffer ──
  runAdb(device, "logcat -c");
  await sleep(200);

  // ── Step 3: Launch Custom Tab via WEB_SEARCH intent ──
  // This fires the URL directly into Google App — NO typing, NO search bar tapping
  log(`🌐 Opening URL via WEB_SEARCH intent...`);
  runAdb(
    device,
    `shell am start -a android.intent.action.WEB_SEARCH --es query "${targetUrl}"`
  );
  log(`⏳ Waiting for Custom Tab to fully load (6s)...`);
  await sleep(6000);

  // ── Step 4: Tap Share icon (top-right area of Custom Tab) ──
  log(`📤 Tapping Share icon at (370, 78)...`);
  runAdb(device, "shell input tap 370 78");
  await sleep(2200); // wait for share sheet to fully appear

  // ── Step 5: Tap "Copy Link" in share sheet ──
  log(`📋 Tapping Copy Link at (207, 605)...`);
  runAdb(device, "shell input tap 207 605");
  await sleep(2800); // wait for Share Catcher to receive and log the link

  // ── Step 6: Read captured token from logcat using on-device grep ──
  // Filter on-device so buffer size doesn't matter
  const shareLogs =
    runAdb(device, `shell logcat -d "*:S SHARE_CATCHER:I"`, 10000) || "";
  // Also read full buffer as fallback
  const allLogs = runAdb(device, `shell logcat -d -b main`, 10000) || "";

  let capturedTokenUrl = null;

  // Primary: SHARE_CATCHER tagged line
  const primaryMatch = shareLogs.match(
    /SHARE_CATCHER.*?(https:\/\/share\.google\/[a-zA-Z0-9_-]+)/
  );
  if (primaryMatch) {
    capturedTokenUrl = primaryMatch[1];
    log(`✅ SHARE_CATCHER captured: ${capturedTokenUrl}`);
  } else {
    // Fallback: any share.google URL in full logcat
    const fallbackMatch = allLogs.match(
      /(https:\/\/share\.google\/[a-zA-Z0-9_-]+)/
    );
    if (fallbackMatch) {
      capturedTokenUrl = fallbackMatch[1];
      log(`✅ Logcat fallback captured: ${capturedTokenUrl}`);
    }
  }

  // ── Step 7: Close the Custom Tab ──
  log(`🔙 Closing Custom Tab...`);
  runAdb(device, "shell input tap 65 80"); // back/close arrow (top-left)
  await sleep(700);

  // ── Step 8: Force-stop Google App for 100% clean next round ──
  log(`🧹 Force-stopping Google App for clean next round...`);
  runAdb(device, "shell am force-stop com.google.android.googlequicksearchbox");
  await sleep(500);

  if (!capturedTokenUrl) {
    log(`❌ Token capture FAILED for short code: ${shortCode}`);
    log(`   (logcat had no share.google URL — did share sheet open?)`);
    return null;
  }

  const tokenOnly = capturedTokenUrl
    .replace(/^https?:\/\/share\.google\//i, "")
    .trim();

  log(`🎯 Token:   ${capturedTokenUrl}`);
  log(`🔗 Mapped:  https://dovtv.com/?p=${shortCode}`);

  return {
    token: tokenOnly,
    short_code: shortCode,
    google_url: `https://www.google.com/share.google?q=${tokenOnly}`,
    share_google_url: capturedTokenUrl,
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("==================================================");
  console.log("   🚀 AdsPx Automated Google Token Worker (v3.0)  ");
  console.log("   Strategy: WEB_SEARCH Intent — Zero Misclick    ");
  console.log("==================================================");

  const device = getActiveDevice();
  if (!device) {
    console.error("❌ No active LDPlayer emulator detected.");
    console.error("👉 Please start LDPlayer and try again!");
    process.exit(1);
  }
  log(`📱 Connected to Android Device: ${device}`);

  const stockBefore = await checkPoolStock();
  log(
    `📦 Current Server Pool Stock: ${
      stockBefore !== null ? stockBefore : "Unknown"
    } available`
  );

  const args = process.argv.slice(2);
  const countIdx = args.indexOf("--count");
  const targetCount =
    countIdx !== -1 ? parseInt(args[countIdx + 1], 10) || 5 : 5;

  log(`🎯 Tokens to mint this session: ${targetCount}`);
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < targetCount; i++) {
    log(`\n[Round ${i + 1} / ${targetCount}]`);
    const minted = await mintOneToken(device);

    if (minted) {
      log(`📡 Syncing token to AdsPx API...`);
      const syncResult = await submitTokenToApi(minted);
      if (syncResult.ok) {
        successful++;
        log(`✅ Saved! Server pool now has ${syncResult.total} tokens.`);
      } else {
        log(`⚠️  API sync failed: ${syncResult.error}`);
        failed++;
      }
    } else {
      failed++;
      log(`⚠️  Skipping round — will retry on next run`);
    }

    // Brief pause between rounds
    if (i < targetCount - 1) {
      await sleep(2000);
    }
  }

  console.log("\n==================================================");
  const stockAfter = await checkPoolStock();
  log(`🏁 Done: ${successful} minted, ${failed} failed.`);
  log(
    `🎉 Server Pool Stock: ${
      stockAfter !== null ? stockAfter : "OK"
    } available`
  );
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal Worker Error:", err);
  process.exit(1);
});
