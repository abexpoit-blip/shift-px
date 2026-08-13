import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function checkCounts() {
  console.log("--- Pre-Deploy Data Integrity Check ---");
  
  const tables = ['profiles', 'packages', 'links', 'clicks', 'upgrade_requests'];
  
  for (const table of tables) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`❌ Error checking ${table}:`, error.message);
    } else {
      console.log(`✅ ${table}: ${count} rows`);
    }
  }
  
  // Check schema specifically
  const { data: schemaInfo, error: schemaErr } = await supabaseAdmin
    .rpc('get_schema_info' as any); // Assuming a helper might exist or just use raw query via rpc if allowed
    
  if (schemaErr) {
    // Fallback to standard check
    const { data: searchPath } = await supabaseAdmin.rpc('get_search_path' as any).catch(() => ({ data: 'unknown' }));
    console.log(`Current DB Search Path: ${JSON.stringify(searchPath)}`);
  }

  console.log("---------------------------------------");
}

checkCounts().catch(console.error);
