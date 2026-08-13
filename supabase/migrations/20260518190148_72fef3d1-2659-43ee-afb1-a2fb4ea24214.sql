
CREATE TABLE IF NOT EXISTS public.bot_protection_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ip_rate_limit_per_min INTEGER NOT NULL DEFAULT 30,
  ip_rate_limit_window_sec INTEGER NOT NULL DEFAULT 60,
  suspicious_action TEXT NOT NULL DEFAULT 'safe_page',
  block_threshold_score INTEGER NOT NULL DEFAULT 60,
  safe_page_message TEXT NOT NULL DEFAULT 'This article is temporarily unavailable. Please check back later.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bot_protection_config_singleton CHECK (id = 1),
  CONSTRAINT bot_protection_config_action CHECK (suspicious_action IN ('block','safe_page','allow'))
);

INSERT INTO public.bot_protection_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bot_protection_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read protection config"
  ON public.bot_protection_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update protection config"
  ON public.bot_protection_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS clicks_ip_created_idx
  ON public.clicks (ip_address, created_at DESC);
