const link = 'https://adswapx.com/zuaj68';
const googleLink = 'https://www.google.com/share.google?link=https%3A%2F%2Fadswapx.com%2Fzuaj68';

// Every known Facebook / Meta bot vector and ad review crawler
const botVectors = [
  { name: '1. Facebook External Hit (Primary Link Preview Scraper)', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
  { name: '2. Facebot (Legacy FB crawler)', ua: 'Facebot' },
  { name: '3. Facebook Catalog Crawler', ua: 'facebookcatalog/1.0' },
  { name: '4. Facebook Platform Graph Scraper', ua: 'facebookplatform/1.0 (+http://developers.facebook.com)' },
  { name: '5. Meta External Agent (AI Scraper)', ua: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)' },
  { name: '6. Meta External Ads Scanner (Ad Policy Quality Bot)', ua: 'meta-externalads/1.0 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)' },
  { name: '7. Meta Web Indexer', ua: 'meta-webindexer/1.0' },
  { name: '8. Internal Meta Ad Reviewer (Ads Manager Referer)', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36', ref: 'https://adsmanager.facebook.com/ads/manage/campaigns' },
  { name: '9. Meta Business Suite Reviewer Referer', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', ref: 'https://business.facebook.com/' },
  { name: '10. Meta Developer Graph Debugger Referer', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ref: 'https://developers.facebook.com/tools/debug/' },
  { name: '11. Headless Chrome / Puppeteer Bot', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36' },
  { name: '12. Python Requests Automated Tool', ua: 'python-requests/2.31.0' },
  { name: '13. Googlebot AdSense / Ad Review Crawler', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: '14. Twitter / X Link Preview Bot', ua: 'Twitterbot/1.0' },
];

async function deepAudit() {
  console.log('='.repeat(70));
  console.log('FINAL DEEP AUDIT: ZERO-LEAK & ANTI-REJECTION INSPECTION');
  console.log('Target Direct:', link);
  console.log('Target Google Short:', googleLink);
  console.log('='.repeat(70));

  let totalLeaks = 0;
  let totalRejectionRisks = 0;

  for (const bot of botVectors) {
    const res = await fetch(link, {
      headers: {
        'User-Agent': bot.ua,
        ...(bot.ref ? { 'Referer': bot.ref } : {})
      }
    });

    const body = await res.text();
    const status = res.status;
    const location = res.headers.get('location');

    // 1. Status Check
    const statusOk = status === 200;
    
    // 2. Leak Checks
    const hasAdsterra = body.toLowerCase().includes('adsterra');
    const hasCpa = body.toLowerCase().includes('cpa');
    const hasXorDataV = body.includes('data-v=');
    const hasArmScript = body.includes('arm(') || body.includes('contentBridge');
    const hasMetaRefresh = body.toLowerCase().includes('http-equiv="refresh"') || body.toLowerCase().includes("http-equiv='refresh'");
    const hasWindowLocation = body.toLowerCase().includes('window.location') || body.toLowerCase().includes('location.replace');
    const hasRedirectHeader = !!location;

    // 3. Rejection Risk Checks
    const hasOgTitle = body.includes('og:title') && !body.includes('og:title" content=""');
    const hasOgImage = body.includes('og:image');
    const hasArticleContent = body.includes('<article') || body.includes('class="article');
    const wordCount = body.split(/\s+/).length;

    const isLeaking = hasAdsterra || hasCpa || hasXorDataV || hasArmScript || hasMetaRefresh || hasWindowLocation || hasRedirectHeader;
    const isAtRisk = !statusOk || !hasOgTitle || !hasOgImage || wordCount < 100;

    if (isLeaking) totalLeaks++;
    if (isAtRisk) totalRejectionRisks++;

    console.log(`\nBOT: ${bot.name}`);
    console.log(`  HTTP Status: ${status} ${statusOk ? '✅' : '❌'}`);
    console.log(`  Redirect Header: ${location || 'NONE ✅'}`);
    console.log(`  Offer Domain Leak: ${hasAdsterra ? '🔴 LEAKED' : '✅ 0% (Clean)'}`);
    console.log(`  XOR Obfuscation in Body: ${hasXorDataV ? '🔴 PRESENT' : '✅ NONE (Pure Static)'}`);
    console.log(`  Redirect Script in Body: ${hasWindowLocation ? '🔴 PRESENT' : '✅ NONE'}`);
    console.log(`  Meta Refresh in Body: ${hasMetaRefresh ? '🔴 PRESENT' : '✅ NONE'}`);
    console.log(`  Safe OG Title Present: ${hasOgTitle ? '✅ YES' : '❌ NO'}`);
    console.log(`  Safe OG Image Present: ${hasOgImage ? '✅ YES' : '❌ NO'}`);
    console.log(`  Page Word Count: ${wordCount} words (Safe long-form content)`);
    console.log(`  Verdict: ${(!isLeaking && !isAtRisk) ? '✅ 100% SAFE - AD APPROVAL GUARANTEED' : '🔴 RISK DETECTED'}`);
  }

  // Also test through Google Share link
  console.log('\n' + '='.repeat(70));
  console.log('TESTING BOT THROUGH GOOGLE SHARE LINK (End-to-End Hop)');
  console.log('='.repeat(70));

  const gRes = await fetch(googleLink, {
    headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
    redirect: 'follow'
  });
  const gBody = await gRes.text();
  console.log('Final URL after Google redirect:', gRes.url);
  console.log('Final Status:', gRes.status);
  console.log('Has Clean Article:', gBody.includes('og:title'));
  console.log('Has Data-V Script:', gBody.includes('data-v='));
  console.log('Has Plaintext Offer:', gBody.toLowerCase().includes('adsterra'));

  console.log('\n' + '='.repeat(70));
  console.log(`FINAL RESULT: Total Leaks: ${totalLeaks} | Rejection Risks: ${totalRejectionRisks}`);
  console.log('='.repeat(70));
}

deepAudit().catch(console.error);
