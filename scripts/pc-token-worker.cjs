/**
 * AdsPx PC Token Worker & Buffer Pool Synchronizer
 * Automated Google Token Minting Engine via LDPlayer Emulator
 * Directly pairs pre-minted custom query tokens (https://dovtv.com/?p=CODE)
 * and syncs them into the AdsPx token pool API.
 */

const { execSync } = require("child_process");
const https = require("https");
const http = require("http");
const fs = require("fs");

const API_ENDPOINT = process.env.TOKEN_API_URL || "https://adspx.com/api/public/token-pool";

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

function runAdb(device, cmd, timeout = 10000) {
  try {
    const fullCmd = `"${ADB_BIN}" ${device ? `-s ${device}` : ""} ${cmd}`;
    return execSync(fullCmd, { encoding: "utf-8", timeout }).trim();
  } catch (err) {
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
      if (parts[1] === "device") {
        return parts[0];
      }
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
        timeout: 10000,
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
    if (res.status === 200 && res.data && typeof res.data.available === "number") {
      return res.data.available;
    }
    return null;
  } catch (err) {
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

async function mintOneToken(device) {
  const shortCode = generateRandomCode(7);
  const targetUrl = `https://dovtv.com/?p=${shortCode}`;
  log(`\n--------------------------------------------------`);
  log(`🔹 Preparing target: ${targetUrl}`);

  // Step 1: Clean slate — close any open custom tabs or dialogs
  runAdb(device, "shell input keyevent 4");
  await sleep(200);
  runAdb(device, "shell input keyevent 4");
  await sleep(300);

  // Clear logcat so we only catch this transaction
  runAdb(device, "logcat -c");

  // Step 2: Open SearchActivity
  runAdb(device, "shell am start -n com.google.android.googlequicksearchbox/.SearchActivity");
  await sleep(1200);

  // Step 3: Tap search input / pill
  runAdb(device, "shell input tap 270 300");
  await sleep(500);

  // Step 4: Type URL into search input
  const escaped = targetUrl.replace(":", "\\:").replace("?", "\\?").replace("=", "\\=");
  runAdb(device, `shell input text "${escaped}"`);
  await sleep(500);

  // Step 5: Press Enter (KEYCODE_ENTER = 66)
  runAdb(device, "shell input keyevent 66");
  log(`⏳ Loading Custom Tab in Google App (waiting 3.5s)...`);
  await sleep(3500);

  // Step 6: Tap Share Icon at top right (x=370, y=75)
  runAdb(device, "shell input tap 370 75");
  await sleep(1500);

  // Step 7: Tap 'Copy Link' (Share Catcher) at (x=207, y=610)
  runAdb(device, "shell input tap 207 610");
  await sleep(1500);

  // Step 8: Read captured token from logcat
  const logs = runAdb(device, "logcat -d -t 60") || "";
  const match = logs.match(/SHARE_CATCHER:\s+CAPTURED_LINK:\s+.*?(https:\/\/share\.google\/[a-zA-Z0-9_-]+)/);
  let capturedTokenUrl = match ? match[1] : null;

  if (!capturedTokenUrl) {
    const rawMatch = logs.match(/(https:\/\/share\.google\/[a-zA-Z0-9_-]+)/);
    if (rawMatch) capturedTokenUrl = rawMatch[1];
  }

  // Step 9: Clean close — send back keys to close the tab and return to fresh search state
  runAdb(device, "shell input keyevent 4");
  await sleep(200);
  runAdb(device, "shell input keyevent 4");
  await sleep(200);

  if (!capturedTokenUrl) {
    log(`❌ Failed to capture token for ${shortCode}`);
    return null;
  }

  const tokenOnly = capturedTokenUrl.replace(/^https?:\/\/share\.google\//i, "").trim();
  log(`🎯 Minted Google Token: ${capturedTokenUrl}`);
  log(`🔗 Destination mapped: https://dovtv.com/?p=${shortCode}`);

  return {
    token: tokenOnly,
    short_code: shortCode,
    google_url: `https://www.google.com/share.google?q=${tokenOnly}`,
    share_google_url: capturedTokenUrl,
  };
}

async function main() {
  console.log("==================================================");
  console.log("   🚀 AdsPx Automated Google Token Worker (v2.0)  ");
  console.log("==================================================");

  const device = getActiveDevice();
  if (!device) {
    console.error("❌ No active LDPlayer emulator detected.");
    console.error("👉 Please start LDPlayer and try again!");
    process.exit(1);
  }
  log(`📱 Connected to Android Device: ${device}`);

  const stockBefore = await checkPoolStock();
  log(`📦 Current Pool Stock on Server: ${stockBefore !== null ? stockBefore : "Checking..."} Available`);

  const args = process.argv.slice(2);
  const countIdx = args.indexOf("--count");
  const targetCount = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 5;

  log(`Target tokens to mint: ${targetCount}`);
  let successful = 0;

  for (let i = 0; i < targetCount; i++) {
    log(`\n[Round ${i + 1}/${targetCount}]`);
    const minted = await mintOneToken(device);
    if (minted) {
      log(`📡 Syncing token to AdsPx API...`);
      const syncResult = await submitTokenToApi(minted);
      if (syncResult.ok) {
        successful++;
        log(`✅ Saved to Pool! Live Available Stock: ${syncResult.total}`);
      } else {
        log(`⚠️ Failed to sync token to API: ${syncResult.error}`);
      }
    } else {
      // If stuck, perform a force-stop to guarantee recovery
      log(`🔄 Recovering Google App...`);
      runAdb(device, "shell am force-stop com.google.android.googlequicksearchbox");
      await sleep(1000);
    }
    await sleep(1500);
  }

  console.log("\n==================================================");
  const stockAfter = await checkPoolStock();
  log(`🏁 Batch Complete: ${successful}/${targetCount} tokens minted & synced.`);
  log(`🎉 Current Server Pool Stock: ${stockAfter !== null ? stockAfter : "OK"} Available`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal Worker Error:", err);
  process.exit(1);
});
