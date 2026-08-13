ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS targeting jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.link_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS link_destinations_link_id_idx
  ON public.link_destinations(link_id);

ALTER TABLE public.link_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view destinations"
  ON public.link_destinations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Owners insert destinations"
  ON public.link_destinations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Owners update destinations"
  ON public.link_destinations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Owners delete destinations"
  ON public.link_destinations FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Admins view all destinations"
  ON public.link_destinations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_link_destinations_updated_at
  BEFORE UPDATE ON public.link_destinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();