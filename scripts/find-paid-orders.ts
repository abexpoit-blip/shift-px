import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findPaidOrders() {
  console.log("--- Finding Paid Orders ---");
  const { data: requests, error } = await supabase
    .from('upgrade_requests')
    .select('id, user_id, package_slug, status')
    .in('status', ['paid', 'completed', 'success', 'finished']);
  
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Found paid/completed:", requests?.length || 0);
    for (const req of requests || []) {
       const { data: profile } = await supabase.from('profiles').select('email, plan_slug').eq('id', req.user_id).single();
       console.log(`Order ${req.id}: Status ${req.status}, User ${profile?.email}, Plan ${profile?.plan_slug}`);
    }
  }
}

findPaidOrders();
