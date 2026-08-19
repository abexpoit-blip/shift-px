import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkExternalData() {
  const tables = ['profiles', 'packages', 'links', 'clicks'];
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error checking ${table}:`, error.message);
    } else {
      console.log(`${table} count: ${count}`);
    }
  }
}

checkExternalData();
