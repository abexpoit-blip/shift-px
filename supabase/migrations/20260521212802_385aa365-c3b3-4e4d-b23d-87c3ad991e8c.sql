
-- Ad rotation + login ad config (single row)
CREATE TABLE IF NOT EXISTS public.ad_rotation_config (
  id integer PRIMARY KEY DEFAULT 1,
  login_ad_enabled boolean NOT NULL DEFAULT false,
  login_ad_url text,
  login_ads_per_day integer NOT NULL DEFAULT 2,
  rotation_enabled boolean NOT NULL DEFAULT false,
  rotation_admin_url text,
  rotation_user_clicks integer NOT NULL DEFAULT 1000,
  rotation_admin_clicks integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_rotation_config_singleton CHECK (id = 1)
);

INSERT INTO public.ad_rotation_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ad_rotation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ad config" ON public.ad_rotation_config
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update ad config" ON public.ad_rotation_config
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Daily login-ad tracker on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_ad_date date,
  ADD COLUMN IF NOT EXISTS ads_shown_today integer NOT NULL DEFAULT 0;
