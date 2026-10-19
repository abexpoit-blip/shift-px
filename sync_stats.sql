BEGIN;

-- Check counts before
SELECT 
  sum(clicks_count) as total_clicks_before,
  sum(human_clicks_count) as total_human_before
FROM links;

-- Update links clicks_count to match human_clicks_count
UPDATE links 
SET clicks_count = human_clicks_count 
WHERE human_clicks_count > clicks_count;

-- Check counts after
SELECT 
  sum(clicks_count) as total_clicks_after,
  sum(human_clicks_count) as total_human_after
FROM links;

-- Also sync profiles.clicks_used
UPDATE profiles p
SET clicks_used = sub.total_human
FROM (
  SELECT user_id, SUM(GREATEST(COALESCE(clicks_count, 0), COALESCE(human_clicks_count, 0))) as total_human
  FROM links
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id AND sub.total_human > COALESCE(p.clicks_used, 0);

SELECT sum(clicks_used) as total_profiles_clicks_used FROM profiles;

COMMIT;
