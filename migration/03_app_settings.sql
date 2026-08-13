-- =====================================================================
-- 03_app_settings.sql — Aurora v1 features
-- Apply this on the SELF-HOSTED Supabase (supabase.sleepox.com) Postgres
-- Run with:   psql "$DATABASE_URL" -f migration/03_app_settings.sql
-- =====================================================================

-- 1. App-wide settings (singleton row)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  fallback_url TEXT NOT NULL DEFAULT 'https://consciousdunkvastly.com/qdg9kcmh?key=615ddb2bcc3fac3d25f1df64465f1da7',
  our_adsterra_url TEXT NOT NULL DEFAULT 'https://consciousdunkvastly.com/qdg9kcmh?key=615ddb2bcc3fac3d25f1df64465f1da7',
  injection_threshold INTEGER NOT NULL DEFAULT 5000,
  injection_count INTEGER NOT NULL DEFAULT 50,
  daily_redirect_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = true)
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "as_read_auth" ON public.app_settings;
CREATE POLICY "as_read_auth" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "as_admin_all" ON public.app_settings;
CREATE POLICY "as_admin_all" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS app_settings_touch ON public.app_settings;
CREATE TRIGGER app_settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.app_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- 2. Track daily auto-redirect per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_daily_redirect_at TIMESTAMPTZ;

-- 3. Ensure click detail columns exist on the lean self-host schema so
-- dashboard/analytics can show exact referrer, UTM, score and UA details.
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS referer_host TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS bot_score INTEGER,
  ADD COLUMN IF NOT EXISTS signals JSONB,
  ADD COLUMN IF NOT EXISTS challenge_passed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clicks_referer_host ON public.clicks (referer_host) WHERE referer_host IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_utm_source ON public.clicks (utm_source) WHERE utm_source IS NOT NULL;

-- 4. Store the full click detail payload. The old function accepted these
-- params but only inserted basic columns, so Analytics showed incomplete
-- referrer/UTM/bot-score details even though redirects were recorded.
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text,
  _country text,
  _ua text,
  _is_bot boolean,
  _bot_reason text,
  _routed_to text,
  _utm_source text,
  _utm_medium text,
  _utm_campaign text,
  _utm_term text,
  _utm_content text,
  _referer_host text,
  _bot_score integer,
  _signals jsonb,
  _challenge_passed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  VALUES (
    _link_id, _ip, _country, _ua, COALESCE(_is_bot, false), _bot_reason, COALESCE(_routed_to, 'offer'),
    NULLIF(_utm_source, ''), NULLIF(_utm_medium, ''), NULLIF(_utm_campaign, ''), NULLIF(_utm_term, ''), NULLIF(_utm_content, ''),
    NULLIF(_referer_host, ''), _bot_score, COALESCE(_signals, '{}'::jsonb), COALESCE(_challenge_passed, false)
  );

  IF COALESCE(_is_bot, false) THEN
    UPDATE public.links SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1 WHERE id = _link_id;
    INSERT INTO public.bot_samples (link_id, ip, ua, country, bot_reason)
    VALUES (_link_id, _ip, _ua, _country, _bot_reason);
  ELSE
    UPDATE public.links SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = _link_id;
    UPDATE public.profiles SET clicks_used = COALESCE(clicks_used, 0) + 1 WHERE id = _user_id;
  END IF;
END;
$$;
