-- ============================================================
-- 45 — Reconcile click counts and unblock default US/IE/DK country shields
--
--  PURPOSE:
--   1. Reclassify falsely flagged clicks in `public.clicks` that were
--      marked as bot due to Apple iCloud Private Relay, Facebook ASN edge,
--      or automatic country shields on real mobile browsers.
--   2. Clean up existing links that had default `blocked_countries` = ['US', 'IE', 'DK']
--      so genuine US/tier-1 visitors are no longer blocked.
--   3. Reconcile `public.links.clicks_count` & `public.links.bot_clicks_count`
--      so legitimate human traffic is counted in lifetime totals.
--   4. Reconcile `public.profiles.clicks_used`.
--   5. Invalidate `dashboard_cache` so users see live, corrected numbers immediately.
--
--  Safe to re-run.
-- ============================================================

-- 1. Remove unintended default country block from existing links
UPDATE public.links
SET blocked_countries = '{}'::text[]
WHERE blocked_countries = ARRAY['US', 'IE', 'DK']::text[]
   OR blocked_countries = ARRAY['US']::text[]
   OR (array_length(blocked_countries, 1) = 3 AND 'US' = ANY(blocked_countries) AND 'IE' = ANY(blocked_countries) AND 'DK' = ANY(blocked_countries));

-- 2. Restore misclassified human clicks in public.clicks
UPDATE public.clicks
SET is_bot = false,
    bot_reason = 'restored_human'
WHERE is_bot = true
  AND (
    bot_reason IN (
      'country-shield:US',
      'country-shield:IE',
      'country-shield:DK',
      'dc-asn:13335',
      'dc-asn:54113',
      'dc-asn:32934',
      'dc-asn:63293',
      'dc-asn:54115',
      'dc-asn:15169',
      'dc-asn:8075'
    )
    OR (bot_reason = 'fb-asn' AND ua ~* 'iphone|ipad|android|mobile|safari|chrome|fban|fbav')
  )
  AND ua ~* 'iphone|ipad|android|mobile|safari|chrome|fban|fbav';

-- 3. Reconcile links click counts with verified clicks
WITH click_counts AS (
  SELECT
    link_id,
    COUNT(*) FILTER (WHERE NOT is_bot)::integer AS verified_human,
    COUNT(*) FILTER (WHERE is_bot)::integer AS verified_bot
  FROM public.clicks
  GROUP BY link_id
)
UPDATE public.links l
SET clicks_count = GREATEST(COALESCE(l.clicks_count, 0), c.verified_human),
    bot_clicks_count = GREATEST(COALESCE(l.bot_clicks_count, 0), c.verified_bot)
FROM click_counts c
WHERE l.id = c.link_id;

-- 4. Reconcile profiles clicks_used
WITH user_clicks AS (
  SELECT
    user_id,
    SUM(COALESCE(clicks_count, 0))::bigint AS total_user_clicks
  FROM public.links
  GROUP BY user_id
)
UPDATE public.profiles p
SET clicks_used = GREATEST(COALESCE(p.clicks_used, 0), uc.total_user_clicks)
FROM user_clicks uc
WHERE p.id = uc.user_id;

-- 5. Clear dashboard cache so users see fresh counts immediately
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dashboard_cache') THEN
    DELETE FROM public.dashboard_cache;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 45: Click reconciliation and country unblocking complete' AS status;
