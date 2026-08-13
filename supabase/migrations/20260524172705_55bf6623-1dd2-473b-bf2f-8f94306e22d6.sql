-- Phase 1: Prelanding + JS Challenge support
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS prelanding_template TEXT NOT NULL DEFAULT 'verify';

-- Constrain to known templates (none = skip prelanding, direct redirect)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'links_prelanding_template_check'
  ) THEN
    ALTER TABLE public.links
      ADD CONSTRAINT links_prelanding_template_check
      CHECK (prelanding_template IN ('none','verify','reward','countdown','article'));
  END IF;
END $$;

ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS prelanding_shown BOOLEAN NOT NULL DEFAULT false;

-- challenge_passed already added in earlier migration on VPS; ensure for Lovable Cloud
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS challenge_passed BOOLEAN NOT NULL DEFAULT false;