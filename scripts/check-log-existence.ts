import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLogExistence() {
  console.log("--- Checking table existence via raw select ---");
  const { data, error } = await supabase
    .from("plisio_event_logs")
    .select("count", { count: "exact", head: true });

  if (error) {
    console.error("❌ Table access error:", error.message);
  } else {
    console.log("✅ Table accessible! Row count:", data);
  }
}

checkLogExistence();
