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

async function run() {
  console.log('='.repeat(70));
  console.log('CHECKING RECENT CLICKS & LINK STATUS');
  console.log('='.repeat(70));

  // 1. Check zuaj68
  const { data: link, error: lErr } = await sb.from('links').select('*').eq('short_code', 'zuaj68').single();
  console.log('\n[1] Link zuaj68 record:');
  if (lErr) console.error('Error:', lErr);
  else console.log({
    id: link.id,
    short_code: link.short_code,
    destination: link.destination_url,
    clicks_count: link.clicks_count,
    bot_clicks_count: link.bot_clicks_count,
    is_active: link.is_active,
    created_at: link.created_at
  });

  const { data: clicks } = await sb.from('clicks')
    .select('created_at, is_bot, routed_to, bot_reason, ip, country, ua')
    .eq('link_id', link?.id)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log(`\n[2] Last ${clicks?.length || 0} clicks for zuaj68:`);
  for (const c of clicks || []) {
    console.log(`  [${c.created_at}] ${c.country || '??'} | ${c.is_bot ? 'BOT: ' + c.bot_reason : 'HUMAN → ' + c.routed_to} | IP: ${c.ip} | UA: ${(c.ua || '').slice(0, 50)}`);
  }

  // 2. Check total clicks across the entire system in the last 1h, 2h, 4h
  const now = Date.now();
  const t1h = new Date(now - 3600*1000).toISOString();
  const t2h = new Date(now - 2*3600*1000).toISOString();
  const t4h = new Date(now - 4*3600*1000).toISOString();

  const { count: c1h } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', t1h);
  const { count: c2h } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', t2h);
  const { count: c4h } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', t4h);

  console.log('\n[3] Overall platform click activity:');
  console.log(`  Last 1 Hour: ${c1h} clicks`);
  console.log(`  Last 2 Hours: ${c2h} clicks`);
  console.log(`  Last 4 Hours: ${c4h} clicks`);

  // 3. Most active links in last 2 hours
  const { data: recentClicks } = await sb.from('clicks')
    .select('link_id')
    .gte('created_at', t2h)
    .limit(1000);

  const linkCounts = {};
  for (const r of recentClicks || []) {
    linkCounts[r.link_id] = (linkCounts[r.link_id] || 0) + 1;
  }
  const topLinkIds = Object.entries(linkCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

  console.log('\n[4] Top active links in last 2 hours:');
  for (const [lid, cnt] of topLinkIds) {
    const { data: lInfo } = await sb.from('links').select('short_code, custom_domain').eq('id', lid).single();
    console.log(`  https://${lInfo?.custom_domain || 'adswapx.com'}/${lInfo?.short_code} -> ${cnt} clicks`);
  }

  // 4. Check the most recent 10 clicks system-wide
  const { data: latestClicks } = await sb.from('clicks')
    .select('created_at, link_id, country, is_bot, routed_to, ip, ua')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n[5] Latest 10 clicks across the platform:');
  for (const lc of latestClicks || []) {
    console.log(`  [${lc.created_at}] ${lc.country} | ${lc.is_bot ? 'BOT' : 'HUMAN: ' + lc.routed_to} | IP: ${lc.ip} | UA: ${(lc.ua || '').slice(0, 45)}`);
  }
}

run().catch(console.error);
