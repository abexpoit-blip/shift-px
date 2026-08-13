import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: admins, error } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .eq('role', 'admin');
    
  if (error) {
    console.error("Error fetching admins:", error);
    return;
  }
  
  console.log("Admins found:", admins.length);
  for (const admin of admins) {
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', admin.user_id).single();
    console.log(`Admin User ID: ${admin.user_id}, Email: ${profile?.email}`);
  }
}

check();
