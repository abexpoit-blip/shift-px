-- 31_selfhost_compat.sql
-- Fresh self-host bootstrap: the 01_schema.sql dump predates several columns
-- and tables that later migrations (03..30) depend on. This adds every missing
-- object so the full migration chain applies cleanly on a brand-new database.
-- Safe to re-run.

-- ---------- shared helper ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------- clicks ----------
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS ua text,
  ADD COLUMN IF NOT EXISTS routed_to text DEFAULT 'offer';

UPDATE public.clicks SET ip = ip_address WHERE ip IS NULL AND ip_address IS NOT NULL;
UPDATE public.clicks SET ua = user_agent WHERE ua IS NULL AND user_agent IS NOT NULL;

-- ---------- links ----------
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS ours_clicks_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offer_clicks_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS prelanding_template text,
  ADD COLUMN IF NOT EXISTS safe_url_category text;

-- ---------- profiles ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ours_clicks bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_limit integer;

UPDATE public.profiles SET link_limit = link_quota WHERE link_limit IS NULL;

-- ---------- packages ----------
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS click_quota bigint,
  ADD COLUMN IF NOT EXISTS price_usd numeric(10,2);

UPDATE public.packages SET click_quota = click_limit WHERE click_quota IS NULL;
UPDATE public.packages SET price_usd = price_monthly WHERE price_usd IS NULL;

-- ---------- upgrade_requests ----------
ALTER TABLE public.upgrade_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ---------- daily_stats (per-link daily rollup) ----------
CREATE TABLE IF NOT EXISTS public.daily_stats (
  link_id           uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  day               date NOT NULL,
  human_clicks      integer NOT NULL DEFAULT 0,
  bot_clicks        integer NOT NULL DEFAULT 0,
  ours_clicks       integer NOT NULL DEFAULT 0,
  offer_clicks      integer NOT NULL DEFAULT 0,
  country_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, day)
);

GRANT SELECT ON public.daily_stats TO authenticated;
GRANT ALL ON public.daily_stats TO service_role;

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read own daily stats" ON public.daily_stats;
CREATE POLICY "owners read own daily stats" ON public.daily_stats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.links l
    WHERE l.id = daily_stats.link_id AND l.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_daily_stats_day ON public.daily_stats (day DESC);

-- ---------- function signature conflicts (18 cannot ALTER defaults away) ----------
DROP FUNCTION IF EXISTS public._compute_analytics_summary(uuid, integer);
DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid, integer);

NOTIFY pgrst, 'reload schema';

SELECT 'selfhost compat ready' AS status;
