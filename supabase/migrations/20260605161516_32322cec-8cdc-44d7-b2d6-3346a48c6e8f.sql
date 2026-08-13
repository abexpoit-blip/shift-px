-- Add remaining columns to upgrade_requests
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT;

-- Add remaining columns to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS fallback_url TEXT;

-- Add conversions_count to geo_offers (some parts of code might expect it)
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;

-- Ensure all tables have proper RLS even if they existed
ALTER TABLE public.cloaking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_fingerprints ENABLE ROW LEVEL SECURITY;

-- Grant permissions again to be sure
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clicks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upgrade_requests TO authenticated;

GRANT SELECT ON public.packages TO authenticated, anon;
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT SELECT ON public.bot_rules TO authenticated, anon;
GRANT SELECT ON public.cloaking_rules TO authenticated, anon;
GRANT SELECT ON public.referrer_rules TO authenticated, anon;
GRANT SELECT ON public.country_tiers TO authenticated, anon;
GRANT SELECT ON public.bot_fingerprints TO authenticated, anon;

GRANT ALL ON public.links TO service_role;
GRANT ALL ON public.clicks TO service_role;
GRANT ALL ON public.geo_offers TO service_role;
GRANT ALL ON public.ab_variants TO service_role;
GRANT ALL ON public.upgrade_requests TO service_role;
GRANT ALL ON public.packages TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.app_settings TO service_role;
GRANT ALL ON public.bot_rules TO service_role;
GRANT ALL ON public.cloaking_rules TO service_role;
GRANT ALL ON public.referrer_rules TO service_role;
GRANT ALL ON public.country_tiers TO service_role;
GRANT ALL ON public.bot_fingerprints TO service_role;