async function trace() {
  let url = 'https://www.google.com/share.google?q=pqATPUPGq8j0jZDLI';
  for (let i = 0; i < 10; i++) {
    console.log(`[${i}] Fetching: ${url}`);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log(`    Status: ${res.status}`);
    const loc = res.headers.get('location');
    console.log(`    Location: ${loc}`);
    if (res.status === 200) {
      const text = await res.text();
      console.log('    Body length:', text.length);
      console.log('    Body preview:', text.slice(0, 1000));
      // Look for meta refresh or scripts or canonical
      const meta = text.match(/<meta[^>]*>/gi);
      console.log('    Meta tags:', meta);
      const scripts = text.match(/<script[^>]*>[\s\S]*?<\/script>/gi);
      if (scripts) {
        console.log('    Scripts count:', scripts.length);
        scripts.forEach((s, idx) => console.log(`      Script ${idx}:`, s.slice(0, 300)));
      }
      break;
    }
    if (!loc) break;
    url = new URL(loc, url).href;
  }
}
trace().catch(console.error);
