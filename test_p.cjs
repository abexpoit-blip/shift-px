const https = require("https");

https.get("https://dovtv.com/vdjudx?_p=1", {
  headers: {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
  }
}, (res) => {
  console.log("Headers:", res.headers);
});
