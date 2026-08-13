-- Create error_logs table for system diagnostics
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  link_id UUID REFERENCES public.links(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage error logs" ON public.error_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Ensure link_limit exists on packages (some migrations might have used different names)
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS link_limit INTEGER DEFAULT 50;

-- Ensure all expected columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS link_limit INTEGER DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ours_clicks INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_period_start TIMESTAMPTZ DEFAULT now();

-- Ensure all expected columns on links
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS destination_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_direct_link TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS safe_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS prelanding_template TEXT DEFAULT 'article_health';

-- Ensure targeting tables have hit counts
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

-- Ensure bot_fingerprints has hit tracking columns
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS is_bot_count INTEGER DEFAULT 0;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS is_human_count INTEGER DEFAULT 0;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS last_ua TEXT;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS last_country TEXT;

-- Update record_bot_fingerprint to use correct columns
CREATE OR REPLACE FUNCTION public.record_bot_fingerprint(
  _hash text,
  _is_bot boolean,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _country text DEFAULT NULL,
  _block_threshold integer DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bot_fingerprints (
    fingerprint_hash,
    is_bot_count,
    is_human_count,
    last_ip,
    last_ua,
    last_country,
    updated_at
  ) VALUES (
    _hash,
    CASE WHEN _is_bot THEN 1 ELSE 0 END,
    CASE WHEN _is_bot THEN 0 ELSE 1 END,
    _ip,
    _ua,
    _country,
    now()
  )
  ON CONFLICT (fingerprint_hash) DO UPDATE SET
    is_bot_count = bot_fingerprints.is_bot_count + (CASE WHEN _is_bot THEN 1 ELSE 0 END),
    is_human_count = bot_fingerprints.is_human_count + (CASE WHEN _is_bot THEN 0 ELSE 1 END),
    last_ip = _ip,
    last_ua = _ua,
    last_country = _country,
    updated_at = now(),
    auto_blocked = (bot_fingerprints.is_bot_count + (CASE WHEN _is_bot THEN 1 ELSE 0 END)) >= _block_threshold;
END;
$$;