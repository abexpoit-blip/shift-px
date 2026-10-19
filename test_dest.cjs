const https = require("https");

function checkDest(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
      }
    }, (res) => {
      resolve({
        url,
        statusCode: res.statusCode,
        location: res.headers.location,
        contentType: res.headers["content-type"]
      });
    }).on("error", (e) => resolve({ url, error: e.message }));
  });
}

async function run() {
  console.log("Checking destination 1: balancedflask.com...");
  const d1 = await checkDest("https://balancedflask.com/vuc07bvk8i?key=0f3c5c957464b9d9d2945a5fd2e0e875");
  console.log("D1:", d1);

  console.log("\nChecking destination 2: t.co/a9B9HLyD6c...");
  const d2 = await checkDest("https://t.co/a9B9HLyD6c");
  console.log("D2:", d2);
}
run();
