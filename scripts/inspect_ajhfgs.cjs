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

async function inspectAjhfgs() {
  console.log('='.repeat(70));
  console.log('INSPECTING LINK: dovtv.com/ajhfgs');
  console.log('='.repeat(70));

  // 1. Fetch link details
  const { data: link, error: lErr } = await sb
    .from('links')
    .select('*')
    .eq('short_code', 'ajhfgs')
    .maybeSingle();

  if (lErr || !link) {
    console.error('Link not found or error:', lErr?.message);
    return;
  }

  console.log('\n[1] LINK RECORD:');
  console.log({
    id: link.id,
    short_code: link.short_code,
    custom_domain: link.custom_domain,
    destination_url: link.destination_url,
    title: link.title,
    is_active: link.is_active,
    clicks_count: link.clicks_count,
    bot_clicks_count: link.bot_clicks_count,
    blocked_countries: link.blocked_countries,
    prelanding_template: link.prelanding_template,
    created_at: link.created_at,
    updated_at: link.updated_at
  });

  const totalClicks = (link.clicks_count || 0) + (link.bot_clicks_count || 0);
  const botPct = totalClicks > 0 ? ((link.bot_clicks_count / totalClicks) * 100).toFixed(1) : 0;
  console.log(`\nTotal: ${totalClicks} | Human: ${link.clicks_count} | Bot: ${link.bot_clicks_count} (${botPct}% filtered)`);

  // 2. Fetch all clicks for this link
  const { data: clicks, error: cErr } = await sb
    .from('clicks')
    .select('*')
    .eq('link_id', link.id)
    .order('created_at', { ascending: false })
    .limit(100);

  console.log(`\n[2] ANALYSIS OF RECENT CLICKS (Sample of ${clicks?.length || 0}):`);

  const reasons = {};
  const countries = {};
  const routed = {};
  const uas = {};

  for (const c of clicks || []) {
    if (c.is_bot) {
      const r = c.bot_reason || 'unknown';
      reasons[r] = (reasons[r] || 0) + 1;
    }
    const country = c.country || '??';
    countries[country] = (countries[country] || 0) + 1;
    const rt = c.routed_to || 'null';
    routed[rt] = (routed[rt] || 0) + 1;
  }

  console.log('\nBot Reasons Breakdown:');
  console.log(reasons);

  console.log('\nRouted To Breakdown:');
  console.log(routed);

  console.log('\nCountries Breakdown:');
  console.log(countries);

  console.log('\n[3] LAST 25 CLICKS RAW DETAILS:');
  for (const c of (clicks || []).slice(0, 25)) {
    console.log(`[${c.created_at.slice(11, 19)}] ${c.country} | ${c.is_bot ? '❌ BOT: ' + c.bot_reason : '✅ HUMAN: ' + c.routed_to} | IP: ${c.ip} | Ref: ${c.referer_host || 'none'} | UA: ${(c.ua || '').slice(0, 60)}`);
  }
}

inspectAjhfgs().catch(console.error);
