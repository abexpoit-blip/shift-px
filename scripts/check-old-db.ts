import { createClient } from '@supabase/supabase-js';

// Configuration for your old self-hosted database
const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkOldData() {
  console.log("🔍 Checking Old Database (https://supabase.adspx.com)...");
  
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