#!/usr/bin/env node
/**
 * Live VPS Error Log & System Diagnostic Auditor
 */
const { execSync } = require('child_process');

console.log("=================================================================");
console.log("🔍 RUNNING COMPREHENSIVE VPS SYSTEM & ERROR LOG AUDIT");
console.log("=================================================================\n");

// 1. PM2 Status
console.log("📊 1. PM2 WORKERS STATUS:");
try {
  const pm2Status = execSync("pm2 jlist", { encoding: 'utf8' });
  const list = JSON.parse(pm2Status);
  console.log(`   • Total PM2 Instances: ${list.length}`);
  let onlineCount = 0;
  let restarts = 0;
  list.forEach(proc => {
    if (proc.pm2_env.status === "online") onlineCount++;
    restarts += (proc.pm2_env.restart_time || 0);
  });
  console.log(`   • Online Instances:    ${onlineCount}/${list.length}`);
  console.log(`   • Total Restarts:      ${restarts}`);
} catch (e) {
  console.log("   • PM2 Status Check Error:", e.message);
}
console.log("");

// 2. PM2 Error Logs (Last 50 lines)
console.log("📜 2. CHECKING PM2 ERROR LOGS (LAST 50 LINES):");
try {
  const errLogs = execSync("pm2 logs --err --lines 50 --nostream", { encoding: 'utf8', timeout: 5000 });
  const filtered = errLogs.split('\n').filter(l => l.trim() && !l.includes("[TAILING]"));
  if (filtered.length === 0 || filtered.every(l => l.includes("MODULE_NOT_FOUND") === false && !l.includes("Error:"))) {
    console.log("   ✅ Clean: No fatal runtime crashes or unhandled exceptions found.");
  }
  console.log(filtered.slice(-15).join('\n') || "   (No active errors)");
} catch (e) {
  console.log("   • Error reading logs or empty log:", e.message);
}
console.log("");

// 3. Test HTTP Response
console.log("🩺 3. TESTING ENGINE HTTP HEALTH:");
try {
  const curlRes = execSync("curl -I -s http://127.0.0.1:4000/ | head -n 5", { encoding: 'utf8' });
  console.log(curlRes.trim());
} catch (e) {
  console.log("   • HTTP Health Check Error:", e.message);
}
console.log("");

console.log("=================================================================");
console.log("✅ AUDIT COMPLETE");
console.log("=================================================================");
