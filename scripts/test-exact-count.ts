import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testExactCount() {
  console.log("--- Exact Count Test ---");
  const { count, error } = await supabase.from('upgrade_requests').select('*', { count: 'exact', head: true });
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Count:", count);
  }
}

testExactCount();
