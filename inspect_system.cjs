const fs = require('fs');
const https = require('https');

// Load .env from /var/www/swiftpx/.env
const envFile = fs.readFileSync('/var/www/swiftpx/.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", SUPABASE_URL);

async function sbQuery(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUPABASE_URL);
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log("=== 1. SEARCH FOR 'Nasim' or '19OTC' IN links TABLE ===");
  const resLinks = await sbQuery('/rest/v1/links?or=(title.ilike.*Nasim*,title.ilike.*19OTC*,short_code.ilike.*Nasim*,short_code.ilike.*19OTC*)&select=id,title,short_code,user_id,original_url,clicks_count,human_clicks_count,bot_clicks_count,created_at,updated_at');
  console.log("Found links:", JSON.stringify(resLinks.data, null, 2));

  console.log("\n=== 2. SEARCH IN google_links TABLE ===");
  const resGLinks = await sbQuery('/rest/v1/google_links?or=(title.ilike.*Nasim*,title.ilike.*19OTC*,google_url.ilike.*Nasim*,google_url.ilike.*19OTC*)&select=id,title,google_url,short_url,target_url,clicks_count,human_clicks_count,created_at,updated_at');
  console.log("Found google_links:", JSON.stringify(resGLinks.data, null, 2));

  console.log("\n=== 3. RECENT LINKS (LAST 10) ===");
  const recentLinks = await sbQuery('/rest/v1/links?select=id,title,short_code,original_url,clicks_count,human_clicks_count,created_at&order=created_at.desc&limit=10');
  console.log("Recent links:", JSON.stringify(recentLinks.data, null, 2));

  console.log("\n=== 4. RECENT GOOGLE LINKS (LAST 5) ===");
  const recentGLinks = await sbQuery('/rest/v1/google_links?select=id,title,google_url,short_url,clicks_count,human_clicks_count,created_at&order=created_at.desc&limit=5');
  console.log("Recent google_links:", JSON.stringify(recentGLinks.data, null, 2));

  console.log("\n=== 5. CHECK RECENT CLICKS IN clicks TABLE ===");
  const recentClicks = await sbQuery('/rest/v1/clicks?select=id,link_id,is_bot,device,country,created_at&order=created_at.desc&limit=10');
  console.log("Recent clicks (last 10):", JSON.stringify(recentClicks.data, null, 2));
}

run().catch(console.error);
