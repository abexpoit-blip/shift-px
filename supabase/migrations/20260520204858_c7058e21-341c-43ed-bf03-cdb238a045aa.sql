-- Phase 2: Branded Prelander System

-- 1. Per-link branding (logo + colors + name + tagline)
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS brand_tagline text,
  ADD COLUMN IF NOT EXISTS brand_color text;

-- 2. Country / device targeting on prelander variants
ALTER TABLE public.prelander_variants
  ADD COLUMN IF NOT EXISTS country_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS device text NOT NULL DEFAULT 'any';

-- 'any' | 'mobile' | 'desktop' | 'tablet'
ALTER TABLE public.prelander_variants
  DROP CONSTRAINT IF EXISTS prelander_variants_device_check;
ALTER TABLE public.prelander_variants
  ADD CONSTRAINT prelander_variants_device_check
  CHECK (device IN ('any','mobile','desktop','tablet'));

CREATE INDEX IF NOT EXISTS idx_prelander_variants_country
  ON public.prelander_variants USING GIN (country_codes);
CREATE INDEX IF NOT EXISTS idx_prelander_variants_device
  ON public.prelander_variants (device) WHERE is_active = true;

-- 3. Public storage bucket for per-link logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('link-logos', 'link-logos', true, 2097152,
        ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'];

-- RLS for link-logos: public read, owner write under {user_id}/...
DROP POLICY IF EXISTS "Public read link logos" ON storage.objects;
CREATE POLICY "Public read link logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'link-logos');

DROP POLICY IF EXISTS "Users upload own link logos" ON storage.objects;
CREATE POLICY "Users upload own link logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'link-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own link logos" ON storage.objects;
CREATE POLICY "Users update own link logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'link-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own link logos" ON storage.objects;
CREATE POLICY "Users delete own link logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'link-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );