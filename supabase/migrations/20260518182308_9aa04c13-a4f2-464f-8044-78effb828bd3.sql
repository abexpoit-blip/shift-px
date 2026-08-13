ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS variant text DEFAULT 'wellness';
CREATE INDEX IF NOT EXISTS idx_clicks_link_id_created ON public.clicks(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_is_bot ON public.clicks(is_bot);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON public.clicks(country);
CREATE INDEX IF NOT EXISTS idx_clicks_variant ON public.clicks(variant);