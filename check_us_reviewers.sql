SELECT 
  id, 
  ip, 
  country, 
  is_bot, 
  bot_reason, 
  routed_to, 
  referer_host, 
  LEFT(ua, 60) as ua_short, 
  created_at 
FROM clicks 
WHERE country IN ('US', 'IE', 'GB', 'SG', 'PH') AND created_at >= (now() - interval '24 hours')
ORDER BY created_at DESC 
LIMIT 30;
