-- ============================================================
-- 14_dashboard_perf_fix.sql
-- Fixes 500 errors on dashboard RPCs caused by query timeout
-- under load. Adds indexes + raises function-level statement_timeout.
-- Safe to re-run.
-- ============================================================

-- 1) Indexes for hot click queries (CONCURRENTLY runs outside txn)
--    Run each line one-by-one if needed. CREATE INDEX IF NOT EXISTS
--    is idempotent.

CREATE INDEX IF NOT EXISTS idx_clicks_link_created_bot
  ON public.clicks (link_id, created_at DESC, is_bot);

CREATE INDEX IF NOT EXISTS idx_clicks_link_ip_human
  ON public.clicks (link_id, ip)
  WHERE is_bot = false AND ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clicks_link_country_human
  ON public.clicks (link_id, country)
  WHERE is_bot = false;

CREATE INDEX IF NOT EXISTS idx_links_user
  ON public.links (user_id);

CREATE INDEX IF NOT EXISTS idx_daily_stats_link_day
  ON public.daily_stats (link_id, day DESC);

-- 2) Raise statement_timeout for the slow dashboard functions
--    (Supabase default for authenticated role is 8s — too low for
--     users with 200K+ clicks. 60s is safe; queries usually finish
--     in <10s after indexes.)

ALTER FUNCTION public.get_dashboard_stats(uuid)
  SET statement_timeout = '60s';

ALTER FUNCTION public.get_cohort_retention(uuid)
  SET statement_timeout = '60s';

ALTER FUNCTION public.admin_clicks_timeseries(integer)
  SET statement_timeout = '60s';

ALTER FUNCTION public.admin_user_trend(uuid, integer)
  SET statement_timeout = '60s';

-- 3) Refresh planner stats so new indexes are used immediately
ANALYZE public.clicks;
ANALYZE public.links;
ANALYZE public.daily_stats;
