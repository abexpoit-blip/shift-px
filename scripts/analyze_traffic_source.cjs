const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = fs.existsSync('/var/www/swiftpx/.env') ? '/var/www/swiftpx/.env' : '/root/adspx-production.env';
const env = fs.readFileSync(envPath, 'utf8');
const sbUrl = env.match(/VITE_SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1] 
           || env.match(/SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1]
           || 'http://127.0.0.1:8000';
const sbKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n\s]+)/)?.[1]
           || env.match(/SUPABASE_ANON_KEY=['"]?([^'"\r\n\s]+)/)?.[1];

const sb = createClient(sbUrl, sbKey);

async function checkTrafficSource() {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  console.log('Querying clicks in last 30 minutes (since ' + since + ')...');

  const { data: clicks } = await sb.from('clicks')
    .select('link_id, referer_host, country, is_bot, routed_to, created_at, ua')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  console.log(`Total sample retrieved: ${clicks?.length || 0}`);

  // Count by link_id
  const byLink = {};
  const byRef = {};
  for (const c of clicks || []) {
    byLink[c.link_id] = (byLink[c.link_id] || 0) + 1;
    const ref = c.referer_host || 'direct/none';
    byRef[ref] = (byRef[ref] || 0) + 1;
  }

  console.log('\nClicks by Referrer Host in last 30 mins:');
  console.log(byRef);

  console.log('\nTop 5 Active Links in last 30 mins:');
  for (const [lid, cnt] of Object.entries(byLink).slice(0, 5)) {
    const { data: l } = await sb.from('links').select('short_code, custom_domain, title, destination_url').eq('id', lid).single();
    console.log(`  https://${l?.custom_domain || 'adswapx.com'}/${l?.short_code} (${l?.title || 'No Title'}) -> ${cnt} clicks | Dest: ${l?.destination_url?.slice(0, 40)}`);
  }

  // Look specifically for zuaj68
  const { data: zuajLink } = await sb.from('links').select('id, short_code, clicks_count, bot_clicks_count, is_active, updated_at').eq('short_code', 'zuaj68').single();
  console.log('\nStatus of zuaj68:');
  console.log(zuajLink);
}

checkTrafficSource().catch(console.error);
