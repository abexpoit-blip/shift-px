-- Rename price_monthly to price_usd in packages
ALTER TABLE public.packages RENAME COLUMN price_monthly TO price_usd;

-- Add last_daily_redirect_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_redirect_at TIMESTAMPTZ;

-- Add missing columns to geo_offers and ab_variants if they are somehow missing
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

-- Ensure upgrade_requests has updated_at
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add missing columns to cloaking_rules
ALTER TABLE public.cloaking_rules ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'safe';

-- Fix app_settings if needed
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS fallback_url TEXT;