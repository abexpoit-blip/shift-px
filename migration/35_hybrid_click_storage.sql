-- ============================================================
-- 35 — Hybrid click storage + slim columns (12 core / 48 GB box)
--
--  GOAL
--   * Raw `clicks` rows stay HOT for 7 days only (fast queries, small heap)
--   * Every dimension we care about (day, country, device, browser,
--     traffic source, bot/human) is rolled up into `click_dim_daily`
--     BEFORE the raw rows are purged → lifetime history, tiny footprint
--   * Row width of `clicks` is cut hard so the same RAM/disk holds many
--     times more live traffic
--
--  Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Slim the hot table: drop dead / duplicated columns
--    ip_address + user_agent were superseded by ip + ua (mig 31).
--    device/browser/os/city/variant/referer/fingerprint_hash were never
--    written by the fast click RPC (mig 25) — they are pure dead weight.
-- ------------------------------------------------------------

ALTER TABLE public.clicks
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS user_agent,
  DROP COLUMN IF EXISTS referer,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS os,
  DROP COLUMN IF EXISTS device,
  DROP COLUMN IF EXISTS browser,
  DROP COLUMN IF EXISTS variant,
  DROP COLUMN IF EXISTS fingerprint_hash;

-- ------------------------------------------------------------
-- 2. Cap the remaining text columns (bounded = predictable row width)
-- ------------------------------------------------------------

DO $$
BEGIN
  ALTER TABLE public.clicks
    ALTER COLUMN ua           TYPE varchar(160) USING left(ua, 160),
    ALTER COLUMN ip           TYPE varchar(45)  USING left(ip, 45),
    ALTER COLUMN country      TYPE varchar(2)   USING upper(left(country, 2)),
    ALTER COLUMN bot_reason   TYPE varchar(40)  USING left(bot_reason, 40),
    ALTER COLUMN routed_to    TYPE varchar(8)   USING left(routed_to, 8),
    ALTER COLUMN referer_host TYPE varchar(96)  USING left(referer_host, 96),
    ALTER COLUMN utm_source   TYPE varchar(48)  USING left(utm_source, 48),
    ALTER COLUMN utm_medium   TYPE varchar(48)  USING left(utm_medium, 48),
    ALTER COLUMN utm_campaign TYPE varchar(48)  USING left(utm_campaign, 48),
    ALTER COLUMN utm_term     TYPE varchar(48)  USING left(utm_term, 48),
    ALTER COLUMN utm_content  TYPE varchar(48)  USING left(utm_content, 48);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'clicks column narrowing skipped: %', SQLERRM;
END $$;

-- bot_score never exceeds a few hundred
DO $$
BEGIN
  ALTER TABLE public.clicks ALTER COLUMN bot_score TYPE smallint
    USING greatest(-32768, least(32767, bot_score))::smallint;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 3. Storage / vacuum tuning for a high-insert, short-lived table
-- ------------------------------------------------------------

ALTER TABLE public.clicks SET (
  fillfactor = 100,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_limit = 2000
);

