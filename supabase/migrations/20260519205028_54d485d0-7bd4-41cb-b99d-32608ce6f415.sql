CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clicks_verify_created_variant
ON public.clicks (created_at DESC, variant)
WHERE bot_reason LIKE 'verify:%' AND variant IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clicks_bot_reason_pattern
ON public.clicks (bot_reason text_pattern_ops)
WHERE bot_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
ON public.profiles USING gin (email gin_trgm_ops)
WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
ON public.profiles USING gin (full_name gin_trgm_ops)
WHERE full_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packages_active_sort
ON public.packages (is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_prelander_variants_sort
ON public.prelander_variants (sort_order);