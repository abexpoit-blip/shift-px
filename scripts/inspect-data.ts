import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectData() {
  console.log("--- Inspecting Data Content ---");
  const { data: links, error } = await supabase.from('links').select('*').limit(5);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Links sample:", JSON.stringify(links, null, 2));
  }
}

inspectData();
