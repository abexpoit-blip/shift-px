SELECT 
  id, 
  ip, 
  country, 
  is_bot, 
  bot_reason, 
  bot_score, 
  routed_to, 
  referer_host, 
  LEFT(ua, 80) as ua_short, 
  created_at 
FROM clicks 
WHERE link_id IN ('b9ea1cb5-8227-41ef-a896-133f0bf1a604', '093476bc-bffe-424b-adea-0e3e09934e22', 'd3593490-45f5-4703-b33f-9934b6415d4c')
ORDER BY created_at DESC 
LIMIT 30;
