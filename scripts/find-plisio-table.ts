import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.sleepox.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findTableSchema() {
  console.log("--- Searching for plisio_event_logs table ---");
  // Try to find the table via information_schema query
  const { data, error } = await supabase.from('information_schema.tables' as any).select('table_schema, table_name').eq('table_name', 'plisio_event_logs');
  
  if (error) {
    console.error("Error querying information_schema:", error.message);
  } else {
    console.log("Table info:", JSON.stringify(data, null, 2));
  }
}

findTableSchema();
