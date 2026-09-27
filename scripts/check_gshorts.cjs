const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('/root/adspx-production.env', 'utf8');
const url = env.match(/SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n\s]+)/)?.[1];
const sb = createClient(url, key);

async function main() {
  // 1. Check google_shorts table columns
  const { data, error } = await sb.from('google_shorts').select('*').limit(3);
  console.log('ERROR:', error?.message);
  console.log('SAMPLE ROW KEYS:', data?.[0] ? Object.keys(data[0]) : 'EMPTY');
  console.log('SAMPLE ROW:', JSON.stringify(data?.[0], null, 2));
  
  // 2. Check what column name stores the google short code
  // It might be 'google_short_url', 'gshort_code', 'short_url', etc.
}
main().catch(console.error);
