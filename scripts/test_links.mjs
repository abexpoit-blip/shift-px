async function checkLink(code, domain) {
  const url = `https://${domain}/${code}`;
  console.log(`\n======================================================`);
  console.log(`Testing ${url} with facebookexternalhit/1.1`);
  const res = await fetch(url, {
    headers: {
      "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    },
    redirect: "manual",
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Length:", text.length);
  console.log("Title:", text.match(/<title>([^<]+)<\/title>/)?.[1]);
  console.log("OG Title:", text.match(/property="og:title" content="([^"]+)"/)?.[1]);
  console.log("OG Image:", text.match(/property="og:image" content="([^"]+)"/)?.[1]);
  console.log("OG URL:", text.match(/property="og:url" content="([^"]+)"/)?.[1]);
  console.log("Canonical:", text.match(/<link rel="canonical" href="([^"]+)"/)?.[1]);
  console.log("Site Name:", text.match(/property="og:site_name" content="([^"]+)"/)?.[1]);
  console.log("Has Script in Bot response:", text.includes("<script"));
}

async function main() {
  await checkLink("xtvwag", "dovtv.com");
  await checkLink("v6j6ac", "adswapx.com");
  await checkLink("unejzk", "s14.lovewellness.online");

  console.log("\n======================================================");
  console.log("Testing Google Short URL with redirect follow for facebookexternalhit:");
  const gUrl = "https://www.google.com/share.google?link=https%3A%2F%2Fdovtv.com%2Fxtvwag";
  const res = await fetch(gUrl, {
    headers: {
      "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    },
    redirect: "follow",
  });
  console.log("Final URL:", res.url);
  console.log("Final Status:", res.status);
  const text = await res.text();
  console.log("Title:", text.match(/<title>([^<]+)<\/title>/)?.[1]);
  console.log("OG Title:", text.match(/property="og:title" content="([^"]+)"/)?.[1]);
  console.log("Contains Adsterra/Offer in final body:", /prevailedcandle|arableillnesspersonnel|adsterra/i.test(text));
}

main().catch(console.error);
