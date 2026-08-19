import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUpgradeData() {
  console.log("--- Checking Upgrade Requests & Plisio Logs ---");
  const { data: requests, error: err1 } = await supabase
    .from("upgrade_requests")
    .select("*")
    .limit(5);
  console.log("Upgrade Requests:", err1 ? err1.message : requests?.length);

  const { data: logs, error: err2 } = await supabase.from("plisio_event_logs").select("*").limit(5);
  console.log("Plisio Logs:", err2 ? err2.message : logs?.length);

  if (logs && logs.length > 0) {
    console.log("Latest Log Sample:", JSON.stringify(logs[0], null, 2));
  }
}

checkUpgradeData();
