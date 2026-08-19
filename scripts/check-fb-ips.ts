import { createClient } from "@supabase/supabase-js";
const s = createClient("https://supabase.adspx.com", process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await s
  .from("clicks")
  .select("ip,bot_reason")
  .ilike("bot_reason", "fb-ua-spoof%")
  .order("created_at", { ascending: false })
  .limit(200);
const ipCount: Record<string, number> = {};
(data || []).forEach((r: any) => {
  const p = (r.ip || "").split(".").slice(0, 2).join(".");
  ipCount[p] = (ipCount[p] || 0) + 1;
});
console.log("Top /16 prefixes of 'fb-ua-spoof' clicks:");
Object.entries(ipCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(v, k));
console.log("\nSample IPs:");
(data || []).slice(0, 10).forEach((r: any) => console.log(r.ip));
