import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
});

async function verifyTraffic() {
  console.log("🔍 Verifying Live Traffic Stats on https://supabase.adspx.com...");
  
  const { count: clickCount, error: clickError } = await supabase
    .from('clicks')
    .select('*', { count: 'exact', head: true });

  if (clickError) {
    console.error("❌ Error fetching clicks:", clickError.message);
  } else {
    console.log(`📈 Total clicks found: ${clickCount}`);
  }
}

verifyTraffic();