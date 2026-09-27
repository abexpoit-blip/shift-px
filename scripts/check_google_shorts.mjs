import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function main() {
  let envText = "";
  try {
    envText = fs.readFileSync(".env", "utf8");
  } catch {
    envText = "";
  }

  const url =
    process.env.SUPABASE_URL ||
    envText.match(/SUPABASE_URL=['"]?([^'"\r\n]+)/)?.[1];
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envText.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n]+)/)?.[1];

  if (!url || !key) {
    console.error("Missing Supabase credentials");
    return;
  }

  const supabase = createClient(url, key);

  console.log("=== RECENT GOOGLE SHORTS ===");
  const { data: gShorts, error: gErr } = await supabase
    .from("google_shorts")
    .select("id, google_url, short_code, destination_url, link_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (gErr) {
    console.error("Error fetching google_shorts:", gErr);
  } else {
    console.log(JSON.stringify(gShorts, null, 2));

    if (gShorts && gShorts.length > 0) {
      console.log("\n=== TESTING FIRST GOOGLE SHORT LINK ===");
      const testLink = gShorts[0];
      console.log("Google URL:", testLink.google_url);
      console.log("Internal Short Code:", testLink.short_code);
      console.log("Offer Target:", testLink.destination_url);

      try {
        console.log("Testing hop 1: Fetching Google URL...");
        const resGoogle = await fetch(testLink.google_url, {
          headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          redirect: "manual",
        });
        console.log("Google URL status:", resGoogle.status);
        console.log("Google URL Location header:", resGoogle.headers.get("location"));
      } catch (e) {
        console.log("Hop 1 note (some Google URLs require browser context or specific parameters):", e.message);
      }

      console.log("\nTesting hop 2: Direct AdsPx short link on dovtv.com / adswapx.com...");
      const directShortUrl = `https://adswapx.com/${testLink.short_code}`;
      const resAdsPx = await fetch(directShortUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36",
          referer: "https://m.facebook.com/",
        },
        redirect: "manual",
      });
      console.log("Direct AdsPx short link status:", resAdsPx.status);
      const htmlAdsPx = await resAdsPx.text();
      const hasPayload = /data-v="([a-f0-9]+)"/i.test(htmlAdsPx);
      console.log("Has encrypted target in bridge:", hasPayload);
    }
  }

  console.log("\n=== RECENT CLICKS SCAN (Last 15 Hits) ===");
  const { data: recentClicks, error: cErr } = await supabase
    .from("clicks")
    .select("created_at, country, is_bot, routed_to, bot_reason")
    .order("created_at", { ascending: false })
    .limit(15);

  if (cErr) {
    console.error("Error fetching clicks:", cErr);
  } else {
    console.log(JSON.stringify(recentClicks, null, 2));
  }
}

main().catch(console.error);
