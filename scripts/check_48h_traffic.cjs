const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check() {
  const envPath = fs.existsSync('/root/adspx-production.env') ? '/root/adspx-production.env' : '/var/www/swiftpx/.env';
  const env = fs.readFileSync(envPath, 'utf8');
  const url = env.match(/SUPABASE_URL=['"]?([^'"\r\n]+)/)?.[1] || 'https://supabase.adspx.com';
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n]+)/)?.[1];
  const sb = createClient(url, key);

  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  console.log('Querying clicks since:', since);
  
  const { count: total } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since);
  const { count: botCount } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_bot', true);
  const { count: humanCount } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_bot', false);
  
  console.log('Last 48h Total:', total, 'Human:', humanCount, 'Bot:', botCount);

  // Breakdown by routed_to
  const { data: routed } = await sb.from('clicks').select('routed_to').gte('created_at', since);
  const routeCounts = {};
  for (const r of routed || []) {
    routeCounts[r.routed_to || 'null'] = (routeCounts[r.routed_to || 'null'] || 0) + 1;
  }
  console.log('Breakdown by routed_to:', routeCounts);

  // Breakdown of bot_reason
  const { data: botReasons } = await sb.from('clicks').select('bot_reason').gte('created_at', since).eq('is_bot', true);
  const reasonCounts = {};
  for (const r of botReasons || []) {
    reasonCounts[r.bot_reason || 'unknown'] = (reasonCounts[r.bot_reason || 'unknown'] || 0) + 1;
  }
  console.log('Top Bot Reasons in last 48h:', reasonCounts);

  // Sample recent 15 bot clicks
  const { data: sampleBots } = await sb.from('clicks').select('created_at, country, routed_to, bot_reason, ip, ua').gte('created_at', since).eq('is_bot', true).order('created_at', { ascending: false }).limit(15);
  console.log('Recent 15 Bot Clicks Sample:');
  console.log(JSON.stringify(sampleBots, null, 2));

  // Sample recent 15 human clicks
  const { data: sampleHuman } = await sb.from('clicks').select('created_at, country, routed_to, ip, ua').gte('created_at', since).eq('is_bot', false).order('created_at', { ascending: false }).limit(15);
  console.log('Recent 15 Human Clicks Sample:');
  console.log(JSON.stringify(sampleHuman, null, 2));
}

check().catch(console.error);
