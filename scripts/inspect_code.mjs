import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function inspect(code) {
  const env = fs.readFileSync(".env", "utf8");
  const url = env.match(/SUPABASE_URL=['"]?([^'"\r\n]+)/)?.[1];
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n]+)/)?.[1];
  const supabase = createClient(url, key);

  const { data: link } = await supabase
    .from("links")
    .select("id, short_code, title, destination_url, custom_domain, clicks_count, bot_clicks_count, created_at")
    .eq("short_code", code)
    .single();

  console.log("=== LINK DETAILS ===");
  console.log(link);

  const { data: gs } = await supabase
    .from("google_shorts")
    .select("*")
    .eq("short_code", code);
  console.log("=== GOOGLE SHORT RECORD ===");
  console.log(gs);

  const { data: clicks } = await supabase
    .from("clicks")
    .select("created_at, country, is_bot, routed_to, bot_reason, ip, ua")
    .eq("link_id", link.id)
    .order("created_at", { ascending: false });

  console.log(`\n=== ALL ${clicks?.length || 0} CLICKS FOR ${code} ===`);
  console.log(JSON.stringify(clicks, null, 2));
}

inspect(process.argv[2] || "xtvwag").catch(console.error);
