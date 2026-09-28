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

async function checkOldLinks() {
  console.log('='.repeat(70));
  console.log('FETCHING AND AUDITING OLDER LINKS ACROSS THE SYSTEM');
  console.log('='.repeat(70));

  // 1. Fetch 12 links created earlier (mix of older and recently created)
  const { data: links, error: lErr } = await sb
    .from('links')
    .select('id, short_code, custom_domain, destination_url, title, is_active, clicks_count, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(15);

  if (lErr) {
    console.error('Database query error:', lErr.message);
    return;
  }

  console.log(`Auditing ${links.length} active links...\n`);

  const results = [];

  for (const l of links) {
    const domain = l.custom_domain || 'adswapx.com';
    const testUrl = `https://${domain}/${l.short_code}`;

    // Test 1: Real Mobile User (with fbclid)
    let humanStatus = 0;
    let humanHasBridge = false;
    try {
      const resH = await fetch(testUrl + '?fbclid=testold123', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-A042F) AppleWebKit/537.36 Chrome/153 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/577;]',
          'Referer': 'https://m.facebook.com/'
        }
      });
      humanStatus = resH.status;
      const bH = await resH.text();
      humanHasBridge = bH.includes('data-v=') && bH.includes('arm(');
    } catch (e) {
      humanStatus = -1;
    }

    // Test 2: Facebook Bot
    let botStatus = 0;
    let botSafe = false;
    let botLeak = false;
    try {
      const resB = await fetch(testUrl, {
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
        }
      });
      botStatus = resB.status;
      const bB = await resB.text();
      botSafe = bB.includes('og:title') && !bB.includes('data-v=');
      botLeak = bB.toLowerCase().includes('adsterra');
    } catch (e) {
      botStatus = -1;
    }

    const humanOk = humanStatus === 200 && humanHasBridge;
    const botOk = botStatus === 200 && botSafe && !botLeak;

    results.push({
      code: l.short_code,
      domain,
      title: l.title || 'Untitled',
      clicks: l.clicks_count || 0,
      createdAt: l.created_at?.slice(0, 10),
      humanOk,
      botOk,
      destPreview: (l.destination_url || '').slice(0, 35) + '...'
    });
  }

  // Also check older Google Shorts from google_shorts table
  const { data: gshorts } = await sb
    .from('google_shorts')
    .select('short_code, domain, google_url, share_google_url, created_at')
    .order('created_at', { ascending: false })
    .limit(8);

  console.log('='.repeat(70));
  console.log('RESULTS FOR SHORTENER LINKS:');
  console.log('='.repeat(70));

  for (const r of results) {
    const statusIcon = r.humanOk && r.botOk ? '✅ OK' : '❌ ISSUE';
    console.log(`[${statusIcon}] https://${r.domain}/${r.code} | Created: ${r.createdAt} | Clicks: ${r.clicks}`);
    console.log(`     Real Traffic to Offer: ${r.humanOk ? '✅ ContentBridge' : '❌ Failed'}`);
    console.log(`     Bot to Safe Article:   ${r.botOk ? '✅ 100% Safe News' : '❌ Failed'}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS FOR GOOGLE SHORTS REGISTRY:');
  console.log('='.repeat(70));

  for (const g of gshorts || []) {
    const gUrl = g.share_google_url || g.google_url;
    let gStatus = 0;
    try {
      const gRes = await fetch(gUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-A042F) AppleWebKit/537.36 Chrome/153 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/577;]',
          'Referer': 'https://m.facebook.com/'
        },
        redirect: 'follow'
      });
      gStatus = gRes.status;
      const text = await gRes.text();
      const reachesBridge = text.includes('data-v=');
      console.log(`[${reachesBridge ? '✅ OK' : '❌ ISSUE'}] ${g.short_code} | ${gUrl.slice(0, 50)}...`);
      console.log(`     Destination: https://${g.domain}/${g.short_code} -> Offer: ${reachesBridge ? '✅ Reached' : '❌ Failed'}`);
    } catch (e) {
      console.log(`[❌ ERROR] ${g.short_code}: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('AUDIT OF OLDER LINKS FINISHED');
  console.log('='.repeat(70));
}

checkOldLinks().catch(console.error);
