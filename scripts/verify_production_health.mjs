async function main() {
  const code = "fj8dc2";
  const url = `https://adswapx.com/${code}`;

  console.log("=== 1. TESTING FACEBOOK AD REVIEWER BOT ===");
  const botRes = await fetch(url, {
    headers: {
      "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    },
    redirect: "manual",
  });
  console.log("Bot HTTP Status:", botRes.status);
  const botHtml = await botRes.text();
  const botTitle = botHtml.match(/<title>([^<]+)<\/title>/)?.[1];
  const ogTitle = botHtml.match(/property="og:title" content="([^"]+)"/)?.[1];
  const ogImage = botHtml.match(/property="og:image" content="([^"]+)"/)?.[1];
  const ogSiteName = botHtml.match(/property="og:site_name" content="([^"]+)"/)?.[1];
  const hasMetaRefresh = /http-equiv="refresh"/i.test(botHtml);
  const hasWindowLocation = /window\.location/i.test(botHtml);

  console.log("Bot Page Title:", botTitle);
  console.log("og:title:", ogTitle);
  console.log("og:image:", ogImage);
  console.log("og:site_name:", ogSiteName);
  console.log("Has Meta Refresh (Must be FALSE):", hasMetaRefresh);
  console.log("Has JS Redirect for Bot (Must be FALSE):", hasWindowLocation);

  console.log("\n=== 2. TESTING HUMAN MOBILE AD CLICK (Facebook In-App Browser) ===");
  const humanRes = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/448.0.0.35.110;]",
      referer: "https://m.facebook.com/",
    },
    redirect: "manual",
  });
  console.log("Human HTTP Status:", humanRes.status);
  const humanHtml = await humanRes.text();
  const hasXorPayload = /data-v="([a-f0-9]+)"/i.test(humanHtml);
  const xorMatch = humanHtml.match(/data-v="([a-f0-9]+)"/i);
  const keyMatch = humanHtml.match(/var k="([a-z0-9]+)"/i);
  console.log("Has XOR encrypted payload:", hasXorPayload);

  if (xorMatch && keyMatch) {
    const hex = xorMatch[1];
    const key = keyMatch[1];
    let decoded = "";
    const kb = Array.from(key).map((c) => c.charCodeAt(0));
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substr(i, 2), 16);
      decoded += String.fromCharCode(byte ^ kb[(i / 2) % kb.length]);
    }
    console.log("Decoded Offer Target URL:", decoded);
    console.log("Is target an Adsterra/Offer destination:", decoded.startsWith("http"));
  }

  const hasInteractionGate = /addEventListener\('scroll'/i.test(humanHtml) && /addEventListener\('touchstart'/i.test(humanHtml);
  const hasAutoDwellFallback = /setTimeout\(function\(\)\{\s*arm\(\{isTrusted:true\}\);\s*\}, 1200\)/.test(humanHtml);
  console.log("Has Real-User Interaction Gate (scroll/touch/pointer):", hasInteractionGate);
  console.log("Has Graceful Dwell Auto-Hop (1200ms fallback):", hasAutoDwellFallback);

  console.log("\n=== 3. TESTING DIRECT TOOL TEST (curl / dev inspect) ===");
  const toolRes = await fetch(url, {
    headers: {
      "user-agent": "curl/7.88.1",
    },
    redirect: "manual",
  });
  console.log("Tool Test HTTP Status (302 for instant dev verify):", toolRes.status);
  console.log("Tool Location header:", toolRes.headers.get("location"));
}

main().catch(console.error);
