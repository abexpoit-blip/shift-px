const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('/var/www/swiftpx/.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1] || 'http://127.0.0.1:8000';
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n\s]+)/)?.[1];
const sb = createClient(url, key);

sb.from('links')
  .select('short_code, created_at, clicks_count, bot_clicks_count, blocked_countries, custom_domain')
  .eq('short_code', 'acfi6c')
  .single()
  .then(r => { console.log(JSON.stringify(r.data, null, 2)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
