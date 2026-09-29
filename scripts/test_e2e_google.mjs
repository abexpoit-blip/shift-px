import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://adswapx.com";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testOffer() {
  const userOffer = "https://mygirlhub.netlify.app/";
  
  // 1. Create a fresh test short link in AdsPx
  const code = "test" + Math.floor(Math.random() * 8999 + 1000);
  console.log(`[1] Creating short link: adswapx.com/r/${code} with destination: ${userOffer}`);
  
  const { data: link, error } = await sb.from("links").insert({
    short_code: code,
    destination_url: userOffer,
    adsterra_url: userOffer,
    is_active: true,
    user_id: "00000000-0000-0000-0000-000000000000" // system/admin or null
  }).select().single();
  
  if (error) {
    // If user_id FK fails, get first user
    const { data: user } = await sb.from("profiles").select("id").limit(1).single();
    const { data: link2, error: err2 } = await sb.from("links").insert({
      short_code: code,
      destination_url: userOffer,
      adsterra_url: userOffer,
      is_active: true,
      user_id: user?.id
    }).select().single();
    if (err2) {
      console.error("Failed to insert link:", err2.message);
      return;
    }
  }

  console.log(`✅ Link created successfully in DB: adswapx.com/r/${code}`);
  
  // 2. Build Google domain short link
  const googleLink = `https://share.google/?link=${encodeURIComponent(`https://adswapx.com/r/${code}`)}`;
  console.log(`\n[2] Google Domain Link: ${googleLink}`);
  
  // 3. Test with Facebook Bot
  console.log(`\n[3] Testing with Facebook Crawler (facebookexternalhit)...`);
  const fbRes = await fetch(googleLink, {
    headers: {
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "text/html"
    }
  });
  console.log(`   Final Status: ${fbRes.status}`);
  const fbHtml = await fbRes.text();
  console.log(`   Is Safe Article: ${fbHtml.includes("og:title") && !fbHtml.includes("data-v=")}`);
  console.log(`   Offer Exposed to Bot: ${fbHtml.includes(userOffer) ? "YES (LEAK!)" : "NO (100% PROTECTED)"}`);
  
  // 4. Test with Real Mobile User (Android / Facebook In-App Browser)
  console.log(`\n[4] Testing with Real Mobile User (FB In-App Browser)...`);
  const userRes = await fetch(googleLink, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 [FB_IAB/FB4A]",
      "Referer": "https://l.facebook.com/",
      "Accept": "text/html"
    }
  });
  console.log(`   Final Status: ${userRes.status}`);
  const userHtml = await userRes.text();
  const hasBridge = userHtml.includes("data-v=") && userHtml.includes("arm(");
  console.log(`   ContentBridge Activated: ${hasBridge}`);
  
  // 5. Decode XOR in ContentBridge to verify it reaches userOffer!
  if (hasBridge) {
    const keyMatch = userHtml.match(/var k="([^"]+)"/);
    const vMatch = userHtml.match(/data-v="([a-f0-9]+)"/);
    if (keyMatch && vMatch) {
      const k = keyMatch[1];
      const v = vMatch[1];
      const b = [];
      for (let i = 0; i < v.length; i += 2) b.push(parseInt(v.substr(i, 2), 16));
      const kb = Array.from(k).map(c => c.charCodeAt(0));
      let decodedUrl = "";
      for (let i = 0; i < b.length; i++) decodedUrl += String.fromCharCode(b[i] ^ kb[i % kb.length]);
      console.log(`   🎯 Decoded Offer URL from Bridge: ${decodedUrl}`);
      console.log(`   Matches User Offer: ${decodedUrl.includes("mygirlhub.netlify.app") ? "✅ YES! PERFECT MATCH!" : "❌ MISMATCH"}`);
    }
  }
}

testOffer().catch(console.error);
