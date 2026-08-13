import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function refreshCacheAndCheck() {
  console.log("--- Refreshing Cache and Checking ---");
  
  // Try a generic RPC if one exists to force a schema reload, 
  // though PostgREST usually does this on its own.
  // Instead, let's try a direct query on a known table first.
  await supabase.from('profiles').select('id').limit(1);

  const { data, error } = await supabase.from('plisio_event_logs').select('*').limit(1);
  
  if (error) {
    console.error("❌ Error after profile check:", error.message);
  } else {
    console.log("✅ Success! Data:", data);
  }
}

refreshCacheAndCheck();
