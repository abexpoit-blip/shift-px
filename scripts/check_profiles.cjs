const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('/var/www/swiftpx/.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1] || 'http://127.0.0.1:8000';
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n\s]+)/)?.[1];
const sb = createClient(url, key);

async function check() {
  const { data: p, error: pErr } = await sb.from('profiles').select('*').limit(3);
  if (pErr) console.error('P ERROR:', pErr);
  else console.log('P DATA keys:', Object.keys(p[0] || {}));
  console.log('Sample profile:', p?.[0]);
}
check();
