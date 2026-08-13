import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkExternalUpgradesSafe() {
  console.log("--- Checking EXTERNAL upgrade_requests (SAFE) ---");
  const { data: requests, error } = await supabase
    .from('upgrade_requests')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error("Error:", error.message);
  } else {
    if (requests && requests.length > 0) {
      console.log("Found keys:", Object.keys(requests[0]).join(', '));
      console.log("Latest request:", JSON.stringify(requests[0], null, 2));
    } else {
      console.log("Table is empty.");
    }
  }
}

checkExternalUpgradesSafe();
