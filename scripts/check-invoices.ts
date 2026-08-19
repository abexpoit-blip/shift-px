import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkInvoices() {
  console.log("--- Checking for generated invoices ---");
  const { data: requests, error } = await supabase
    .from('upgrade_requests')
    .select('id, plisio_invoice_id, status')
    .not('plisio_invoice_id', 'is', null)
    .limit(10);
  
  if (error) {
     console.error("Error:", error.message);
  } else {
    console.log("Found requests with invoice ID:", requests?.length || 0);
    console.log(JSON.stringify(requests, null, 2));
  }
}

checkInvoices();
