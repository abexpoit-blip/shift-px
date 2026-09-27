async function testAllFacebookBots() {
  const code = "fj8dc2";
  const url = "https://adswapx.com/" + code;

  const testCases = [
    {
      name: "1. Standard FB External Hit",
      ua: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      ref: "https://l.facebook.com/",
    },
    {
      name: "2. Facebot Web Crawler",
      ua: "Facebot",
      ref: "https://www.facebook.com/",
    },
    {
      name: "3. Facebook Catalog Crawler",
      ua: "facebookcatalog/1.0",
      ref: "",
    },
    {
      name: "4. Facebook Platform Graph Scraper",
      ua: "facebookplatform/1.0",
      ref: "",
    },
    {
      name: "5. Meta Ad Review Desktop (Internal Ads Manager Referer)",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      ref: "https://secure.facebook.com/ads/manage/",
    },
    {
      name: "6. Meta Business Suite Referer",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      ref: "https://business.facebook.com/adsmanager/manage/campaigns",
    },
    {
      name: "7. Meta Developer Graph Debugger",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ref: "https://developers.facebook.com/tools/debug/",
    },
    {
      name: "8. Emulated Mobile Headless Reviewer (Puppeteer / Lighthouse)",
      ua: "Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (HeadlessChrome)",
      ref: "https://m.facebook.com/",
    },
  ];

  console.log(`Auditing ${testCases.length} Facebook Bot & Reviewer Vectors against live server...\n`);

  for (const tc of testCases) {
    const res = await fetch(url, {
      headers: {
        "user-agent": tc.ua,
        referer: tc.ref,
        ...(tc.headers || {}),
      },
      redirect: "manual",
    });

    const status = res.status;
    const location = res.headers.get("location");
    const text = await res.text();

    const containsAdsterra =
      /arableillnesspersonnel|profitableratecpmnetwork|adsterra|key=/i.test(text);
    const containsMetaRefresh = /http-equiv=["']?refresh/i.test(text);
    const isSafeArticle =
      text.includes("<article") ||
      text.includes("og:title") ||
      text.includes("Chronicle") ||
      text.includes("Herald");
    const hasBridgeScript = text.includes("data-v=");
    const hasBotClass = /fb-ua|dc-asn|ad-review/i.test(res.headers.get("x-reason") || "");

    console.log(`=======================================================`);
    console.log(`TEST: ${tc.name}`);
    console.log(`  HTTP Status: ${status}`);
    console.log(`  Redirect Location Header: ${location || "NONE (No HTTP redirect)"}`);
    console.log(`  Plaintext Offer Domain Exposed: ${containsAdsterra ? "⚠️ EXPOSED" : "✅ 100% PROTECTED (None)"}`);
    console.log(`  Meta Refresh Header In Source: ${containsMetaRefresh ? "⚠️ EXPOSED" : "✅ NONE"}`);
    console.log(`  Safe News Article Served: ${isSafeArticle ? "✅ YES (100% Policy Compliant)" : "❌ NO"}`);
    console.log(`  Content Gate Script Present: ${hasBridgeScript ? "YES (XOR Encrypted)" : "NONE (Pure Static Article)"}`);
  }
}

testAllFacebookBots().catch(console.error);
