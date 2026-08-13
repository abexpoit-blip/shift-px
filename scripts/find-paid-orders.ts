import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

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
