const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
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

function dumpAndFindNode(predicate) {
  adb("shell uiautomator dump /data/local/tmp/dump.xml");
  const tmpFile = path.join(__dirname, `temp_dump_${Date.now()}.xml`);
  try {
    execSync(`"${ADB_BIN}" -s ${DEVICE} pull /data/local/tmp/dump.xml "${tmpFile}"`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    if (!fs.existsSync(tmpFile)) return null;

    const xml = fs.readFileSync(tmpFile, "utf8");
    fs.unlinkSync(tmpFile);

    const nodeRegex = /<node\s+([^>]+)\/>/g;
    let match;
    while ((match = nodeRegex.exec(xml)) !== null) {
      const attrs = match[1];
      const getAttr = (name) => {
        const m = attrs.match(new RegExp(name + '="([^"]*)"'));
        return m ? m[1] : "";
      };

      const text = getAttr("text");
      const desc = getAttr("content-desc");
      const boundsStr = getAttr("bounds");
      const clickable = getAttr("clickable");
      const pkg = getAttr("package");
      const resId = getAttr("resource-id");

      const bMatch = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!bMatch) continue;

      const node = {
        text,
        desc,
        clickable,
        pkg,
        resId,
        x1: parseInt(bMatch[1]),
        y1: parseInt(bMatch[2]),
        x2: parseInt(bMatch[3]),
        y2: parseInt(bMatch[4]),
        cx: Math.round((parseInt(bMatch[1]) + parseInt(bMatch[3])) / 2),
        cy: Math.round((parseInt(bMatch[2]) + parseInt(bMatch[4])) / 2),
      };

      if (predicate(node)) {
        return node;
      }
    }
  } catch (e) {
    log("Dump error:", e.message);
  }
  return null;
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

async function captureAccurateToken() {
  adb("logcat -c");

  // Step 1: Tap 3 dots on the first result
  log("Step 1: Tapping 3 dots on result 1 at (505, 355)...");
  adb("shell input tap 505 355");
  await sleep(1800);

  // Step 2: Scan UI for the 'Share' button in 'About the source' sheet
  log("Step 2: Scanning UI to find 'Share' button accurately...");
  const shareBtn = dumpAndFindNode(
    (n) => n.text.startsWith("Share") || n.desc.startsWith("Share")
  );

  if (!shareBtn) {
    log("❌ Could not find Share button in UI hierarchy! Aborting step.");
    adb("shell input tap 495 75");
    adb("shell input keyevent 4");
    return null;
  }

  log(`🎯 Found Share Button: "${shareBtn.text}" at bounds [${shareBtn.x1},${shareBtn.y1}][${shareBtn.x2},${shareBtn.y2}] -> Center (${shareBtn.cx}, ${shareBtn.cy})`);
  adb(`shell input tap ${shareBtn.cx} ${shareBtn.cy}`);
  await sleep(2000);

  // Step 3: Scan UI for 'Copy Link' in Android Share Chooser
  log("Step 3: Scanning UI to find 'Copy Link' (com.adspx.sharecatcher) accurately...");
  const copyLinkBtn = dumpAndFindNode(
    (n) => n.text === "Copy Link" || n.desc === "Copy Link"
  );

  if (!copyLinkBtn) {
    log("❌ Could not find 'Copy Link' in UI hierarchy! Aborting step.");
    adb("shell input keyevent 4");
    await sleep(500);
    adb("shell input tap 495 75");
    return null;
  }

  log(`🎯 Found 'Copy Link': text="${copyLinkBtn.text}" at bounds [${copyLinkBtn.x1},${copyLinkBtn.y1}][${copyLinkBtn.x2},${copyLinkBtn.y2}] -> Center (${copyLinkBtn.cx}, ${copyLinkBtn.cy})`);
  // Note: the icon for Copy Link is at (copyLinkBtn.cx, copyLinkBtn.cy - 60) or the text itself is clickable
  adb(`shell input tap ${copyLinkBtn.cx} ${copyLinkBtn.cy - 60}`);
  await sleep(1500);

  // Step 4: Read logcat for captured link
  const logs = adb("logcat -d -t 60") || "";
  const match = logs.match(/SHARE_CATCHER:\s*CAPTURED_LINK:\s*([^\r\n]+)/);

  // Step 5: Clean dismiss
  adb("shell input keyevent 4");
  await sleep(600);
  // Find the close 'X' button or tap top right
  const closeBtn = dumpAndFindNode((n) => n.desc.toLowerCase().includes("close") || n.desc.toLowerCase().includes("dismiss"));
  if (closeBtn) {
    adb(`shell input tap ${closeBtn.cx} ${closeBtn.cy}`);
  } else {
    adb("shell input tap 495 75");
  }
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
  console.log("=".repeat(65));
  console.log("  AdsPx 100% Accurate Token Harvester (UI Dump + Exact Match)");
  console.log("=".repeat(65));

  const { data: existing } = await sb
    .from("google_token_pool")
    .select("token, google_url, status");

  const pool = new Set((existing || []).map((x) => x.token));
  log(`Currently ${pool.size}/5 tokens available in Supabase pool.`);

  let attempts = 0;
  while (pool.size < 5 && attempts < 15) {
    attempts++;
    log(`\n--- Harvesting Token ${pool.size + 1} of 5 (Run #${attempts}) ---`);

    const token = await captureAccurateToken();

    if (!token) {
      log("⚠️ Capture did not return a link. Resetting search state...");
      adb("shell input keyevent 4");
      adb("shell input tap 495 75");
      await sleep(1000);
      continue;
    }

    if (pool.has(token)) {
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
      log(`❌ Invalid target: ${check.destination}`);
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
      log(`💾 Saved to Supabase google_token_pool! Current Pool Size: ${pool.size}/5`);
    }

    await sleep(1200);
  }

  // Display final pool
  const { data: finalPool } = await sb
    .from("google_token_pool")
    .select("token, google_url, share_google_url, status, verified_at");

  console.log("\n" + "=".repeat(65));
  console.log(` Pool Complete! Total Tokens in Database: ${finalPool.length}`);
  console.log("=".repeat(65));
  console.table(finalPool);
}

main();
