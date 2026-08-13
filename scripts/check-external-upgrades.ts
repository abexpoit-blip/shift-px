import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkExternalUpgrades() {
  console.log("--- Checking EXTERNAL upgrade_requests ---");
  const { data: requests, error } = await supabase
    .from('upgrade_requests')
    .select('id, user_id, package_slug, amount, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Found requests:", requests?.length);
    console.log(JSON.stringify(requests, null, 2));
  }
}

checkExternalUpgrades();
