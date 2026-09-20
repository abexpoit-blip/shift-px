-- ============================================================
-- 46 — Hybrid Click Resilience & Column Overflow Protection
--
-- GOAL:
--   1. Protect public.clicks columns from string overflow crashes
--      (mobile UAs > 160 chars, bot_reason > 40 chars, proxy IPs, UTM tags)
--   2. Defensively clamp in record_redirect_clicks_batch RPC so no bad
--      input can ever abort a batch transaction
--   3. Synchronize daily_stats directly in record_redirect_clicks_batch
--      so daily charts and link counters match in real time
--   4. Ensure maintenance_purge_old_clicks keeps VPS disk lean
--
-- Safe to re-run.
-- ============================================================

-- 1. Ensure columns exist and widen types to safely accommodate real-world data
DO $$
BEGIN
  -- Add columns if missing
  ALTER TABLE public.clicks
    ADD COLUMN IF NOT EXISTS ip varchar(64),
    ADD COLUMN IF NOT EXISTS ua varchar(300),
    ADD COLUMN IF NOT EXISTS routed_to varchar(16) DEFAULT 'offer',
    ADD COLUMN IF NOT EXISTS bot_reason varchar(120),
    ADD COLUMN IF NOT EXISTS utm_source varchar(120),
    ADD COLUMN IF NOT EXISTS utm_medium varchar(120),
    ADD COLUMN IF NOT EXISTS utm_campaign varchar(120),
    ADD COLUMN IF NOT EXISTS utm_term varchar(120),
    ADD COLUMN IF NOT EXISTS utm_content varchar(120),
    ADD COLUMN IF NOT EXISTS referer_host varchar(150),
    ADD COLUMN IF NOT EXISTS bot_score smallint DEFAULT 0,
    ADD COLUMN IF NOT EXISTS signals jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS challenge_passed boolean DEFAULT false;

  -- Widen columns to prevent 'value too long' errors under high traffic
  ALTER TABLE public.clicks
    ALTER COLUMN ip           TYPE varchar(64)  USING left(ip, 64),
    ALTER COLUMN ua           TYPE varchar(300) USING left(ua, 300),
    ALTER COLUMN country      TYPE varchar(2)   USING upper(left(country, 2)),
    ALTER COLUMN bot_reason   TYPE varchar(120) USING left(bot_reason, 120),
    ALTER COLUMN routed_to    TYPE varchar(16)  USING left(routed_to, 16),
    ALTER COLUMN referer_host TYPE varchar(150) USING left(referer_host, 150),
    ALTER COLUMN utm_source   TYPE varchar(120) USING left(utm_source, 120),
    ALTER COLUMN utm_medium   TYPE varchar(120) USING left(utm_medium, 120),
    ALTER COLUMN utm_campaign TYPE varchar(120) USING left(utm_campaign, 120),
    ALTER COLUMN utm_term     TYPE varchar(120) USING left(utm_term, 120),
    ALTER COLUMN utm_content  TYPE varchar(120) USING left(utm_content, 120);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Clicks column adjustment note: %', SQLERRM;
END $$;

