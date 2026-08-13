
CREATE TABLE IF NOT EXISTS public.shortener_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  dns_target text NOT NULL DEFAULT '185.158.133.1',
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shortener_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sd_read_auth ON public.shortener_domains;
CREATE POLICY sd_read_auth ON public.shortener_domains
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sd_admin_all ON public.shortener_domains;
CREATE POLICY sd_admin_all ON public.shortener_domains
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX IF NOT EXISTS shortener_domains_one_primary
  ON public.shortener_domains ((is_primary)) WHERE is_primary = true;

CREATE OR REPLACE FUNCTION public.shortener_domains_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS shortener_domains_touch ON public.shortener_domains;
CREATE TRIGGER shortener_domains_touch
  BEFORE UPDATE ON public.shortener_domains
  FOR EACH ROW EXECUTE FUNCTION public.shortener_domains_touch();

-- Seed with sleepox.com as primary (idempotent)
INSERT INTO public.shortener_domains (domain, is_primary, is_active, verified, verified_at, note)
VALUES ('sleepox.com', true, true, true, now(), 'Default primary shortener domain')
ON CONFLICT (domain) DO NOTHING;
