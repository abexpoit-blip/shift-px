/**
 * FULL 48H AUDIT - Traffic, Bot Filtering, Google Shorts, Copy-Paste Detection
 * Run with: NODE_PATH=/var/www/swiftpx/node_modules node full_audit_2d.cjs
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const https = require('https');
const http = require('http');

function req(url, headers={}) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    try {
      mod.get(url, { headers, timeout: 8000 }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, url }));
        res.on('error', () => resolve({ status: 0, headers: {}, body: '', url }));
      }).on('error', (e) => resolve({ status: 0, headers: {}, body: e.message, url }))
        .on('timeout', function() { this.destroy(); resolve({ status: -1, headers: {}, body: 'TIMEOUT', url }); });
    } catch(e) { resolve({ status: 0, headers: {}, body: e.message, url }); }
  });
}

async function main() {
  const envPath = fs.existsSync('/root/adspx-production.env') ? '/root/adspx-production.env' : '/var/www/swiftpx/.env';
  const env = fs.readFileSync(envPath, 'utf8');
  const sbUrl = env.match(/SUPABASE_URL=['"]?([^'"\r\n]+)/)?.[1] || 'https://supabase.adspx.com';
  const sbKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n]+)/)?.[1];
  const sb = createClient(sbUrl, sbKey);

  console.log('='.repeat(60));
  console.log('ADSPX FULL 48H AUDIT');
  console.log('='.repeat(60));

  // --- 1. DB Stats (using pagination workaround with count only) ---
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { count: total } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since);
  const { count: bots } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_bot', true);
  const { count: humans } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_bot', false);
  const { count: offerCount } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_bot', false).eq('routed_to', 'offer');
  const { count: oursCount } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_bot', false).eq('routed_to', 'ours');
  const { count: fbArtCount } = await sb.from('clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('routed_to', 'fb-article');

  console.log('\n[1] TRAFFIC STATS - Last 48 Hours');
  console.log('-'.repeat(40));
  console.log(`  Total Clicks: ${total}`);
  console.log(`  Human: ${humans} (${((humans/total)*100).toFixed(1)}%)`);
  console.log(`  Bot/Filtered: ${bots} (${((bots/total)*100).toFixed(1)}%)`);
  console.log(`  → Routed to OFFER: ${offerCount}`);
  console.log(`  → Routed to OURS (platform): ${oursCount}`);
  console.log(`  → Routed to FB-ARTICLE (safe): ${fbArtCount}`);
  const humanRouted = (offerCount || 0) + (oursCount || 0);
  if (humans > 0) {
    const lossRate = ((humans - humanRouted) / humans * 100).toFixed(2);
    console.log(`  Human Traffic Loss Rate: ${lossRate}% (${humans - humanRouted} not reaching offer/ours)`);
  }

  // --- 2. Top Bot Reasons ---
  console.log('\n[2] TOP BOT REASONS (Last 48h)');
  console.log('-'.repeat(40));
  const { data: botSample } = await sb.from('clicks').select('bot_reason').gte('created_at', since).eq('is_bot', true).limit(5000);
  const reasons = {};
  for (const r of botSample || []) {
    const k = (r.bot_reason || 'unknown').split(':')[0];
    reasons[k] = (reasons[k] || 0) + 1;
  }
  const sorted = Object.entries(reasons).sort((a,b) => b[1]-a[1]);
  sorted.forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // --- 3. Google Shorts Registry ---
  console.log('\n[3] GOOGLE SHORTS REGISTRY');
  console.log('-'.repeat(40));
  const { data: gShorts, error: gErr } = await sb.from('google_shorts').select('*').limit(20).order('created_at', { ascending: false });
  if (gErr) {
    console.log('  ERROR:', gErr.message);
  } else {
    console.log(`  Total registered: ${gShorts?.length || 0}`);
    for (const g of gShorts || []) {
      console.log(`  goo.gl/${g.google_short_code} -> ${g.short_code} [${g.mode||'inhouse_share'}] status:${g.status}`);
    }
  }

  // --- 4. Live Routing Test (Real UAs) ---
  console.log('\n[4] LIVE ROUTING TESTS');
  console.log('-'.repeat(40));

  // Pick first active link from DB
  const { data: links } = await sb.from('links').select('short_code, custom_domain, destination_url').eq('is_active', true).limit(3);
  const testLinks = [];
  for (const l of links || []) {
    const domain = l.custom_domain || 'adswapx.com';
    testLinks.push({ code: l.short_code, url: `https://${domain}/${l.short_code}` });
  }
  if (testLinks.length === 0) testLinks.push({ code: 'fj8dc2', url: 'https://dovtv.com/fj8dc2' });

  const testUrl = testLinks[0].url;
  console.log(`  Testing: ${testUrl}`);

  const tests = [
    { name: 'FB Bot (facebookexternalhit)', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', referer: '', expect: 'fb-article' },
    { name: 'Mobile FB_IAB with fbclid (Real Ad Click)', ua: 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/407.0.0.30.112;]', referer: 'https://m.facebook.com/', extra: '?fbclid=abc123', expect: 'offer' },
    { name: 'Mobile FB Lite (FBAN) with fbclid', ua: 'Mozilla/5.0 (Linux; Android 11; TECNO KF6i Build/RP1A) AppleWebKit/537.36 Chrome/152.0.7977.64 Mobile Safari/537.36[FBAN/EMA;FBLC/en_US;FBAV/530.0.0.8.106;FBCX/modulariab;]', referer: 'https://l.facebook.com/', extra: '?fbclid=test456', expect: 'offer' },
    { name: 'Browser Copy-Paste (NO fbclid, NO referer)', ua: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36', referer: '', extra: '', expect: 'contentBridge' },
    { name: 'Browser with Facebook referer (NO fbclid)', ua: 'Mozilla/5.0 (Linux; Android 12; CPH2387) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36', referer: 'https://www.facebook.com/', extra: '', expect: 'offer' },
    { name: 'Desktop Chrome Direct (No signal) - Should see article', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', referer: '', extra: '', expect: 'article/bridge' },
    { name: 'HeadlessChrome bot', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36', referer: '', extra: '', expect: 'article' },
    { name: 'facebookexternalhit via Google Short (share.google)', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', referer: '', extra: '', expect: 'fb-article' },
    { name: 'curl tool test', ua: 'curl/7.88.1', referer: '', extra: '', expect: '302' },
  ];

  for (const t of tests) {
    const fetchUrl = testUrl + (t.extra || '');
    const r = await req(fetchUrl, {
      'User-Agent': t.ua,
      ...(t.referer ? { 'Referer': t.referer } : {}),
    });

    const redirected = r.status === 301 || r.status === 302;
    const hasOfferInBody = r.body.includes('adsterra') || r.body.includes('track.adsterra');
    const hasDataV = r.body.includes('data-v=');
    const hasArm = r.body.includes('arm(') || r.body.includes('touchstart');
    const hasOgTitle = r.body.includes('og:title');
    const isArticle = r.body.includes('<article') || hasOgTitle;

    let result;
    if (r.status === 302 || r.status === 301) {
      result = `[302 REDIRECT→${r.headers.location?.slice(0,60)}]`;
    } else if (hasDataV && hasArm) {
      result = `[200 ContentBridge ✓]`;
    } else if (isArticle && !hasDataV) {
      result = `[200 Safe Article ✓]`;
    } else {
      result = `[${r.status} ${r.body.length}B]`;
    }

    const leaked = hasOfferInBody ? '⚠️ OFFER URL LEAKED' : '';
    console.log(`  ${t.name}`);
    console.log(`    → ${result} ${leaked}`);
    console.log(`    [status:${r.status}] [hasDataV:${hasDataV}] [hasArm:${hasArm}] [hasOgTitle:${hasOgTitle}]`);
  }

  // --- 5. Adswapx subdomain check ---
  console.log('\n[5] SUBDOMAIN / DOMAIN HEALTH');
  console.log('-'.repeat(40));
  const domains = ['adswapx.com', 'dovtv.com'];
  for (const d of domains) {
    const r = await req(`https://${d}/`, { 'User-Agent': 'Mozilla/5.0 (compatible; healthcheck/1.0)' });
    console.log(`  ${d}: HTTP ${r.status} ${r.status === 200 ? '✅' : '❌'}`);
  }

  // Check PM2 status via loopback
  const pm2Check = await req('http://localhost:4000', { 'User-Agent': 'healthcheck' });
  console.log(`  localhost:4000 (PM2): HTTP ${pm2Check.status} ${pm2Check.status > 0 ? '✅ Running' : '❌ Down'}`);

  // --- 6. Traffic Leak Check ---
  console.log('\n[6] OFFER LEAK CHECK (Bot should NEVER see offer URL)');
  console.log('-'.repeat(40));
  const botRes = await req(testUrl, { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' });
  const leakCheck = botRes.body.toLowerCase().includes('adsterra') || botRes.body.includes('track.ad') || botRes.body.toLowerCase().includes('cpa');
  console.log(`  Offer URL exposed to facebookexternalhit: ${leakCheck ? '🔴 LEAK DETECTED' : '✅ 0% Leak (Protected)'}`);
  console.log(`  Bot response status: ${botRes.status}`);

  // --- 7. Recent Human Clicks Trace ---
  console.log('\n[7] RECENT HUMAN CLICK TRACE (Last 10)');
  console.log('-'.repeat(40));
  const { data: humanClicks } = await sb.from('clicks').select('created_at, country, routed_to, ua').gte('created_at', since).eq('is_bot', false).order('created_at', { ascending: false }).limit(10);
  for (const c of humanClicks || []) {
    const ts = new Date(c.created_at).toISOString().slice(11,19);
    const uaShort = (c.ua || '').slice(0, 60);
    console.log(`  [${ts}] ${c.country} → ${c.routed_to} | ${uaShort}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(60));
}

main().catch(e => { console.error('AUDIT ERROR:', e.message); process.exit(1); });