-- append-only timestamp → BRIN is ~1000x smaller than btree here
CREATE INDEX IF NOT EXISTS clicks_created_brin
  ON public.clicks USING brin (created_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS clicks_link_created_idx
  ON public.clicks (link_id, created_at DESC);

-- ------------------------------------------------------------
-- 4. HYBRID ARCHIVE — per-day dimension rollup, kept forever
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.click_dim_daily (
  day      date         NOT NULL,
  link_id  uuid         NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  user_id  uuid         NOT NULL,
  country  varchar(2)   NOT NULL DEFAULT '--',
  device   varchar(8)   NOT NULL DEFAULT 'other',
  browser  varchar(12)  NOT NULL DEFAULT 'other',
  source   varchar(12)  NOT NULL DEFAULT 'direct',
  is_bot   boolean      NOT NULL DEFAULT false,
  clicks   integer      NOT NULL DEFAULT 0,
  PRIMARY KEY (day, link_id, country, device, browser, source, is_bot)
);

CREATE INDEX IF NOT EXISTS click_dim_daily_user_day_idx
  ON public.click_dim_daily (user_id, day DESC);
CREATE INDEX IF NOT EXISTS click_dim_daily_link_day_idx
  ON public.click_dim_daily (link_id, day DESC);

GRANT SELECT ON public.click_dim_daily TO authenticated;
GRANT ALL    ON public.click_dim_daily TO service_role;

ALTER TABLE public.click_dim_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own click dims" ON public.click_dim_daily;
CREATE POLICY "own click dims" ON public.click_dim_daily
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 5. Rollup routine (idempotent, monotonic)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rollup_click_dims(_days integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO public.click_dim_daily AS d
    (day, link_id, user_id, country, device, browser, source, is_bot, clicks)
  SELECT
    (c.created_at AT TIME ZONE 'UTC')::date                     AS day,
    c.link_id,
    l.user_id,
    COALESCE(NULLIF(upper(left(c.country, 2)), ''), '--')        AS country,
    CASE
      WHEN c.ua ~* 'ipad|tablet'                       THEN 'tablet'
      WHEN c.ua ~* 'mobi|android|iphone|ipod'          THEN 'mobile'
      WHEN c.ua IS NULL OR c.ua = ''                   THEN 'other'
      ELSE 'desktop'
    END                                                          AS device,
    CASE
      WHEN c.ua ~* 'edg/'                              THEN 'edge'
      WHEN c.ua ~* 'opr/|opera'                        THEN 'opera'
      WHEN c.ua ~* 'samsungbrowser'                    THEN 'samsung'
      WHEN c.ua ~* 'firefox|fxios'                     THEN 'firefox'
      WHEN c.ua ~* 'chrome|crios'                      THEN 'chrome'
      WHEN c.ua ~* 'safari'                            THEN 'safari'
      ELSE 'other'
    END                                                          AS browser,
    CASE
      WHEN c.referer_host IS NULL OR c.referer_host = '' THEN 'direct'
      WHEN c.referer_host ~* 'facebook|fb\.'           THEN 'facebook'
      WHEN c.referer_host ~* 'instagram'               THEN 'instagram'
      WHEN c.referer_host ~* 'tiktok'                  THEN 'tiktok'
      WHEN c.referer_host ~* 'youtube|youtu\.be'       THEN 'youtube'
      WHEN c.referer_host ~* 'twitter|x\.com|t\.co'    THEN 'twitter'
      WHEN c.referer_host ~* 't\.me|telegram'          THEN 'telegram'
      WHEN c.referer_host ~* 'whatsapp|wa\.me'         THEN 'whatsapp'
      WHEN c.referer_host ~* 'google'                  THEN 'google'
      ELSE 'other'
    END                                                          AS source,
    c.is_bot,
    count(*)::integer
  FROM public.clicks c
  JOIN public.links l ON l.id = c.link_id
  WHERE c.created_at >= (now() - make_interval(days => greatest(_days, 1)))
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
  ON CONFLICT (day, link_id, country, device, browser, source, is_bot)
  DO UPDATE SET clicks = GREATEST(d.clicks, EXCLUDED.clicks);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollup_click_dims(integer) TO service_role;

-- ------------------------------------------------------------
-- 6. Weekly purge = lifetime totals + dimension rollup, THEN drop raw
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.maintenance_purge_old_clicks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  -- 1. lifetime totals (never shrink)
  PERFORM public.archive_lifetime_stats();

  -- 2. per-day dimension history (country / device / browser / source)
  PERFORM public.rollup_click_dims(14);

  -- 3. batched delete of raw rows older than 7 days
  LOOP
    DELETE FROM public.clicks
    WHERE ctid IN (
      SELECT ctid FROM public.clicks
      WHERE created_at < now() - interval '7 days'
      LIMIT 5000
    );
    GET DIAGNOSTICS removed = ROW_COUNT;
    EXIT WHEN removed = 0;
  END LOOP;

  DELETE FROM public.error_logs WHERE created_at < now() - interval '30 days';

  -- links, profiles, daily_stats, click_dim_daily, lifetime stats,
  -- earnings and withdrawals are NEVER touched.
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_purge_old_clicks() TO service_role;

-- ------------------------------------------------------------
-- 7. Backfill the archive from whatever raw data still exists
-- ------------------------------------------------------------

SELECT public.rollup_click_dims(30);

ANALYZE public.clicks;
ANALYZE public.click_dim_daily;

NOTIFY pgrst, 'reload schema';
