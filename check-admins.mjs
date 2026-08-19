import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
