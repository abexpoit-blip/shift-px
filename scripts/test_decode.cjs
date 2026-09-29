const https = require("https");

https.get(
  "https://adswapx.com/r/wvrxc7",
  {
    headers: {
      Referer: "https://m.facebook.com/",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/462.0.0.47.109;]",
    },
  },
  (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      const vMatch = body.match(/data-v="([a-f0-9]+)"/);
      const kMatch = body.match(/k="([^"]+)"/);
      if (vMatch && kMatch) {
        const hex = vMatch[1];
        const k = kMatch[1];
        let out = "";
        for (let i = 0; i < hex.length; i += 2) {
          const b = parseInt(hex.substr(i, 2), 16);
          out += String.fromCharCode(b ^ k.charCodeAt((i / 2) % k.length));
        }
        console.log("DECODED DESTINATION:", out);
      } else {
        console.log("Found matches:", !!vMatch, !!kMatch);
      }
    });
  }
);
