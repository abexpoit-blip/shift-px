import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const email = `test-${Date.now()}@example.com`;
  const password = "Password123!";
  
  console.log(`Creating user: ${email}`);
  
  // 1. Create user in auth.users
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Test Admin" }
  });
  
  if (error) {
    console.error("Error creating user:", error);
    return;
  }
  
  const userId = data.user.id;
  console.log(`User created with ID: ${userId}`);
  
  // 2. Add admin role
  console.log("Adding admin role...");
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role: 'admin' });
    
  if (roleError) {
    console.error("Error adding role:", roleError);
    // Continue anyway, maybe the table is different
  } else {
    console.log("Admin role added.");
  }
  
  console.log("\n--- TEST CREDENTIALS ---");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log("------------------------");
}

run();
