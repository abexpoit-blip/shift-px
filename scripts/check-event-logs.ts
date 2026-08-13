import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkEventLogs() {
  console.log("--- Checking plisio_event_logs ---");
  // Try to find the table name first, it might be different or missing
  const { data: logs, error } = await supabase.from('plisio_event_logs').select('*').order('created_at', { ascending: false }).limit(10);
  
  if (error) {
     console.error("Error:", error.message);
  } else {
    console.log("Found logs:", logs?.length || 0);
    console.log(JSON.stringify(logs, null, 2));
  }
}

checkEventLogs();
