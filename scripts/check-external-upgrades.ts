import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkExternalUpgrades() {
  console.log("--- Checking EXTERNAL upgrade_requests ---");
  const { data: requests, error } = await supabase
    .from("upgrade_requests")
    .select("id, user_id, package_slug, amount, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Found requests:", requests?.length);
    console.log(JSON.stringify(requests, null, 2));
  }
}

checkExternalUpgrades();
