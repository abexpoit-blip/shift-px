
-- Drop dead view that referenced never-populated columns
DROP VIEW IF EXISTS public.cohort_stats CASCADE;

-- 1. Slim clicks
ALTER TABLE public.clicks
  DROP COLUMN IF EXISTS ja3_hash,
  DROP COLUMN IF EXISTS fingerprint_hash,
  DROP COLUMN IF EXISTS referrer_source,
  DROP COLUMN IF EXISTS country_tier,
  DROP COLUMN IF EXISTS ab_variant,
  DROP COLUMN IF EXISTS prelanding_shown,
  DROP COLUMN IF EXISTS challenge_passed;

CREATE INDEX IF NOT EXISTS clicks_link_created_idx ON public.clicks (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clicks_created_idx ON public.clicks (created_at);

-- 2. Permanent daily aggregates
CREATE TABLE IF NOT EXISTS public.clicks_daily_stats (
  id           BIGSERIAL PRIMARY KEY,
  link_id      UUID NOT NULL,
  day          DATE NOT NULL,
  country      TEXT,
  is_bot       BOOLEAN NOT NULL DEFAULT false,
  bot_reason   TEXT,
  routed_to    TEXT,
  clicks_count BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (link_id, day, country, is_bot, bot_reason, routed_to)
);
CREATE INDEX IF NOT EXISTS cds_link_day_idx ON public.clicks_daily_stats (link_id, day DESC);
CREATE INDEX IF NOT EXISTS cds_day_idx ON public.clicks_daily_stats (day DESC);

GRANT SELECT ON public.clicks_daily_stats TO authenticated;
GRANT ALL ON public.clicks_daily_stats TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.clicks_daily_stats_id_seq TO service_role;

ALTER TABLE public.clicks_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY cds_own_s ON public.clicks_daily_stats FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = clicks_daily_stats.link_id AND l.user_id = auth.uid()));
CREATE POLICY cds_adm_s ON public.clicks_daily_stats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Bot samples
CREATE TABLE IF NOT EXISTS public.bot_samples (
  id          BIGSERIAL PRIMARY KEY,
  link_id     UUID NOT NULL,
  ip          TEXT,
  ua          TEXT,
  country     TEXT,
  bot_reason  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bs_link_created_idx ON public.bot_samples (link_id, created_at DESC);

GRANT SELECT ON public.bot_samples TO authenticated;
GRANT ALL ON public.bot_samples TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bot_samples_id_seq TO service_role;

ALTER TABLE public.bot_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY bs_own_s ON public.bot_samples FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = bot_samples.link_id AND l.user_id = auth.uid()));
CREATE POLICY bs_adm_s ON public.bot_samples FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Updated insert function
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid, _user_id uuid, _ip text, _country text, _ua text,
  _is_bot boolean, _bot_reason text, _routed_to text,
  _utm_source text, _utm_medium text, _utm_campaign text,
  _utm_term text, _utm_content text, _referer_host text,
  _bot_score integer, _signals jsonb, _challenge_passed boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.clicks (link_id, ip, country, ua, is_bot, bot_reason, routed_to)
  VALUES (_link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to);

  IF _is_bot THEN
    UPDATE public.links SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1 WHERE id = _link_id;
    INSERT INTO public.bot_samples (link_id, ip, ua, country, bot_reason)
    VALUES (_link_id, _ip, _ua, _country, _bot_reason);
  ELSE
    UPDATE public.links SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = _link_id;
    UPDATE public.profiles SET clicks_used = COALESCE(clicks_used, 0) + 1 WHERE id = _user_id;
  END IF;
END $function$;

-- 5. Aggregation
CREATE OR REPLACE FUNCTION public.aggregate_daily_clicks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks_daily_stats (link_id, day, country, is_bot, bot_reason, routed_to, clicks_count)
  SELECT link_id, (created_at AT TIME ZONE 'UTC')::date, country, is_bot, bot_reason, routed_to, COUNT(*)
  FROM public.clicks
  WHERE created_at >= (now() - INTERVAL '2 days')
    AND created_at <  date_trunc('day', now())
  GROUP BY 1,2,3,4,5,6
  ON CONFLICT (link_id, day, country, is_bot, bot_reason, routed_to)
  DO UPDATE SET clicks_count = EXCLUDED.clicks_count;
END $$;

-- 6. Weekly cleanup
CREATE OR REPLACE FUNCTION public.weekly_cleanup_clicks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.aggregate_daily_clicks();
  DELETE FROM public.clicks WHERE created_at < now() - INTERVAL '7 days';
END $$;

-- 7. Trim bot samples
CREATE OR REPLACE FUNCTION public.trim_bot_samples()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bot_samples bs USING (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY link_id ORDER BY created_at DESC) AS rn
      FROM public.bot_samples
    ) t WHERE t.rn > 1000
  ) old WHERE bs.id = old.id;
END $$;

-- 8. pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN PERFORM cron.unschedule('aggregate-daily-clicks'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('weekly-cleanup-clicks'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('trim-bot-samples'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('aggregate-daily-clicks', '5 * * * *', $$ SELECT public.aggregate_daily_clicks(); $$);
SELECT cron.schedule('trim-bot-samples', '0 */6 * * *', $$ SELECT public.trim_bot_samples(); $$);
SELECT cron.schedule('weekly-cleanup-clicks', '0 0 * * 0', $$ SELECT public.weekly_cleanup_clicks(); $$);
