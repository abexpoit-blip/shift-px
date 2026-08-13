
CREATE TABLE public.shared_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  ip_address text NOT NULL,
  label text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all shared domains"
  ON public.shared_domains FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth users view active shared domains"
  ON public.shared_domains FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins insert shared domains"
  ON public.shared_domains FOR INSERT
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update shared domains"
  ON public.shared_domains FOR UPDATE
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete shared domains"
  ON public.shared_domains FOR DELETE
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER shared_domains_updated_at
  BEFORE UPDATE ON public.shared_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_shared_domains_active ON public.shared_domains(is_active) WHERE is_active = true;
