-- 42_destination_pool_skin_cleanup.sql
-- Adspx hardening port (from the Sleepox line, adapted for our schema):
--   1) app_settings.destination_pool  -> per-short-code destination rotation
--   2) safe_url leak cleanup + write-time guard (no brand / offer host leaks)
--   3) full weekly cleanup: dead links, raw click purge, log hygiene, counter resync
--
-- Safe by design:
--   * a link with ANY click is NEVER deleted
--   * aggregates (daily_stats / click_dim_daily) are the lifetime archive and
--     are NEVER touched — only raw `clicks` rows older than 30 days are purged
--   * every statement is guarded so a missing optional table cannot abort the run

-- ---------------------------------------------------------------------------
-- 1) Destination pool
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS destination_pool jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.app_settings.destination_pool IS
  'Weighted pool of monetisation destinations. Hashed per short_code so each link keeps its own stable destination. Empty = fall back to our_adsterra_url.';

UPDATE public.app_settings
SET destination_pool = jsonb_build_array(our_adsterra_url)
WHERE id = true
  AND destination_pool = '[]'::jsonb
  AND COALESCE(our_adsterra_url, '') <> '';

-- ---------------------------------------------------------------------------
-- 2) safe_url leak cleanup + guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extract_host(url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      split_part(regexp_replace(coalesce(url, ''), '^\s+', ''), '/', 3),
      '^([^@]+@|www\.)', ''
    )
  )
$$;

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'links' AND column_name = 'safe_url'
  ) THEN
    EXECUTE $sql$
      UPDATE public.links
      SET safe_url = ''
      WHERE coalesce(safe_url, '') <> ''
        AND (
             safe_url ~* '(sleepox|adspx\.com|adswapx\.com)'
          OR safe_url ILIKE '%localhost%'
          OR public.extract_host(safe_url) = public.extract_host(destination_url)
          OR public.extract_host(safe_url) = public.extract_host(adsterra_url)
        )
    $sql$;
  END IF;
END
$mig$;

CREATE OR REPLACE FUNCTION public.sanitize_link_safe_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.safe_url, '') <> '' AND (
       NEW.safe_url ~* '(sleepox|adspx\.com|adswapx\.com)'
    OR NEW.safe_url ILIKE '%localhost%'
    OR public.extract_host(NEW.safe_url) = public.extract_host(NEW.destination_url)
    OR public.extract_host(NEW.safe_url) = public.extract_host(NEW.adsterra_url)
  ) THEN
    NEW.safe_url := '';
  END IF;
  RETURN NEW;
END;
$$;

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'links' AND column_name = 'safe_url'
  ) THEN
    DROP TRIGGER IF EXISTS trg_sanitize_link_safe_url ON public.links;
    CREATE TRIGGER trg_sanitize_link_safe_url
    BEFORE INSERT OR UPDATE OF safe_url, destination_url, adsterra_url ON public.links
    FOR EACH ROW EXECUTE FUNCTION public.sanitize_link_safe_url();
  END IF;
END
$mig$;

-- ---------------------------------------------------------------------------
-- 3) Weekly cleanup (full)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.weekly_cleanup(_dead_link_age_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_links  bigint := 0;
  _deleted_clicks bigint := 0;
  _deleted_errors bigint := 0;
BEGIN
  -- dead links: zero clicks ever, older than the threshold
  WITH dead AS (
    SELECT l.id
    FROM public.links l
    WHERE l.created_at < now() - make_interval(days => _dead_link_age_days)
      AND COALESCE(l.clicks_count, 0) = 0
      AND COALESCE(l.bot_clicks_count, 0) = 0
      AND COALESCE(l.ours_clicks_count, 0) = 0
      AND COALESCE(l.offer_clicks_count, 0) = 0
      AND NOT EXISTS (SELECT 1 FROM public.clicks c WHERE c.link_id = l.id)
  ), del AS (
    DELETE FROM public.links l USING dead WHERE l.id = dead.id RETURNING 1
  )
  SELECT count(*) INTO _deleted_links FROM del;

  -- raw click rows older than 30 days (lifetime totals stay in the aggregates)
  WITH c AS (
    DELETE FROM public.clicks WHERE created_at < now() - interval '30 days' RETURNING 1
  )
  SELECT count(*) INTO _deleted_clicks FROM c;

  -- log hygiene (optional tables)
  IF to_regclass('public.error_logs') IS NOT NULL THEN
    EXECUTE $x$DELETE FROM public.error_logs WHERE created_at < now() - interval '14 days'$x$;
    GET DIAGNOSTICS _deleted_errors = ROW_COUNT;
  END IF;
  IF to_regclass('public.signup_attempts') IS NOT NULL THEN
    EXECUTE $x$DELETE FROM public.signup_attempts WHERE created_at < now() - interval '30 days'$x$;
  END IF;
  IF to_regclass('public.domain_health_checks') IS NOT NULL THEN
    EXECUTE $x$DELETE FROM public.domain_health_checks WHERE checked_at < now() - interval '30 days'$x$;
  END IF;

  -- keep per-profile link counters honest after deletions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'links_used'
  ) THEN
    EXECUTE $x$
      UPDATE public.profiles p
      SET links_used = sub.cnt
      FROM (
        SELECT u.id, COALESCE(l.cnt, 0) AS cnt
        FROM public.profiles u
        LEFT JOIN (SELECT user_id, count(*) cnt FROM public.links GROUP BY user_id) l
          ON l.user_id = u.id
      ) sub
      WHERE p.id = sub.id AND p.links_used IS DISTINCT FROM sub.cnt
    $x$;
  END IF;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'deleted_links', _deleted_links,
    'deleted_clicks', _deleted_clicks,
    'deleted_error_logs', _deleted_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_cleanup(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_cleanup(integer) TO service_role;

-- Dry-run helper: shows what WOULD be deleted, deletes nothing.
CREATE OR REPLACE FUNCTION public.weekly_cleanup_preview(_dead_link_age_days integer DEFAULT 7)
RETURNS TABLE(short_code text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.short_code, l.created_at
  FROM public.links l
  WHERE l.created_at < now() - make_interval(days => _dead_link_age_days)
    AND COALESCE(l.clicks_count, 0) = 0
    AND COALESCE(l.bot_clicks_count, 0) = 0
    AND COALESCE(l.ours_clicks_count, 0) = 0
    AND COALESCE(l.offer_clicks_count, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM public.clicks c WHERE c.link_id = l.id)
  ORDER BY l.created_at
$$;

REVOKE ALL ON FUNCTION public.weekly_cleanup_preview(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_cleanup_preview(integer) TO service_role;

-- Schedule: every Sunday 03:00 UTC (09:00 Dhaka). Replaces the partial job.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'adspx_weekly_cleanup';
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'adspx_cleanup_dead_links';
    PERFORM cron.schedule('adspx_weekly_cleanup', '0 3 * * 0',
                          $cron$SELECT public.weekly_cleanup(7);$cron$);
  END IF;
END
$mig$;
