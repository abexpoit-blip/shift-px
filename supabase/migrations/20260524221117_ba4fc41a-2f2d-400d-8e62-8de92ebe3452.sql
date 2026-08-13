
-- ============ Country tiers ============
CREATE TABLE IF NOT EXISTS public.country_tiers (
  country_code TEXT PRIMARY KEY,
  tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  country_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.country_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_read_all ON public.country_tiers FOR SELECT USING (true);
CREATE POLICY ct_admin_all ON public.country_tiers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed tiers
INSERT INTO public.country_tiers (country_code, tier, country_name) VALUES
('US',1,'United States'),('UK',1,'United Kingdom'),('GB',1,'United Kingdom'),
('CA',1,'Canada'),('AU',1,'Australia'),('DE',1,'Germany'),('FR',1,'France'),
('NL',1,'Netherlands'),('SE',1,'Sweden'),('NO',1,'Norway'),('CH',1,'Switzerland'),
('IE',1,'Ireland'),('NZ',1,'New Zealand'),('DK',1,'Denmark'),('FI',1,'Finland'),
('BR',2,'Brazil'),('MX',2,'Mexico'),('IN',2,'India'),('ID',2,'Indonesia'),
('TR',2,'Turkey'),('IT',2,'Italy'),('ES',2,'Spain'),('PL',2,'Poland'),
('AR',2,'Argentina'),('CL',2,'Chile'),('CO',2,'Colombia'),('MY',2,'Malaysia'),
('TH',2,'Thailand'),('PH',2,'Philippines'),('VN',2,'Vietnam'),('ZA',2,'South Africa'),
('SA',2,'Saudi Arabia'),('AE',2,'UAE'),('JP',2,'Japan'),('KR',2,'South Korea')
ON CONFLICT (country_code) DO NOTHING;

-- ============ Geo offers (per-link, per-tier override) ============
CREATE TABLE IF NOT EXISTS public.geo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  tier SMALLINT CHECK (tier BETWEEN 1 AND 3),
  country_codes TEXT[],
  offer_url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100 CHECK (weight > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_geo_offers_link ON public.geo_offers(link_id) WHERE is_active = true;
ALTER TABLE public.geo_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY go_owner_all ON public.geo_offers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY go_admin_all ON public.geo_offers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ A/B variants ============
CREATE TABLE IF NOT EXISTS public.ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  offer_url TEXT NOT NULL,
  weight_pct INTEGER NOT NULL DEFAULT 50 CHECK (weight_pct BETWEEN 1 AND 100),
  clicks_count BIGINT NOT NULL DEFAULT 0,
  conversions_count BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(link_id, variant_label)
);
CREATE INDEX idx_ab_variants_link ON public.ab_variants(link_id) WHERE is_active = true;
ALTER TABLE public.ab_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY ab_owner_all ON public.ab_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY ab_admin_all ON public.ab_variants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ Referrer rules ============
CREATE TABLE IF NOT EXISTS public.referrer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  label TEXT,
  trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  action TEXT NOT NULL DEFAULT 'allow' CHECK (action IN ('allow','suspect','block')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referrer_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY rr_read_auth ON public.referrer_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY rr_admin_all ON public.referrer_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.referrer_rules (pattern, label, trust_score, action) VALUES
('facebook.com','Facebook',95,'allow'),
('fb.com','Facebook',95,'allow'),
('instagram.com','Instagram',95,'allow'),
('t.co','Twitter',90,'allow'),
('twitter.com','Twitter',90,'allow'),
('x.com','X/Twitter',90,'allow'),
('telegram.org','Telegram',95,'allow'),
('t.me','Telegram',95,'allow'),
('whatsapp.com','WhatsApp',95,'allow'),
('wa.me','WhatsApp',95,'allow'),
('tiktok.com','TikTok',90,'allow'),
('youtube.com','YouTube',90,'allow'),
('reddit.com','Reddit',85,'allow'),
('google.com','Google',80,'allow'),
('googlebot.com','Googlebot',0,'block'),
('ahrefs.com','Ahrefs',0,'block'),
('semrush.com','Semrush',0,'block')
ON CONFLICT DO NOTHING;

-- ============ Cloaking rules ============
CREATE TABLE IF NOT EXISTS public.cloaking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('ua','ip','asn','country')),
  pattern TEXT NOT NULL,
  label TEXT,
  action TEXT NOT NULL DEFAULT 'safe' CHECK (action IN ('safe','block','offer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloaking_active ON public.cloaking_rules(rule_type, is_active) WHERE is_active = true;
ALTER TABLE public.cloaking_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_read_auth ON public.cloaking_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY cr_admin_all ON public.cloaking_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.cloaking_rules (rule_type, pattern, label, action) VALUES
('ua','facebookexternalhit','Facebook Crawler','safe'),
('ua','facebot','Facebook Bot','safe'),
('ua','meta-externalagent','Meta Agent','safe'),
('ua','meta-externalfetcher','Meta Fetcher','safe'),
('ua','googlebot','Google Bot','safe'),
('ua','adsbot-google','Google AdsBot','safe'),
('ua','bingbot','Bing Bot','safe'),
('ua','yandexbot','Yandex Bot','safe'),
('ua','duckduckbot','DuckDuckGo','safe'),
('asn','32934','Facebook AS','safe'),
('asn','15169','Google AS','safe'),
('asn','8075','Microsoft AS','safe'),
('asn','13335','Cloudflare AS','safe'),
('asn','14618','Amazon AS','safe'),
('asn','16509','Amazon AWS','safe')
ON CONFLICT DO NOTHING;

-- ============ Bot fingerprints (auto-learn) ============
CREATE TABLE IF NOT EXISTS public.bot_fingerprints (
  fingerprint_hash TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 1,
  bot_hits INTEGER NOT NULL DEFAULT 0,
  auto_blocked BOOLEAN NOT NULL DEFAULT false,
  sample_ip TEXT,
  sample_ua TEXT,
  sample_country TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bf_blocked ON public.bot_fingerprints(auto_blocked) WHERE auto_blocked = true;
ALTER TABLE public.bot_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY bf_admin_all ON public.bot_fingerprints FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ Extend clicks table ============
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT,
  ADD COLUMN IF NOT EXISTS referrer_source TEXT,
  ADD COLUMN IF NOT EXISTS country_tier SMALLINT,
  ADD COLUMN IF NOT EXISTS ab_variant TEXT,
  ADD COLUMN IF NOT EXISTS ja3_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_clicks_fingerprint ON public.clicks(fingerprint_hash) WHERE fingerprint_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_link_created ON public.clicks(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_referrer ON public.clicks(referrer_source) WHERE referrer_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_country_created ON public.clicks(country, created_at DESC) WHERE country IS NOT NULL;

-- ============ Helper function: record bot fingerprint hit ============
CREATE OR REPLACE FUNCTION public.record_bot_fingerprint(
  _hash TEXT, _is_bot BOOLEAN, _ip TEXT, _ua TEXT, _country TEXT, _block_threshold INTEGER DEFAULT 3
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked BOOLEAN;
BEGIN
  INSERT INTO public.bot_fingerprints (fingerprint_hash, hit_count, bot_hits, sample_ip, sample_ua, sample_country, last_seen)
  VALUES (_hash, 1, CASE WHEN _is_bot THEN 1 ELSE 0 END, _ip, _ua, _country, now())
  ON CONFLICT (fingerprint_hash) DO UPDATE
    SET hit_count = bot_fingerprints.hit_count + 1,
        bot_hits  = bot_fingerprints.bot_hits + CASE WHEN _is_bot THEN 1 ELSE 0 END,
        last_seen = now(),
        auto_blocked = CASE
          WHEN bot_fingerprints.auto_blocked THEN true
          WHEN bot_fingerprints.bot_hits + CASE WHEN _is_bot THEN 1 ELSE 0 END >= _block_threshold THEN true
          ELSE false
        END
  RETURNING auto_blocked INTO v_blocked;
  RETURN v_blocked;
END $$;

-- ============ Cohort analytics view ============
CREATE OR REPLACE VIEW public.cohort_stats AS
SELECT
  COALESCE(referrer_source, 'direct') AS source,
  COUNT(*) AS total_clicks,
  SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) AS bot_clicks,
  SUM(CASE WHEN NOT is_bot THEN 1 ELSE 0 END) AS human_clicks,
  ROUND(100.0 * SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS bot_pct,
  COUNT(DISTINCT country) AS countries,
  COUNT(DISTINCT fingerprint_hash) AS unique_fps,
  MIN(created_at) AS first_click,
  MAX(created_at) AS last_click
FROM public.clicks
WHERE created_at > now() - interval '7 days'
GROUP BY COALESCE(referrer_source, 'direct');

-- ============ Country stats view (for live dashboard map) ============
CREATE OR REPLACE VIEW public.country_stats_24h AS
SELECT
  country,
  COUNT(*) AS clicks,
  SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) AS bots,
  SUM(CASE WHEN NOT is_bot THEN 1 ELSE 0 END) AS humans
FROM public.clicks
WHERE created_at > now() - interval '24 hours' AND country IS NOT NULL AND country <> ''
GROUP BY country;
