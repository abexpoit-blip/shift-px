/**
 * AdsPx PC Token Worker & Buffer Pool Synchronizer
 * Connects directly to local LDPlayer Emulator (emulator-5556) via ADB
 * and syncs verified Google Share tokens directly into the VPS Database (google_token_pool).
 */

const { execSync } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");

const SUPABASE_REST_URL =
  process.env.SUPABASE_REST_URL || "https://adswapx.com/rest/v1";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM";

// Locate ADB
function findAdbPath() {
  const candidates = [
    "C:\\LDPlayer\\LDPlayer14\\adb.exe",
    "C:\\LDPlayer\\Blue LDPlayer9 Magisk\\adb.exe",
    "C:\\Program Files\\Nox\\bin\\nox_adb.exe",
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

function runAdb(device, cmd) {
  try {
    const fullCmd = `"${ADB_BIN}" ${device ? `-s ${device}` : ""} ${cmd}`;
    return execSync(fullCmd, { encoding: "utf-8", timeout: 15000 }).trim();
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

function makeSupabaseRequest(endpoint, method = "GET", body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_REST_URL}/${endpoint}`;
    const parsed = new URL(url);
    const reqHeaders = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    };

    const req = https.request(
      parsed,
      {
        method,
        headers: reqHeaders,
        timeout: 10000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data ? safeJson(data) : null,
          });
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Supabase request timeout"));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function safeJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

async function checkPoolHealth() {
  try {
    const res = await makeSupabaseRequest(
      "google_token_pool?status=eq.available",
      "GET",
      null,
      {
        Prefer: "count=exact",
        "Range-Unit": "items",
      }
    );
    const range = res.headers["content-range"] || "";
    const totalMatch = range.match(/\/(\d+)/);
    const availableCount = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    return { available: availableCount };
  } catch (err) {
    log("Error checking pool health:", err.message);
    return { available: 0 };
  }
}

async function insertTokenToPool(token) {
  const clean = token.trim();
  if (!clean || clean.length < 5) return false;

  const googleUrl = clean.startsWith("http")
    ? clean
    : `https://www.google.com/share.google?q=${clean}`;
  const shareGoogleUrl = clean.startsWith("http")
    ? clean
    : `https://share.google/${clean}`;
  const tokenCode = clean.replace(/^.*[?&]q=/, "").replace(/^.*share\.google\//, "");

  try {
    const res = await makeSupabaseRequest(
      "google_token_pool",
      "POST",
      {
        token: tokenCode,
        google_url: googleUrl,
        share_google_url: shareGoogleUrl,
        status: "available",
        verified_at: new Date().toISOString(),
      },
      {
        Prefer: "resolution=merge-duplicates",
      }
    );
    if (res.status >= 200 && res.status < 300) {
      log(`✅ Token successfully added to VPS pool: ${tokenCode}`);
      return true;
    } else {
      log(`⚠️ Token insert response: ${res.status}`, res.data);
      return false;
    }
  } catch (err) {
    log("Insert error:", err.message);
    return false;
  }
}

async function captureFromEmulator(device) {
  // Clear previous logcat
  runAdb(device, "logcat -c");

  // 1. Bring Google App Search to front
  runAdb(
    device,
    "shell am start -n com.google.android.googlequicksearchbox/.SearchActivity"
  );
  await sleep(1500);

  // 2. Tap search bar and search keyword
  runAdb(device, "shell input tap 300 85");
  await sleep(400);
  runAdb(device, "shell input text news");
  await sleep(400);
  runAdb(device, "shell input keyevent 66");
  await sleep(2500);

  // 3. Tap 3 dots on first result
  runAdb(device, "shell input tap 505 618");
  await sleep(1000);

  // 4. Tap Share
  runAdb(device, "shell input tap 168 330");
  await sleep(1200);

  // 5. Tap Copy Link (top left icon position in chooser)
  runAdb(device, "shell input tap 70 620");
  await sleep(1000);

  // 6. Check logcat from Share Catcher
  const logs = runAdb(device, "logcat -d -t 50") || "";
  const match = logs.match(/SHARE_CATCHER:\s*CAPTURED_LINK:\s*([^\r\n]+)/);
  if (match && match[1]) {
    const rawLink = match[1].trim();
    log(`🎯 Captured link: ${rawLink}`);
    // Dismiss chooser/share sheet
    runAdb(device, "shell input keyevent 4");
    await sleep(300);
    // Check if tokenized
    const tokenMatch =
      rawLink.match(/[?&]q=([a-zA-Z0-9_-]+)/) ||
      rawLink.match(/share\.google\/([a-zA-Z0-9_-]+)/) ||
      rawLink.match(/search\.app\/([a-zA-Z0-9_-]+)/);
    if (tokenMatch && tokenMatch[1]) {
      return tokenMatch[1];
    }
    // Return clean token or raw code
    return rawLink;
  }

  // Dismiss any left-over dialogs
  runAdb(device, "shell input keyevent 4");
  await sleep(200);
  runAdb(device, "shell input keyevent 4");
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bulkImportTokens(tokensList) {
  log(`Importing ${tokensList.length} tokens into VPS pool...`);
  let added = 0;
  for (const t of tokensList) {
    const ok = await insertTokenToPool(t);
    if (ok) added++;
  }
  log(`🎉 Successfully imported ${added}/${tokensList.length} tokens.`);
}

async function main() {
  console.log("==================================================");
  console.log("   🚀 AdsPx PC Token Worker & Pool Sync Engine    ");
  console.log("==================================================");

  const device = getActiveDevice();
  if (!device) {
    console.error("❌ No active Android emulator/device detected.");
    console.error("👉 Please ensure LDPlayer is open and running!");
    process.exit(1);
  }
  log(`📱 Connected to Emulator Device: ${device}`);

  // Check health
  const health = await checkPoolHealth();
  log(`📊 Current VPS Token Pool: ${health.available} Available`);

  // Parse CLI args
  const args = process.argv.slice(2);
  const countArgIdx = args.indexOf("--count");
  const targetCount = countArgIdx !== -1 ? parseInt(args[countArgIdx + 1], 10) : 5;

  const importFileIdx = args.indexOf("--file");
  if (importFileIdx !== -1) {
    const filePath = args[importFileIdx + 1];
    if (fs.existsSync(filePath)) {
      const lines = fs
        .readFileSync(filePath, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
      await bulkImportTokens(lines);
      process.exit(0);
    } else {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
  }

  log(`Target tokens to generate: ${targetCount}`);
  let generated = 0;

  for (let i = 0; i < targetCount; i++) {
    log(`--- Generating Token ${i + 1}/${targetCount} ---`);
    const token = await captureFromEmulator(device);
    if (token) {
      const ok = await insertTokenToPool(token);
      if (ok) generated++;
    } else {
      log(`⚠️ Attempt ${i + 1} did not capture a token.`);
    }
    await sleep(1500);
  }

  const finalHealth = await checkPoolHealth();
  console.log("==================================================");
  log(`🏁 Run complete! Newly generated: ${generated}/${targetCount}`);
  log(`📦 Total Pool Available: ${finalHealth.available}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Worker error:", err);
  process.exit(1);
});
