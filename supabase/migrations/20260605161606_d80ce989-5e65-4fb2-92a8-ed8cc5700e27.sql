-- Add destination_url to links if missing (though it should be there)
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS destination_url TEXT;

-- Add country_name to country_tiers
ALTER TABLE public.country_tiers ADD COLUMN IF NOT EXISTS country_name TEXT;

-- Ensure upgrade_requests has all expected columns
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT;
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT;

-- Final pass on cloaking_rules
ALTER TABLE public.cloaking_rules ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'safe';

-- Fix profiles column naming if there's confusion between clicks_used and links_used
-- The code seems to use clicks_used, so let's keep that but check if links_used is expected
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links_used INTEGER DEFAULT 0;

-- Ensure packages has correct columns
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 5000;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10,2) DEFAULT 0;

-- Ensure profiles has last_daily_redirect_at
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_redirect_at TIMESTAMPTZ;