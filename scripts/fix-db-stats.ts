import { createClient } from '@supabase/supabase-js';

// Configuration for your self-hosted database from ecosystem.config.cjs
const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTUyNzMzOCwiZXhwIjoyMDk0ODg3MzM4fQ.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log("🚀 Running Database Stats Fix on https://supabase.sleepox.com...");

  const sql = `
    -- 1. Grant permissions
    GRANT ALL ON public.clicks TO service_role;
    GRANT ALL ON public.links TO service_role;

    -- 2. Create the fast stats helper function
    CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE
        result JSONB;
    BEGIN
        SELECT jsonb_build_object(
            'total_clicks', (SELECT count(*)::int FROM clicks WHERE is_bot = false),
            'total_bots', (SELECT count(*)::int FROM clicks WHERE is_bot = true),
            'total_ours', (SELECT count(*)::int FROM clicks WHERE is_bot = false AND routed_to = 'ours'),
            'total_offer', (SELECT count(*)::int FROM clicks WHERE is_bot = false AND routed_to = 'offer'),
            'today_clicks', (SELECT count(*)::int FROM clicks WHERE created_at >= CURRENT_DATE AND is_bot = false),
            'total_links', (SELECT count(*)::int FROM links),
            'active_links', (SELECT count(*)::int FROM links WHERE is_active = true)
        ) INTO result;
        RETURN result;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO service_role;
  `;

  try {
    // Self-hosted Supabase often doesn't have the /rpc/run_sql enabled for safety
    // So we'll try a common trick to execute it via a temporary function if possible
    // but the most reliable way for self-hosted is the Dashboard.
    // However, I will try to see if I can run it via the API.
    
    console.log("Checking connectivity...");
    const { count, error: checkError } = await supabase.from('clicks').select('*', { count: 'exact', head: true });
    
    if (checkError) {
      console.error("❌ Connection error:", checkError.message);
      return;
    }
    
    console.log(`✅ Connected! Database has ${count} clicks.`);
    console.log("\n⚠️ MANUAL ACTION REQUIRED ⚠️");
    console.log("Since you are self-hosting, I cannot run 'GRANT' or 'CREATE FUNCTION' via the API.");
    console.log("Please follow these EXACT steps:");
    console.log("1. Open your browser to: https://supabase.sleepox.com");
    console.log("2. Log in to your Supabase Dashboard.");
    console.log("3. Click on 'SQL Editor' in the left sidebar.");
    console.log("4. Click '+ New query'.");
    console.log("5. Paste the SQL code provided in the chat and click 'Run'.");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

runMigration();