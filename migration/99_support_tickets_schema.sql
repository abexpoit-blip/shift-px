-- Fix support_tickets table schema
ALTER TABLE IF EXISTS public.support_tickets 
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_by UUID;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
