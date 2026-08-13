-- Fix 1: lifetime/unlimited plans should have NULL quota (means unlimited)
UPDATE public.profiles
SET click_quota = NULL, link_quota = NULL
WHERE plan_slug IN ('lifetime', 'unlimited');

-- Fix 2: Resync profiles.clicks_used from links table (source of truth)
UPDATE public.profiles p
SET clicks_used = COALESCE(sub.total, 0),
    ours_clicks = COALESCE(sub.ours, 0)
FROM (
  SELECT user_id,
         SUM(clicks_count) AS total,
         SUM(ours_clicks_count) AS ours
  FROM public.links
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id;

-- Fix 3: Resync links_used count
UPDATE public.profiles p
SET links_used = COALESCE((SELECT COUNT(*) FROM public.links WHERE user_id = p.id), 0);