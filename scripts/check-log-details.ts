import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLogDetails() {
  console.log("--- Checking Plisio Logs Table ---");
  const { data, error, count } = await supabase
    .from("plisio_event_logs")
    .select("*", { count: "exact" });

  if (error) {
    console.error("❌ Error:", error.message);
  } else {
    console.log("✅ Row count:", count);
    console.log("✅ Data sample:", JSON.stringify(data, null, 2));
  }
}

checkLogDetails();
