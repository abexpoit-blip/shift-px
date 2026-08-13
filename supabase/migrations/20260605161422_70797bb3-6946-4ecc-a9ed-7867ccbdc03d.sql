-- App settings for global controls
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  our_adsterra_url TEXT,
  injection_threshold INTEGER DEFAULT 5000,
  injection_count INTEGER DEFAULT 50,
  daily_redirect_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view app settings" ON public.app_settings FOR SELECT USING (true);
INSERT INTO public.app_settings (id, our_adsterra_url) VALUES (true, 'https://sleepox.com/') ON CONFLICT DO NOTHING;

-- Bot rules for UA/IP/ASN blocking
CREATE TABLE IF NOT EXISTS public.bot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  label TEXT,
  rule_type TEXT NOT NULL, -- 'ua', 'asn', 'ip'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.bot_rules TO authenticated, anon;
GRANT ALL ON public.bot_rules TO service_role;
ALTER TABLE public.bot_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active bot rules" ON public.bot_rules FOR SELECT USING (is_active = true);

-- Geo offers for targeting
CREATE TABLE IF NOT EXISTS public.geo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  tier INTEGER,
  country_codes TEXT[], -- Array of CCs like ['US', 'CA']
  offer_url TEXT NOT NULL,
  weight INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_offers TO authenticated;
GRANT ALL ON public.geo_offers TO service_role;
ALTER TABLE public.geo_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage geo offers for their links" ON public.geo_offers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.links WHERE links.id = geo_offers.link_id AND links.user_id = auth.uid())
);

-- A/B variants for links
CREATE TABLE IF NOT EXISTS public.ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  offer_url TEXT NOT NULL,
  weight_pct INTEGER DEFAULT 50,
  clicks_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_variants TO authenticated;
GRANT ALL ON public.ab_variants TO service_role;
ALTER TABLE public.ab_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage ab variants for their links" ON public.ab_variants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.links WHERE links.id = ab_variants.link_id AND links.user_id = auth.uid())
);

-- Cloaking rules
CREATE TABLE IF NOT EXISTS public.cloaking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL, -- 'ua', 'ip', 'asn', 'referer', 'header'
  pattern TEXT NOT NULL,
  action TEXT DEFAULT 'safe',
  label TEXT,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.cloaking_rules TO authenticated, anon;
GRANT ALL ON public.cloaking_rules TO service_role;
ALTER TABLE public.cloaking_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active cloaking rules" ON public.cloaking_rules FOR SELECT USING (is_active = true);

-- Referrer rules
CREATE TABLE IF NOT EXISTS public.referrer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  trust_score INTEGER DEFAULT 0,
  action TEXT DEFAULT 'safe',
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.referrer_rules TO authenticated, anon;
GRANT ALL ON public.referrer_rules TO service_role;
ALTER TABLE public.referrer_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active referrer rules" ON public.referrer_rules FOR SELECT USING (is_active = true);

-- Country tiers for targeting
CREATE TABLE IF NOT EXISTS public.country_tiers (
  country_code TEXT PRIMARY KEY,
  tier INTEGER NOT NULL
);
GRANT SELECT ON public.country_tiers TO authenticated, anon;
GRANT ALL ON public.country_tiers TO service_role;
ALTER TABLE public.country_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view country tiers" ON public.country_tiers FOR SELECT USING (true);

-- Bot fingerprints for auto-blocking
CREATE TABLE IF NOT EXISTS public.bot_fingerprints (
  fingerprint_hash TEXT PRIMARY KEY,
  is_bot_count INTEGER DEFAULT 0,
  is_human_count INTEGER DEFAULT 0,
  auto_blocked BOOLEAN DEFAULT false,
  last_ip TEXT,
  last_ua TEXT,
  last_country TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.bot_fingerprints TO authenticated, anon;
GRANT ALL ON public.bot_fingerprints TO service_role;
ALTER TABLE public.bot_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bot fingerprints" ON public.bot_fingerprints FOR SELECT USING (true);

-- Upgrade requests
CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_slug TEXT NOT NULL,
  amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending',
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT ON public.upgrade_requests TO authenticated;
GRANT ALL ON public.upgrade_requests TO service_role;
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own upgrade requests" ON public.upgrade_requests FOR ALL USING (auth.uid() = user_id);

-- Add missing columns to links
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS safe_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_direct_link TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS prelanding_template TEXT DEFAULT 'article_health';
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update clicks table with new columns
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS routed_to TEXT DEFAULT 'offer';
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS referer_host TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS bot_score INTEGER DEFAULT 0;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS signals JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS challenge_passed BOOLEAN DEFAULT false;

-- record_redirect_click function
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id,
    ip_address,
    country,
    user_agent,
    is_bot,
    bot_reason,
    routed_to,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _routed_to,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = _link_id;

    UPDATE public.profiles
    SET clicks_used = COALESCE(clicks_used, 0) + 1
    WHERE id = _user_id;
  END IF;
END;
$$;

-- record_bot_fingerprint function
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

-- pick_prelanding_template function
CREATE OR REPLACE FUNCTION public.pick_prelanding_template(
  _link_id uuid,
  _candidates text[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _picked text;
BEGIN
  -- Simple random for now, could be improved to least-served
  _picked := _candidates[floor(random() * array_length(_candidates, 1)) + 1];
  RETURN _picked;
END;
$$;