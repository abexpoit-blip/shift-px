const fs = require('fs');
const readline = require('readline');

async function analyzeNginx() {
  console.log("=== NGINX ACCESS LOG ANALYSIS ===");
  const fileStream = fs.createReadStream('/var/log/nginx/access.log');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let totalLines = 0;
  const paths = {};
  const statusCodes = {};
  let nasimCount = 0;
  let lastNasimTime = null;

  for await (const line of rl) {
    totalLines++;
    const parts = line.split(' ');
    // typical nginx format: IP - - [date] "METHOD PATH HTTP" STATUS ...
    const match = line.match(/"(GET|POST|HEAD)\s+([^\s]+)\s+HTTP/);
    if (match) {
      const path = match[2].split('?')[0];
      paths[path] = (paths[path] || 0) + 1;
      if (line.includes('sh48m9t')) {
        nasimCount++;
        lastNasimTime = line.match(/\[(.*?)\]/)?.[1] || lastNasimTime;
      }
    }
    const statusMatch = line.match(/"\s+(\d{3})\s+/);
    if (statusMatch) {
      const status = statusMatch[1];
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    }
  }

  console.log(`Total Nginx Access Requests: ${totalLines}`);
  console.log("Status Codes:", statusCodes);
  console.log(`Nasim Link (sh48m9t) hits in Nginx: ${nasimCount}`);
  console.log(`Last Nasim hit time: ${lastNasimTime}`);

  const topPaths = Object.entries(paths)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  console.log("Top 20 Paths:", topPaths);
}

analyzeNginx().catch(console.error);
