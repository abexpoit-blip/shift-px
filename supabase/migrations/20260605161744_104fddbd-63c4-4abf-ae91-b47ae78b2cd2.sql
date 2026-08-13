-- Ensure packages has both names for price to satisfy all code versions
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10,2) DEFAULT 0;

-- Ensure profiles has all expected quota and usage columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS link_limit INTEGER DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ours_clicks INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_period_start TIMESTAMPTZ DEFAULT now();

-- Ensure all tables have proper columns for build errors
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT;
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT;

-- Ensure targeting tables have clicks and conversions counts
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;