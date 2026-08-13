-- Link Performance Score
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS health_score integer,
  ADD COLUMN IF NOT EXISTS health_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_links_health_score ON public.links(health_score DESC NULLS LAST);

-- A/B Variant Test Tracking
CREATE TABLE IF NOT EXISTS public.link_variant_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL,
  variant_slug text NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active | paused | winner
  total_clicks integer NOT NULL DEFAULT 0,
  human_clicks integer NOT NULL DEFAULT 0,
  bot_clicks integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz,
  paused_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, variant_slug)
);

CREATE INDEX IF NOT EXISTS idx_link_variant_tests_link ON public.link_variant_tests(link_id);
CREATE INDEX IF NOT EXISTS idx_link_variant_tests_status ON public.link_variant_tests(status);

ALTER TABLE public.link_variant_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view variant tests"
  ON public.link_variant_tests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_variant_tests.link_id AND l.user_id = auth.uid()));

CREATE POLICY "Admins view all variant tests"
  ON public.link_variant_tests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_link_variant_tests_updated_at
  BEFORE UPDATE ON public.link_variant_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();