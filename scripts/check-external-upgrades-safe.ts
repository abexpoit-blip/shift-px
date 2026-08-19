import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
