ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.analytics_cache SET days = 7 WHERE days IS NULL;
DELETE FROM public.analytics_cache WHERE user_id IS NULL OR days IS NULL;

WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY user_id, days
           ORDER BY COALESCE(updated_at, '-infinity'::timestamptz) DESC, ctid DESC
         ) AS rn
  FROM public.analytics_cache
)
DELETE FROM public.analytics_cache a
USING ranked r
WHERE a.ctid = r.ctid
  AND r.rn > 1;

ALTER TABLE public.analytics_cache
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN days SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
DECLARE
  v_pk_name text;
  v_pk_cols text[];
BEGIN
  SELECT c.conname, array_agg(a.attname::text ORDER BY u.ord)
  INTO v_pk_name, v_pk_cols
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
  WHERE c.conrelid = 'public.analytics_cache'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname
  LIMIT 1;

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['user_id'::text, 'days'::text] THEN
    EXECUTE format('ALTER TABLE public.analytics_cache DROP CONSTRAINT %I', v_pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.analytics_cache'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.analytics_cache
      ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY (user_id, days);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT c.oid, array_agg(a.attname::text ORDER BY u.ord) AS cols
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
      WHERE c.conrelid = 'public.analytics_cache'::regclass
        AND c.contype IN ('p', 'u')
      GROUP BY c.oid
    ) s
    WHERE s.cols = ARRAY['user_id'::text, 'days'::text]
  ) THEN
    ALTER TABLE public.analytics_cache
      ADD CONSTRAINT analytics_cache_user_id_days_key UNIQUE (user_id, days);
  END IF;
END $$;

GRANT SELECT ON public.analytics_cache TO authenticated;
GRANT ALL ON public.analytics_cache TO service_role;

CREATE INDEX IF NOT EXISTS idx_analytics_cache_updated_at
  ON public.analytics_cache (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_link_ip_human_created
  ON public.clicks (link_id, ip, created_at DESC)
  WHERE is_bot = false AND ip IS NOT NULL;

UPDATE public.analytics_cache
SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
  'unique', COALESCE(
    CASE WHEN COALESCE(data->>'unique', '') ~ '^\d+$' THEN (data->>'unique')::bigint END,
    CASE WHEN COALESCE(data->>'uniqueVisitors', '') ~ '^\d+$' THEN (data->>'uniqueVisitors')::bigint END,
    CASE WHEN COALESCE(data->>'unique_ips', '') ~ '^\d+$' THEN (data->>'unique_ips')::bigint END,
    0
  ),
  'uniqueVisitors', COALESCE(
    CASE WHEN COALESCE(data->>'unique', '') ~ '^\d+$' THEN (data->>'unique')::bigint END,
    CASE WHEN COALESCE(data->>'uniqueVisitors', '') ~ '^\d+$' THEN (data->>'uniqueVisitors')::bigint END,
    CASE WHEN COALESCE(data->>'unique_ips', '') ~ '^\d+$' THEN (data->>'unique_ips')::bigint END,
    0
  ),
  'unique_ips', COALESCE(
    CASE WHEN COALESCE(data->>'unique', '') ~ '^\d+$' THEN (data->>'unique')::bigint END,
    CASE WHEN COALESCE(data->>'uniqueVisitors', '') ~ '^\d+$' THEN (data->>'uniqueVisitors')::bigint END,
    CASE WHEN COALESCE(data->>'unique_ips', '') ~ '^\d+$' THEN (data->>'unique_ips')::bigint END,
    0
  )
);

CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_unique bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT
      id AS link_id,
      COALESCE(clicks_count, 0)::bigint AS humans,
      COALESCE(bot_clicks_count, 0)::bigint AS bots,
      (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  RETURN jsonb_build_object(
    'links', v_links,
    'total', v_total,
    'humans', v_humans,
    'bots', v_bots,
    'unique', v_unique,
    'uniqueVisitors', v_unique,
    'unique_ips', v_unique,
    'last24h', 0,
    'last24hHumans', 0,
    'last60s', 0,
    'offers', v_offers,
    'oursClicks', v_ours,
    'hourly', jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
    'heatmap', jsonb_build_array(
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
    ),
    'heatMax', 1,
    'countries', '[]'::jsonb,
    'devices', '[]'::jsonb,
    'browsers', '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons', '[]'::jsonb,
    'trafficSources', '[]'::jsonb,
    'topLinks', v_top_links,
    'liveEvents', '[]'::jsonb,
    '_fallback', true
  );
END
$function$;

DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
  v_unique bigint := 0;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    v_unique := COALESCE(
      CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
      CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
      CASE WHEN COALESCE(v_data->>'unique_ips', '') ~ '^\d+$' THEN (v_data->>'unique_ips')::bigint END,
      0
    );

    RETURN v_data || jsonb_build_object(
      'unique', v_unique,
      'uniqueVisitors', v_unique,
      'unique_ips', v_unique,
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  RETURN public._fast_analytics_summary(_user_id, _days)
    || jsonb_build_object('_cached', false, '_cachedAt', NULL, '_stale', true, '_fallback', true);
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_unique bigint := 0;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '90s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL
        OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      v_unique := COALESCE(
        CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
        CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
        CASE WHEN COALESCE(v_data->>'unique_ips', '') ~ '^\d+$' THEN (v_data->>'unique_ips')::bigint END,
        0
      );
      v_data := v_data || jsonb_build_object('unique', v_unique, 'uniqueVisitors', v_unique, 'unique_ips', v_unique);

      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id,
          'state', SQLSTATE,
          'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'failed', v_failed,
    'errors', v_errors,
    'limit', GREATEST(1, LEAST(COALESCE(_limit, 20), 100)),
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END
$function$;

CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      NULLIF(e->>'ip', '') AS ip,
      NULLIF(e->>'country', '') AS country,
      NULLIF(e->>'ua', '') AS ua,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      NULLIF(e->>'bot_reason', '') AS bot_reason,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to,
      NULLIF(e->>'utm_source', '') AS utm_source,
      NULLIF(e->>'utm_medium', '') AS utm_medium,
      NULLIF(e->>'utm_campaign', '') AS utm_campaign,
      NULLIF(e->>'utm_term', '') AS utm_term,
      NULLIF(e->>'utm_content', '') AS utm_content,
      NULLIF(e->>'referer_host', '') AS referer_host,
      COALESCE(NULLIF(e->>'bot_score', '')::integer, 0) AS bot_score,
      COALESCE(e->'signals', '{}'::jsonb) AS signals,
      COALESCE((e->>'challenge_passed')::boolean, false) AS challenge_passed
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.*
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  FROM valid;

  WITH parsed AS (
    SELECT (e->>'link_id')::uuid AS link_id, COALESCE((e->>'is_bot')::boolean, false) AS is_bot
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT link_id, COUNT(*)::integer AS n
    FROM valid
    WHERE is_bot = true
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot, p.routed_to
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  UPDATE public.links l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.n,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at = now()
  FROM (
    SELECT
      link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n,
      COUNT(*) FILTER (WHERE routed_to = 'offer')::integer AS offer_n
    FROM valid
    WHERE is_bot = false
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot, p.routed_to, l.user_id AS owner_user_id
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
    WHERE l.user_id IS NOT NULL
  )
  UPDATE public.profiles p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.n,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_n
  FROM (
    SELECT
      owner_user_id AS user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n
    FROM valid
    WHERE is_bot = false
    GROUP BY 1
  ) AS s
  WHERE p.id = s.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role;