import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLogExistence() {
  console.log("--- Checking table existence via raw select ---");
  const { data, error } = await supabase.from('plisio_event_logs').select('count', { count: 'exact', head: true });
  
  if (error) {
    console.error("❌ Table access error:", error.message);
  } else {
    console.log("✅ Table accessible! Row count:", data);
  }
}

checkLogExistence();
