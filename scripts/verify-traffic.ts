import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTUyNzMzOCwiZXhwIjoyMDk0ODg3MzM4fQ.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
});

async function verifyTraffic() {
  console.log("🔍 Verifying Live Traffic Stats on https://supabase.sleepox.com...");
  
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