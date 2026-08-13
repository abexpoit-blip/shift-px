
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS referer_host text;

CREATE INDEX IF NOT EXISTS clicks_link_id_created_at_idx
  ON public.clicks (link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clicks_utm_source_idx
  ON public.clicks (link_id, utm_source);

ALTER TABLE public.clicks REPLICA IDENTITY FULL;
ALTER TABLE public.links REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clicks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.links;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
