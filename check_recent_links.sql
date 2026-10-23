SELECT 
  l.id, 
  l.title, 
  l.short_code, 
  l.clicks_count, 
  l.bot_clicks_count, 
  l.created_at, 
  l.destination_url,
  l.prelanding_template
FROM links l
WHERE l.created_at >= (now() - interval '48 hours')
ORDER BY l.created_at DESC;
