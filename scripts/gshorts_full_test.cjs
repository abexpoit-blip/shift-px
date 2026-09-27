/**
 * GOOGLE SHORTS FULL TEST
 * Tests: share.google URL resolution → adswapx.com → offer routing
 * Tests all device types: mobile in-app, mobile browser, desktop, bots
 * 
 * Run: NODE_PATH=/var/www/swiftpx/node_modules node /tmp/gshorts_full_test.cjs
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Fix env path
const envPath = fs.existsSync('/var/www/swiftpx/.env') ? '/var/www/swiftpx/.env' : '/root/adspx-production.env';
const env = fs.readFileSync(envPath, 'utf8');
const sbUrl = env.match(/VITE_SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1] 
           || env.match(/SUPABASE_URL=['"]?([^'"\r\n\s]+)/)?.[1]
           || 'http://127.0.0.1:8000';
const sbKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=['"]?([^'"\r\n\s]+)/)?.[1]
           || env.match(/SUPABASE_ANON_KEY=['"]?([^'"\r\n\s]+)/)?.[1];

const sb = createClient(sbUrl, sbKey);

// HTTP fetch with redirect tracking
function reqFollow(url, headers = {}, maxHops = 10) {
  return new Promise((resolve) => {
    const hops = [];
    function follow(currentUrl, remaining) {
      if (remaining <= 0) return resolve({ finalUrl: currentUrl, status: -1, hops, body: '', error: 'Too many redirects' });
      const mod = currentUrl.startsWith('https') ? https : http;
      const start = Date.now();
      try {
        mod.get(currentUrl, { headers: { ...headers, 'Accept': 'text/html' }, timeout: 8000 }, (res) => {
          const latency = Date.now() - start;
          hops.push({ url: currentUrl, status: res.statusCode, latency });
          const loc = res.headers['location'];
          if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && loc) {
            const next = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href;
            res.resume();
            follow(next, remaining - 1);
          } else {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ finalUrl: currentUrl, status: res.statusCode, hops, body, error: null }));
          }
        }).on('error', e => resolve({ finalUrl: currentUrl, status: 0, hops, body: '', error: e.message }))
          .on('timeout', function() { this.destroy(); resolve({ finalUrl: currentUrl, status: -1, hops, body: '', error: 'TIMEOUT' }); });
      } catch(e) { resolve({ finalUrl: currentUrl, status: 0, hops, body: '', error: e.message }); }
    }
    follow(url, maxHops);
  });
}

// Simple no-follow fetch
function reqNoFollow(url, headers = {}) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    try {
      mod.get(url, { headers, timeout: 8000 }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, location: res.headers['location'] || '', headers: res.headers, body }));
        res.on('error', () => resolve({ status: 0, location: '', headers: {}, body: '' }));
      }).on('error', e => resolve({ status: 0, location: '', headers: {}, body: e.message }))
        .on('timeout', function() { this.destroy(); resolve({ status: -1, location: '', headers: {}, body: 'TIMEOUT' }); });
    } catch(e) { resolve({ status: 0, location: '', headers: {}, body: e.message }); }
  });
}

function analyze(r) {
  const hasBridge = r.body.includes('data-v=') && (r.body.includes('arm(') || r.body.includes('touchstart'));
  const hasArticle = r.body.includes('og:title') && !hasBridge;
  const hasOffer = r.body.toLowerCase().includes('adsterra') || r.body.includes('track.ad');
  const type = r.status >= 300 && r.status < 400 ? '302 REDIRECT' 
             : hasBridge ? 'CONTENTBRIDGE' 
             : hasArticle ? 'SAFE ARTICLE' 
             : 'UNKNOWN';
  return { type, hasBridge, hasArticle, hasOffer, status: r.status };
}

const UA = {
  fbIab: 'Mozilla/5.0 (Linux; Android 14; SM-A042F Build/UP1A.231005.007; wv) AppleWebKit/537.36 Chrome/153.0.8010.36 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/577.0.0.50.72;IABMV/1;]',
  fban: 'Mozilla/5.0 (Linux; Android 11; TECNO KF6i Build/RP1A) AppleWebKit/537.36 Chrome/152.0.7977.64 Mobile Safari/537.36[FBAN/EMA;FBLC/en_US;FBAV/530.0.0.8.106;FBCX/modulariab;]',
  mobileCopy: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
  mobileFbRef: 'Mozilla/5.0 (Linux; Android 12; CPH2387 Build/SP1A.210812.016; wv) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  desktopFbRef: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
  fbBot: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/91.0.4472.124 Safari/537.36',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};

async function main() {
  console.log('='.repeat(65));
  console.log(' GOOGLE SHORTS + ALL DEVICE ROUTING FULL TEST');
  console.log('='.repeat(65));

  // --- 1. Fetch Google Shorts from DB ---
  console.log('\n[1] GOOGLE SHORTS REGISTRY (from DB)');
  console.log('-'.repeat(50));
  const { data: gshorts, error: gsErr } = await sb.from('google_shorts')
    .select('*').order('created_at', { ascending: false }).limit(10);
  
  if (gsErr) {
    console.log('  DB Error:', gsErr.message);
    console.log('  Supabase URL used:', sbUrl);
  } else {
    console.log('  Total records:', gshorts?.length || 0);
    for (const g of gshorts || []) {
      const keys = Object.keys(g);
      console.log('  COLUMNS:', keys.join(', '));
      console.log('  google_url:', g.google_url || 'MISSING');
      console.log('  share_google_url:', g.share_google_url || 'MISSING');
      console.log('  short_code:', g.short_code);
      console.log('  domain:', g.domain);
      console.log('  ---');
      break; // show just first record's structure
    }
    // List all
    for (const g of gshorts || []) {
      const gUrl = g.google_url || g.share_google_url || 'N/A';
      console.log(`  [${g.short_code}] ${gUrl} → https://${g.domain}/${g.short_code}`);
    }
  }

  // --- 2. Test share.google URL resolution ---
  console.log('\n[2] SHARE.GOOGLE URL RESOLUTION TEST');
  console.log('-'.repeat(50));
  
  // Get a working short_code + domain to test
  const activeLink = gshorts?.[0];
  const testShortCode = activeLink?.short_code || 'sst53g';
  const testDomain = activeLink?.domain || 'adswapx.com';
  const adspxUrl = `https://${testDomain}/${testShortCode}`;
  
  // Try share.google with link= param
  const shareGoogleUrl = `https://share.google/?link=${encodeURIComponent(adspxUrl)}`;
  const shareGoogleQ = `https://www.google.com/share.google?q=${encodeURIComponent(adspxUrl)}`;
  
  console.log('  Test AdsPx URL:', adspxUrl);
  console.log('  share.google URL:', shareGoogleUrl);
  
  // Test share.google resolution (no-follow to see what Google returns)
  const sgRes = await reqNoFollow(shareGoogleUrl, { 'User-Agent': UA.mobileCopy });
  console.log('\n  share.google/?link= response:');
  console.log('    Status:', sgRes.status);
  console.log('    Location:', sgRes.location || '(no redirect)');
  if (sgRes.body.includes('share.google/error')) {
    console.log('    ⚠️  Google returned share.google/error — token not registered via Apps Script');
  } else if (sgRes.status === 200) {
    console.log('    ✅ Google returned 200 — share.google page loaded');
  }

  // Test if stored google_url works
  if (activeLink?.google_url) {
    console.log('\n  Testing stored google_url:', activeLink.google_url);
    const gUrlRes = await reqNoFollow(activeLink.google_url, { 'User-Agent': UA.mobileCopy });
    console.log('    Status:', gUrlRes.status);
    console.log('    Location:', gUrlRes.location || '(no redirect)');
  }

  // --- 3. Full Hop Trace: share.google → adswapx → offer ---
  console.log('\n[3] FULL HOP TRACE (share.google → adswapx.com → offer)');
  console.log('-'.repeat(50));
  console.log('  Tracing with FB_IAB mobile UA + fbclid...');
  
  const traceUrl = shareGoogleUrl;
  const traceResult = await reqFollow(traceUrl, {
    'User-Agent': UA.fbIab,
    'Referer': 'https://m.facebook.com/'
  });
  
  console.log('  Hops:');
  for (const h of traceResult.hops) {
    console.log(`    [${h.status}] ${h.url.slice(0, 80)} (${h.latency}ms)`);
  }
  console.log('  Final URL:', traceResult.finalUrl?.slice(0, 80));
  const traceAnalysis = analyze(traceResult);
  console.log('  Final page type:', traceAnalysis.type);
  console.log('  Offer URL exposed:', traceAnalysis.hasOffer ? '🔴 YES (LEAK!)' : '✅ NO');

  // --- 4. Direct AdsPx link: All device types ---
  console.log('\n[4] DIRECT ADSPX LINK — ALL DEVICE ROUTING TEST');
  console.log('-'.repeat(50));
  console.log('  Testing:', adspxUrl);
  
  const deviceTests = [
    // MOBILE — should get ContentBridge
    { name: '📱 Mobile FB_IAB + fbclid (Real Ad Click)', ua: UA.fbIab, ref: 'https://m.facebook.com/', extra: '?fbclid=IwAR0abc123', expectBridge: true },
    { name: '📱 Mobile FBAN (FB Lite) + fbclid', ua: UA.fban, ref: 'https://l.facebook.com/', extra: '?fbclid=test456', expectBridge: true },
    { name: '📱 Mobile copy-paste (NO fbclid, NO referer)', ua: UA.mobileCopy, ref: '', extra: '', expectBridge: true },
    { name: '📱 Mobile browser + Facebook referer', ua: UA.mobileFbRef, ref: 'https://www.facebook.com/', extra: '', expectBridge: true },
    // DESKTOP — should get Safe Article (no ad signal)
    { name: '🖥️  Desktop Chrome (no signal, no referer)', ua: UA.desktop, ref: '', extra: '', expectBridge: false },
    { name: '🖥️  Desktop + FB referer (reviewer)', ua: UA.desktopFbRef, ref: 'https://www.facebook.com/', extra: '', expectBridge: false },
    { name: '🖥️  Desktop + fbclid (ad click from desktop)', ua: UA.desktop, ref: 'https://m.facebook.com/', extra: '?fbclid=desk123', expectBridge: false },
    // BOTS — should get Safe Article
    { name: '🤖 facebookexternalhit bot', ua: UA.fbBot, ref: '', extra: '', expectBridge: false },
    { name: '🤖 HeadlessChrome bot', ua: UA.headless, ref: '', extra: '', expectBridge: false },
    { name: '🤖 Googlebot', ua: UA.googlebot, ref: '', extra: '', expectBridge: false },
  ];

  let pass = 0, fail = 0;
  for (const t of deviceTests) {
    const fetchUrl = adspxUrl + (t.extra || '');
    const r = await reqNoFollow(fetchUrl, {
      'User-Agent': t.ua,
      ...(t.ref ? { 'Referer': t.ref } : {})
    });
    const a = analyze(r);
    const gotBridge = a.type === 'CONTENTBRIDGE';
    const offerLeak = a.hasOffer ? ' ⚠️ OFFER LEAKED' : '';
    const correct = gotBridge === t.expectBridge;
    const icon = correct ? '✅' : '❌';
    if (correct) pass++; else fail++;
    console.log(`  ${icon} [${r.status}] ${a.type} | ${t.name}${offerLeak}`);
  }

  console.log(`\n  Result: ${pass}/${pass+fail} tests passed`);
  if (fail > 0) console.log('  ⚠️  Some tests FAILED — check routing logic!');
  else console.log('  🎉 ALL ROUTING TESTS PASSED!');

  // --- 5. Google Short via share.google with different UAs ---
  console.log('\n[5] SHARE.GOOGLE LINK — ALL DEVICE ROUTING TEST');
  console.log('-'.repeat(50));
  
  // Use share.google URL and follow through to final page
  const gsDeviceTests = [
    { name: '📱 Mobile FB_IAB + fbclid (via share.google)', ua: UA.fbIab, ref: 'https://m.facebook.com/', extra: '&fbclid=IwAR0gshort123' },
    { name: '📱 Mobile copy-paste (via share.google)', ua: UA.mobileCopy, ref: '', extra: '' },
    { name: '🤖 Facebook bot (via share.google)', ua: UA.fbBot, ref: '', extra: '' },
    { name: '🖥️  Desktop (via share.google)', ua: UA.desktop, ref: '', extra: '' },
  ];

  for (const t of gsDeviceTests) {
    const url = shareGoogleUrl + (t.extra || '');
    const r = await reqFollow(url, { 'User-Agent': t.ua, ...(t.ref ? { 'Referer': t.ref } : {}) });
    const a = analyze(r);
    const offerLeak = a.hasOffer ? ' ⚠️ OFFER LEAKED' : '';
    const hopsStr = r.hops.map(h => h.status).join('→');
    console.log(`  [${hopsStr}] ${a.type} | ${t.name}${offerLeak}`);
    if (r.hops.length > 0) {
      console.log(`    Chain: ${r.hops.map(h => h.url.slice(0, 55)).join('\n           → ')}`);
    }
  }

  // --- 6. Subdomain health ---
  console.log('\n[6] SYSTEM HEALTH CHECK');
  console.log('-'.repeat(50));
  const domains = ['adswapx.com', 'dovtv.com'];
  for (const d of domains) {
    const r = await reqNoFollow(`https://${d}/`, { 'User-Agent': UA.desktop });
    console.log(`  ${d}: HTTP ${r.status} ${r.status === 200 ? '✅ Online' : '❌ Down'}`);
  }
  const local = await reqNoFollow('http://localhost:4000', { 'User-Agent': 'healthcheck' });
  console.log(`  localhost:4000 (PM2): HTTP ${local.status} ${local.status > 0 ? '✅ Running' : '❌ Down'}`);

  console.log('\n' + '='.repeat(65));
  console.log(' AUDIT COMPLETE');
  console.log('='.repeat(65));
}

main().catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
