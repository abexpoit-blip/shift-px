SELECT 
  sum(clicks_count) as total_clicks_count,
  sum(human_clicks_count) as total_human_clicks_count,
  sum(bot_clicks_count) as total_bot_clicks_count,
  sum(offer_clicks_count) as total_offer_clicks_count,
  sum(ours_clicks_count) as total_ours_clicks_count,
  count(*) as total_links
FROM links;

SELECT 
  sum(clicks_used) as total_profiles_clicks_used,
  sum(balance_available) as total_balance_available,
  count(*) as total_users
FROM profiles;
