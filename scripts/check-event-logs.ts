import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
