CREATE TABLE IF NOT EXISTS public.custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'action_required',
  verification_token TEXT NOT NULL DEFAULT ('lovable_verify=' || replace(gen_random_uuid()::text, '-', '')),
  dns_target TEXT NOT NULL DEFAULT '185.158.133.1',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custom_domains_domain_format CHECK (domain ~* '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  CONSTRAINT custom_domains_status_check CHECK (status IN ('action_required', 'verifying', 'setting_up', 'ready', 'active', 'offline', 'failed')),
  CONSTRAINT custom_domains_user_domain_unique UNIQUE (user_id, domain)
);

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_custom_domains_user_id ON public.custom_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_status ON public.custom_domains(status);

DROP POLICY IF EXISTS "Users view own custom domains" ON public.custom_domains;
CREATE POLICY "Users view own custom domains"
ON public.custom_domains
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own custom domains" ON public.custom_domains;
CREATE POLICY "Users create own custom domains"
ON public.custom_domains
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own custom domains" ON public.custom_domains;
CREATE POLICY "Users update own custom domains"
ON public.custom_domains
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own custom domains" ON public.custom_domains;
CREATE POLICY "Users delete own custom domains"
ON public.custom_domains
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_custom_domains_updated_at ON public.custom_domains;
CREATE TRIGGER update_custom_domains_updated_at
BEFORE UPDATE ON public.custom_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();