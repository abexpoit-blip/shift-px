const https = require("https");

function trace(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14; Mobile)" } }, (res) => {
      resolve({
        statusCode: res.statusCode,
        location: res.headers.location,
        headers: res.headers
      });
    }).on("error", (e) => resolve({ error: e.message }));
  });
}

async function run() {
  console.log("=== TESTING GOOGLE SHORT: https://share.google/T2OdrsX5nxBVJLrmS ===");
  const r1 = await trace("https://share.google/T2OdrsX5nxBVJLrmS");
  console.log("Hop 1 (Google):", r1);

  console.log("\n=== TESTING DIRECT DOVTV CODE: https://dovtv.com/g48735k ===");
  const r2 = await trace("https://dovtv.com/g48735k");
  console.log("Hop 2 (Dovtv Mobile visit):", r2.statusCode, "Location:", r2.location);
}
run();
