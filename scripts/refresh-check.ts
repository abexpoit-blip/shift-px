import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
