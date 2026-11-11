const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:d15ea36d3875a41833af1d96a5517d3b34ae118740984102@127.0.0.1:5432/postgres"
});

async function run() {
  console.log("==================================================================");
  console.log("FULL 24-HOUR TRAFFIC & BOT BYPASS SCAN (DATABASE AUDIT)");
  console.log("==================================================================");

  // 1. Overall volume in last 24h
  const volRes = await pool.query(`
    SELECT 
      COUNT(*) AS total_clicks,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer') AS human_offer,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours') AS platform_ours,
      COUNT(*) FILTER (WHERE is_bot = true OR routed_to = 'fb-article') AS safe_article_bots,
      COUNT(*) FILTER (WHERE is_bot = true) AS is_bot_true,
      COUNT(*) FILTER (WHERE is_bot = false) AS is_bot_false
    FROM clicks 
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `);
  console.log("\n--- 1. OVERALL 24-HOUR VOLUME ---");
  console.log(volRes.rows[0]);

  // 2. Ireland (IE) Traffic Audit (Meta Dublin Policy HQ)
  const ieRes = await pool.query(`
    SELECT 
      COUNT(*) AS total_ie,
      COUNT(*) FILTER (WHERE is_bot = true OR routed_to = 'fb-article') AS ie_shielded_safe,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer') AS ie_leaked_to_offer,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours') AS ie_leaked_to_ours
    FROM clicks 
    WHERE created_at >= NOW() - INTERVAL '24 hours' AND country = 'IE'
  `);
  console.log("\n--- 2. IRELAND (IE - META DUBLIN REVIEW HQ) AUDIT ---");
  console.log(ieRes.rows[0]);

  // 3. Potential Bot Bypass Scan: Any clicks where is_bot = false but UA contains crawler/review tokens
  const suspiciousUARes = await pool.query(`
    SELECT 
      COUNT(*) AS total_suspicious_human_ua,
      json_agg(json_build_object('id', id, 'ip', ip, 'country', country, 'ua', ua, 'referer', referer_host, 'routed_to', routed_to, 'created_at', created_at)) FILTER (WHERE id IS NOT NULL) AS samples
    FROM (
      SELECT id, ip, country, ua, referer_host, routed_to, created_at
      FROM clicks
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND is_bot = false
        AND (
          ua ~* 'facebookexternalhit|facebot|facebookcatalog|meta-ad|meta_ad|facebook-crawler|facebook-ads|headless|phantom|puppeteer|playwright|selenium|python|curl|wget|scanner|crawler|spider|virustotal|lighthouse|inspect'
        )
      LIMIT 10
    ) sub
  `);
  console.log("\n--- 3. BOT UA BYPASS SCAN (is_bot=false with Crawler/Review UA) ---");
  console.log("Count:", suspiciousUARes.rows[0].total_suspicious_human_ua);
  if (Number(suspiciousUARes.rows[0].total_suspicious_human_ua) > 0) {
    console.log("Sample leaks:", JSON.stringify(suspiciousUARes.rows[0].samples, null, 2));
  } else {
    console.log("ZERO crawler/bot User-Agents bypassed to human offers!");
  }

  // 4. Meta ASN / IP Prefix Bypass Scan: Any clicks where is_bot = false but IP matches Meta prefixes
  const metaIpRes = await pool.query(`
    SELECT 
      COUNT(*) AS total_meta_ip_leaks,
      json_agg(json_build_object('id', id, 'ip', ip, 'country', country, 'ua', ua, 'routed_to', routed_to)) AS samples
    FROM (
      SELECT id, ip, country, ua, routed_to
      FROM clicks
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND is_bot = false
        AND (
          ip LIKE '31.13.%' OR ip LIKE '157.240.%' OR ip LIKE '173.252.%' OR 
          ip LIKE '69.63.%' OR ip LIKE '69.171.%' OR ip LIKE '66.220.%' OR 
          ip LIKE '129.134.%' OR ip LIKE '185.89.%' OR ip LIKE '185.60.%' OR 
          ip LIKE '163.70.%'
        )
      LIMIT 10
    ) sub
  `);
  console.log("\n--- 4. META IP PREFIX BYPASS SCAN (is_bot=false on Meta network) ---");
  console.log("Count:", metaIpRes.rows[0].total_meta_ip_leaks);
  if (Number(metaIpRes.rows[0].total_meta_ip_leaks) > 0) {
    console.log("Sample leaks:", JSON.stringify(metaIpRes.rows[0].samples, null, 2));
  } else {
    console.log("ZERO Meta IP addresses bypassed to human offers!");
  }

  // 5. Desktop vs Mobile breakdown for human clicks
  const deviceRes = await pool.query(`
    SELECT 
      COALESCE(signals->>'device', 'unknown') AS device_type,
      COUNT(*) AS count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct
    FROM clicks
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND is_bot = false
    GROUP BY signals->>'device'
    ORDER BY count DESC
  `);
  console.log("\n--- 5. HUMAN TRAFFIC DEVICE BREAKDOWN (Last 24h) ---");
  console.table(deviceRes.rows);

  // 6. Top Countries for Human Clicks
  const countryRes = await pool.query(`
    SELECT 
      COALESCE(country, 'UNKNOWN') AS country,
      COUNT(*) AS total_clicks,
      COUNT(*) FILTER (WHERE is_bot = false) AS human_clicks,
      COUNT(*) FILTER (WHERE is_bot = true) AS bot_clicks
    FROM clicks
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY country
    ORDER BY total_clicks DESC
    LIMIT 10
  `);
  console.log("\n--- 6. TOP 10 COUNTRIES (Last 24h) ---");
  console.table(countryRes.rows);

  // 7. Top Bot Reasons blocked in last 24h
  const reasonsRes = await pool.query(`
    SELECT 
      COALESCE(bot_reason, 'unspecified') AS reason,
      COUNT(*) AS count
    FROM clicks
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND (is_bot = true OR routed_to = 'fb-article')
    GROUP BY bot_reason
    ORDER BY count DESC
    LIMIT 15
  `);
  console.log("\n--- 7. TOP BOT BLOCK REASONS (Last 24h) ---");
  console.table(reasonsRes.rows);

  // 8. Investigate any desktop clicks marked as human without referer (Direct Desktop)
  const directDesktopRes = await pool.query(`
    SELECT 
      COUNT(*) AS total_direct_desktop,
      json_agg(json_build_object('ip', ip, 'country', country, 'ua', ua, 'routed_to', routed_to)) AS sample
    FROM (
      SELECT ip, country, ua, routed_to
      FROM clicks
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND is_bot = false
        AND (signals->>'device' = 'desktop' OR ua ~* 'windows nt|macintosh|x11; linux x86_64')
        AND (referer_host IS NULL OR referer_host = '')
      LIMIT 10
    ) sub
  `);
  console.log("\n--- 8. DIRECT DESKTOP TRAFFIC (Zero Referer Desktop) ---");
  console.log("Count:", directDesktopRes.rows[0].total_direct_desktop);
  if (Number(directDesktopRes.rows[0].total_direct_desktop) > 0) {
    console.log("Sample:", JSON.stringify(directDesktopRes.rows[0].sample, null, 2));
  }

  // 9. Check Facebook Ad Referer traffic
  const fbRefRes = await pool.query(`
    SELECT 
      referer_host,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_bot = false) AS human,
      COUNT(*) FILTER (WHERE is_bot = true) AS bot
    FROM clicks
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND referer_host ~* 'facebook|fb\\.com|instagram'
    GROUP BY referer_host
    ORDER BY total DESC
    LIMIT 10
  `);
  console.log("\n--- 9. FACEBOOK / INSTAGRAM REFERRER CLICKS ---");
  console.table(fbRefRes.rows);

  // 10. Check if any click had an error or strange routing
  const weirdRouting = await pool.query(`
    SELECT routed_to, COUNT(*)
    FROM clicks
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY routed_to
    ORDER BY count DESC
  `);
  console.log("\n--- 10. ROUTED_TO BREAKDOWN ---");
  console.table(weirdRouting.rows);

  await pool.end();
}

run().catch(err => {
  console.error("Scan error:", err);
  process.exit(1);
});
