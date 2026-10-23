const https = require('https');

function fetchWithUA(url, ua, headers = {}) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': ua,
        ...headers
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          location: res.headers.location,
          title: b.match(/<title>(.*?)<\/title>/i)?.[1],
          ogTitle: b.match(/property=["']og:title["'] content=["'](.*?)["']/i)?.[1],
          ogImage: b.match(/property=["']og:image["'] content=["'](.*?)["']/i)?.[1],
          ogUrl: b.match(/property=["']og:url["'] content=["'](.*?)["']/i)?.[1],
          canonical: b.match(/<link rel=["']canonical["'] href=["'](.*?)["']/i)?.[1],
          robotsMeta: b.match(/name=["']robots["'] content=["'](.*?)["']/i)?.[1],
          xRobotsTag: res.headers['x-robots-tag'],
          bodyLength: b.length
        });
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

async function run() {
  console.log('=== TEST 1: dovtv.com/?p=sh48m9t (Google Share dest) ===');
  const t1 = await fetchWithUA('https://dovtv.com/?p=sh48m9t', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)');
  console.log(t1);

  console.log('\n=== TEST 2: dovtv.com/sh48m9t (Direct path) ===');
  const t2 = await fetchWithUA('https://dovtv.com/sh48m9t', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)');
  console.log(t2);

  console.log('\n=== TEST 3: Meta-WebIndexer crawling dovtv.com/sh48m9t ===');
  const t3 = await fetchWithUA('https://dovtv.com/sh48m9t', 'Meta-WebIndexer/1.0 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)');
  console.log(t3);
}

run();
