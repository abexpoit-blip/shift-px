ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
UPDATE public.packages SET is_featured = true WHERE slug = 'lifetime';