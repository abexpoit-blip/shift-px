-- Synchronize the new persistent counter columns with existing click data
UPDATE public.links l
SET 
  clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot), 0),
  bot_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND is_bot), 0),
  ours_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'ours'), 0),
  offer_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'offer'), 0);

-- Also ensure daily_stats are finalized for the persistent view
INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks)
SELECT 
  link_id, 
  created_at::date as day,
  COUNT(*) FILTER (WHERE NOT is_bot) as human_clicks,
  COUNT(*) FILTER (WHERE is_bot) as bot_clicks
FROM public.clicks
GROUP BY 1, 2
ON CONFLICT (link_id, day) DO UPDATE SET
  human_clicks = EXCLUDED.human_clicks,
  bot_clicks = EXCLUDED.bot_clicks;
