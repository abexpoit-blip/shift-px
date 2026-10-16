const https = require("https");

https.get("https://dovtv.com/?p=g48735k", {
  headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14; Mobile)" }
}, (res) => {
  console.log("Status from dovtv ?p=:", res.statusCode);
  console.log("Location header:", res.headers.location);
});
