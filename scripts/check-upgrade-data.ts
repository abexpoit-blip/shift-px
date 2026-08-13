import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUpgradeData() {
  console.log("--- Checking Upgrade Requests & Plisio Logs ---");
  const { data: requests, error: err1 } = await supabase.from('upgrade_requests').select('*').limit(5);
  console.log("Upgrade Requests:", err1 ? err1.message : requests?.length);
  
  const { data: logs, error: err2 } = await supabase.from('plisio_event_logs').select('*').limit(5);
  console.log("Plisio Logs:", err2 ? err2.message : logs?.length);

  if (logs && logs.length > 0) {
    console.log("Latest Log Sample:", JSON.stringify(logs[0], null, 2));
  }
}

checkUpgradeData();
