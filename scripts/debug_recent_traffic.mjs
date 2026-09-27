import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function main() {
  const env = fs.readFileSync(".env", "utf8");
  const url = env.match(/SUPABASE_URL=['"]?([^'"\r\n]+)/)?.[1];
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n]+)/)?.[1];
  const supabase = createClient(url, key);

  console.log("=== 1. MOST RECENT 10 LINKS ===");
  const { data: links, error: lErr } = await supabase
    .from("links")
    .select("id, short_code, title, destination_url, custom_domain, clicks_count, bot_clicks_count, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (lErr) console.error("Error:", lErr);
  else console.log(JSON.stringify(links, null, 2));

  if (links && links.length > 0) {
    for (const l of links.slice(0, 3)) {
      console.log(`\n=== CLICKS FOR LINK: ${l.short_code} (${l.title || "No Title"}) ===`);
      const { data: clicks } = await supabase
        .from("clicks")
        .select("created_at, country, is_bot, routed_to, bot_reason, ip, ua")
        .eq("link_id", l.id)
        .order("created_at", { ascending: false })
        .limit(10);
      console.log(JSON.stringify(clicks, null, 2));
    }
  }

  console.log("\n=== 2. OVERALL RECENT CLICKS (Last 20) ===");
  const { data: allClicks } = await supabase
    .from("clicks")
    .select("created_at, country, is_bot, routed_to, bot_reason, ip, ua")
    .order("created_at", { ascending: false })
    .limit(20);
  console.log(JSON.stringify(allClicks, null, 2));
}

main().catch(console.error);
