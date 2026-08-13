
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL UNIQUE,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY cd_own_s ON public.custom_domains FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cd_own_i ON public.custom_domains FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cd_own_u ON public.custom_domains FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY cd_own_d ON public.custom_domains FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY cd_adm_all ON public.custom_domains FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS custom_domains_user_idx ON public.custom_domains(user_id);
