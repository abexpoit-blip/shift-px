const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('/var/www/swiftpx/.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1] || 'http://127.0.0.1:8000';
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n\s]+)/)?.[1];
const sb = createClient(url, key);

async function check() {
  const { data: users } = await sb.from('profiles').select('id, email, link_limit, links_used').gte('links_used', 45);
  console.log('Users near or at limit:', users);
}
check();