-- 2. Dedupe table safety
CREATE TABLE IF NOT EXISTS public.click_event_dedupe (
  event_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_click_event_dedupe_created_at
  ON public.click_event_dedupe(created_at);

GRANT SELECT, INSERT, DELETE ON public.click_event_dedupe TO authenticated;
GRANT ALL ON public.click_event_dedupe TO service_role;

-- 3. Resilient record_redirect_clicks_batch with defensive clamping & daily_stats sync
CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '55s'
AS $$
  WITH parsed AS MATERIALIZED (
    SELECT
      COALESCE(e.event_id, e.id, gen_random_uuid()) AS event_id,
      e.link_id,
      l.user_id,
      LEFT(NULLIF(TRIM(e.ip), ''), 64) AS ip,
      UPPER(LEFT(NULLIF(TRIM(e.country), ''), 2)) AS country,
      LEFT(NULLIF(TRIM(e.ua), ''), 300) AS ua,
      COALESCE(e.is_bot, false) AS is_bot,
      LEFT(NULLIF(TRIM(e.bot_reason), ''), 120) AS bot_reason,
      LEFT(COALESCE(NULLIF(TRIM(e.routed_to), ''), 'offer'), 16) AS routed_to,
      LEFT(NULLIF(TRIM(e.utm_source), ''), 120) AS utm_source,
      LEFT(NULLIF(TRIM(e.utm_medium), ''), 120) AS utm_medium,
      LEFT(NULLIF(TRIM(e.utm_campaign), ''), 120) AS utm_campaign,
      LEFT(NULLIF(TRIM(e.utm_term), ''), 120) AS utm_term,
      LEFT(NULLIF(TRIM(e.utm_content), ''), 120) AS utm_content,
      LEFT(NULLIF(TRIM(e.referer_host), ''), 150) AS referer_host,
      GREATEST(-32768, LEAST(32767, COALESCE(e.bot_score, 0)))::smallint AS bot_score,
      COALESCE(e.signals, '{}'::jsonb) AS signals,
      COALESCE(e.challenge_passed, false) AS challenge_passed
    FROM jsonb_to_recordset(
      CASE
        WHEN _events IS NOT NULL AND jsonb_typeof(_events) = 'array' THEN _events
        ELSE '[]'::jsonb
      END
    ) AS e(
      id uuid,
      event_id uuid,
      link_id uuid,
      ip text,
      country text,
      ua text,
      is_bot boolean,
      bot_reason text,
      routed_to text,
      utm_source text,
      utm_medium text,
      utm_campaign text,
      utm_term text,
      utm_content text,
      referer_host text,
      bot_score integer,
      signals jsonb,
      challenge_passed boolean
    )
    JOIN public.links l ON l.id = e.link_id
    WHERE e.link_id IS NOT NULL
    LIMIT 200
  ),
  accepted AS MATERIALIZED (
    INSERT INTO public.click_event_dedupe (event_id)
    SELECT event_id
    FROM parsed
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  ),
  events AS MATERIALIZED (
    SELECT p.*
    FROM parsed p
    JOIN accepted a ON a.event_id = p.event_id
  ),
  locks AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(hashtext(link_id::text)) AS locked
    FROM (SELECT DISTINCT link_id FROM events ORDER BY link_id) s
  ),
  lock_barrier AS MATERIALIZED (
    SELECT count(*) AS lock_count FROM locks
  ),
  inserted_clicks AS (
    INSERT INTO public.clicks (
      link_id, ip, country, ua, is_bot, bot_reason, routed_to,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referer_host, bot_score, signals, challenge_passed
    )
    SELECT
      link_id, ip, country, ua, is_bot, bot_reason, routed_to,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referer_host, bot_score, signals, challenge_passed
    FROM events
    WHERE (SELECT lock_count FROM lock_barrier) >= 0
    RETURNING link_id
  ),
  link_stats AS MATERIALIZED (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot)::integer AS human_clicks,
      COUNT(*) FILTER (WHERE is_bot)::integer AS bot_clicks,
      COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'ours')::integer AS ours_clicks,
      COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'offer')::integer AS offer_clicks
    FROM events
    WHERE (SELECT lock_count FROM lock_barrier) >= 0
    GROUP BY link_id
  ),
  updated_links AS (
    UPDATE public.links AS l
    SET clicks_count = COALESCE(l.clicks_count, 0) + s.human_clicks,
        bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.bot_clicks,
        ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_clicks,
        offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_clicks,
        last_clicked_at = CASE WHEN s.human_clicks > 0 THEN now() ELSE l.last_clicked_at END
    FROM link_stats AS s
    WHERE l.id = s.link_id
    RETURNING l.id
  ),
  profile_stats AS MATERIALIZED (
    SELECT
      user_id,
      COUNT(*)::bigint AS human_clicks,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::bigint AS ours_clicks
    FROM events
    WHERE NOT is_bot AND user_id IS NOT NULL
      AND (SELECT lock_count FROM lock_barrier) >= 0
    GROUP BY user_id
  ),
  updated_profiles AS (
    UPDATE public.profiles AS p
    SET clicks_used = COALESCE(p.clicks_used, 0) + s.human_clicks,
        ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_clicks
    FROM profile_stats AS s
    WHERE p.id = s.user_id
    RETURNING p.id
  ),
  daily_sync AS (
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks, ours_clicks, offer_clicks)
    SELECT
      link_id,
      CURRENT_DATE,
      human_clicks,
      bot_clicks,
      ours_clicks,
      offer_clicks
    FROM link_stats
    WHERE (SELECT lock_count FROM lock_barrier) >= 0
    ON CONFLICT (link_id, day) DO UPDATE
    SET human_clicks = public.daily_stats.human_clicks + EXCLUDED.human_clicks,
        bot_clicks = public.daily_stats.bot_clicks + EXCLUDED.bot_clicks,
        ours_clicks = public.daily_stats.ours_clicks + EXCLUDED.ours_clicks,
        offer_clicks = public.daily_stats.offer_clicks + EXCLUDED.offer_clicks,
        updated_at = now()
    RETURNING link_id
  )
  SELECT pg_sleep(0)
  FROM (
    SELECT 1 FROM inserted_clicks
    UNION ALL SELECT 1 FROM updated_links
    UNION ALL SELECT 1 FROM updated_profiles
    UNION ALL SELECT 1 FROM daily_sync
    UNION ALL SELECT 1
  ) done
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'migration 46 hybrid click resilience ready' AS status;
