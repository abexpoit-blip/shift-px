import { createClient } from '@supabase/supabase-js';

// Configuration for your old self-hosted database
const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkOldData() {
  console.log("🔍 Checking Old Database (https://supabase.sleepox.com)...");
  
  try {
    const { count: linkCount, error: linkError } = await supabase
      .from('links')
      .select('*', { count: 'exact', head: true });

    if (linkError) {
      console.error("❌ Error checking links:", linkError.message);
    } else {
      console.log(`🔗 Links found: ${linkCount}`);
    }

    const { count: clickCount, error: clickError } = await supabase
      .from('clicks')
      .select('*', { count: 'exact', head: true });

    if (clickError) {
      console.error("❌ Error checking clicks:", clickError.message);
    } else {
      console.log(`📈 Clicks found: ${clickCount}`);
      
      if (clickCount > 0) {
        const { data: recent } = await supabase
          .from('clicks')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);
        console.log(`🕒 Latest click at: ${recent?.[0]?.created_at}`);
      }
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

checkOldData();