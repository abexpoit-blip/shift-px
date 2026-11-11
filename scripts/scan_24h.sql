-- ==================================================================
-- FULL 24-HOUR TRAFFIC & BOT BYPASS SCAN
-- ==================================================================

\echo '--- 1. OVERALL 24-HOUR VOLUME ---'
SELECT 
  COUNT(*) AS total_clicks,
  COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer') AS human_offer,
  COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours') AS platform_ours,
  COUNT(*) FILTER (WHERE is_bot = true OR routed_to = 'fb-article') AS safe_article_bots,
  COUNT(*) FILTER (WHERE is_bot = true) AS is_bot_true,
  COUNT(*) FILTER (WHERE is_bot = false) AS is_bot_false
FROM clicks 
WHERE created_at >= NOW() - INTERVAL '24 hours';

\echo '--- 2. IRELAND (IE - META DUBLIN REVIEW HQ) AUDIT ---'
SELECT 
  COUNT(*) AS total_ie,
  COUNT(*) FILTER (WHERE is_bot = true OR routed_to = 'fb-article') AS ie_shielded_safe,
  COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer') AS ie_leaked_to_offer,
  COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours') AS ie_leaked_to_ours
FROM clicks 
WHERE created_at >= NOW() - INTERVAL '24 hours' AND country = 'IE';

\echo '--- 3. BOT UA BYPASS SCAN (is_bot=false with Crawler/Review UA) ---'
SELECT 
  COUNT(*) AS total_suspicious_human_ua
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND is_bot = false
  AND (
    ua ~* 'facebookexternalhit|facebot|facebookcatalog|meta-ad|meta_ad|facebook-crawler|facebook-ads|headless|phantom|puppeteer|playwright|selenium|python|curl|wget|scanner|crawler|spider|virustotal|lighthouse|inspect'
  );

\echo '--- 3b. DETAILS OF ANY SUSPICIOUS UA MARKED AS HUMAN ---'
SELECT id, ip, country, substring(ua from 1 for 60) AS ua_short, referer_host, routed_to, created_at
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND is_bot = false
  AND (
    ua ~* 'facebookexternalhit|facebot|facebookcatalog|meta-ad|meta_ad|facebook-crawler|facebook-ads|headless|phantom|puppeteer|playwright|selenium|python|curl|wget|scanner|crawler|spider|virustotal|lighthouse|inspect'
  )
LIMIT 10;

\echo '--- 4. META IP PREFIX BYPASS SCAN (is_bot=false on Meta network) ---'
SELECT 
  COUNT(*) AS total_meta_ip_leaks
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND is_bot = false
  AND (
    ip LIKE '31.13.%' OR ip LIKE '157.240.%' OR ip LIKE '173.252.%' OR 
    ip LIKE '69.63.%' OR ip LIKE '69.171.%' OR ip LIKE '66.220.%' OR 
    ip LIKE '129.134.%' OR ip LIKE '185.89.%' OR ip LIKE '185.60.%' OR 
    ip LIKE '163.70.%'
  );

\echo '--- 5. HUMAN TRAFFIC DEVICE BREAKDOWN (Last 24h) ---'
SELECT 
  COALESCE(signals->>'device', 'unknown') AS device_type,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND is_bot = false
GROUP BY signals->>'device'
ORDER BY count DESC;

\echo '--- 6. TOP 10 COUNTRIES FOR HUMAN CLICKS (Last 24h) ---'
SELECT 
  COALESCE(country, 'UNKNOWN') AS country,
  COUNT(*) AS total_clicks,
  COUNT(*) FILTER (WHERE is_bot = false) AS human_clicks,
  COUNT(*) FILTER (WHERE is_bot = true) AS bot_clicks
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY country
ORDER BY total_clicks DESC
LIMIT 10;

\echo '--- 7. TOP BOT BLOCK REASONS (Last 24h) ---'
SELECT 
  COALESCE(bot_reason, 'unspecified') AS reason,
  COUNT(*) AS count
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND (is_bot = true OR routed_to = 'fb-article')
GROUP BY bot_reason
ORDER BY count DESC
LIMIT 15;

\echo '--- 8. DIRECT DESKTOP TRAFFIC (Zero Referer Desktop) ---'
SELECT 
  COUNT(*) AS total_direct_desktop
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND is_bot = false
  AND (signals->>'device' = 'desktop' OR ua ~* 'windows nt|macintosh|x11; linux x86_64')
  AND (referer_host IS NULL OR referer_host = '');

\echo '--- 9. FACEBOOK / INSTAGRAM REFERRER CLICKS ---'
SELECT 
  referer_host,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_bot = false) AS human,
  COUNT(*) FILTER (WHERE is_bot = true) AS bot
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND referer_host ~* 'facebook|fb\.com|instagram'
GROUP BY referer_host
ORDER BY total DESC
LIMIT 10;

\echo '--- 10. ROUTED_TO BREAKDOWN ---'
SELECT routed_to, COUNT(*)
FROM clicks
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY routed_to
ORDER BY count DESC;
