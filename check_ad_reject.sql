-- 1. Check recent Facebook crawler hits (last 24 hours)
SELECT 
  id, 
  ip, 
  country, 
  is_bot, 
  bot_reason, 
  bot_score, 
  routed_to, 
  LEFT(ua, 80) as ua_preview, 
  referer_host, 
  created_at 
FROM clicks 
WHERE ua ILIKE '%facebook%' OR referer_host ILIKE '%facebook%' OR ip LIKE '2a03:2880%' OR bot_reason ILIKE '%fb%'
ORDER BY created_at DESC 
LIMIT 30;

-- 2. Breakdown of bot_reason for today
SELECT bot_reason, count(*) 
FROM clicks 
WHERE created_at >= (now() - interval '24 hours')
GROUP BY bot_reason 
ORDER BY count(*) DESC 
LIMIT 20;

-- 3. Check if any bot or reviewer got routed to 'offer' or 'ours' instead of safe article!
SELECT count(*) as leaked_bots_to_offer
FROM clicks 
WHERE is_bot = true AND routed_to != 'safe' AND routed_to != 'article' AND created_at >= (now() - interval '48 hours');

-- 4. Check clicks routed to 'safe' vs 'offer' vs 'ours'
SELECT routed_to, is_bot, count(*) 
FROM clicks 
WHERE created_at >= (now() - interval '24 hours')
GROUP BY routed_to, is_bot;
