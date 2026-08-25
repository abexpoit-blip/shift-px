-- MASTER SCHEMA REPAIR & FEATURE ALIGNMENT MIGRATION
-- Run this on your Postgres database to ensure all features are 100% complete

-- 1. support_tickets table columns
ALTER TABLE IF EXISTS public.support_tickets 
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_by UUID;

-- 2. app_settings table columns
ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS support_enabled BOOLEAN DEFAULT true;

-- 3. broadcasts table columns
ALTER TABLE IF EXISTS public.broadcasts
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'bell',
  ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 4. custom_domains index
CREATE INDEX IF NOT EXISTS idx_custom_domains_user_id ON public.custom_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON public.custom_domains(domain);

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
