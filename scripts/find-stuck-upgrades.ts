import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findStuckUpgrades() {
  console.log("--- Finding Paid Orders with Stuck Profiles ---");
  const { data: requests, error } = await supabase
    .from('upgrade_requests')
    .select('id, user_id, package_slug, status')
    .or('status.eq.paid,status.eq.completed,status.eq.success,status.eq.finished');
  
  if (error) {
    console.error("Error fetching requests:", error.message);
    return;
  }

  console.log(`Found ${requests?.length || 0} paid/completed requests.`);

  for (const req of requests || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, plan_slug')
      .eq('id', req.user_id)
      .single();
    
    if (profile && (profile.plan_slug === 'starter' || profile.plan_slug === 'free')) {
      console.log(`STUCK: User ${profile.email} (${req.user_id}) paid for ${req.package_slug} but is still on ${profile.plan_slug}. Order: ${req.id}`);
    } else {
      console.log(`OK: User ${profile?.email} is on ${profile?.plan_slug}.`);
    }
  }
}

findStuckUpgrades();
