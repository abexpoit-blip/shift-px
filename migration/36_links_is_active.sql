-- Ensure links.is_active exists (used by admin overview stats + audits)
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS links_is_active_idx ON public.links (is_active) WHERE is_active = true;

NOTIFY pgrst, 'reload schema';
