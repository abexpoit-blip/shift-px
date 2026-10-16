const https = require("https");

https.get("https://www.google.com/share.google?q=T2OdrsX5nxBVJLrmS", {
  headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14; Mobile)" }
}, (res) => {
  console.log("Status from Google:", res.statusCode);
  console.log("Location header:", res.headers.location);
});
