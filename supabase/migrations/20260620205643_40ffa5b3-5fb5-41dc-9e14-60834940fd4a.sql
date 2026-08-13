ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();