ALTER TABLE public.bot_protection_config
  ADD COLUMN IF NOT EXISTS signal_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS soft_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS inapp_browser_relief boolean NOT NULL DEFAULT true;