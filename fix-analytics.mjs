import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking RPC health...");
  const { data: adminStats, error: adminErr } = await supabase.rpc('admin_stats');
  if (adminErr) {
    console.log("admin_stats RPC missing or failing:", adminErr.message);
  } else {
    console.log("admin_stats RPC ok:", adminStats);
  }

  const { data: dashStats, error: dashErr } = await supabase.rpc('get_dashboard_stats', { _user_id: '49eb17fa-e9f6-46a9-98c4-bcdd102f355a' });
  if (dashErr) {
    console.log("get_dashboard_stats RPC missing or failing:", dashErr.message);
  } else {
    console.log("get_dashboard_stats RPC ok");
  }
}
run();
