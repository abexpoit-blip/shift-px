CREATE TABLE IF NOT EXISTS public.monitored_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  status TEXT,
  ssl_valid BOOLEAN,
  ssl_expires_at TIMESTAMPTZ,
  ssl_days_remaining INTEGER,
  ssl_issuer TEXT,
  dns_ok BOOLEAN,
  http_status INTEGER,
  http_final_url TEXT,
  redirect_count INTEGER,
  blacklisted BOOLEAN,
  blacklist_sources JSONB,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitored_domains TO authenticated;
GRANT ALL ON public.monitored_domains TO service_role;
ALTER TABLE public.monitored_domains ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS ssl_valid BOOLEAN;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS ssl_expires_at TIMESTAMPTZ;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS ssl_days_remaining INTEGER;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS ssl_issuer TEXT;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS dns_ok BOOLEAN;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS http_status INTEGER;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS http_final_url TEXT;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS redirect_count INTEGER;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS blacklist_sources JSONB;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.monitored_domains ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitored_domains' AND policyname = 'md_admin_all'
  ) THEN
    CREATE POLICY md_admin_all ON public.monitored_domains
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitored_domains_status ON public.monitored_domains(status);
CREATE INDEX IF NOT EXISTS idx_monitored_domains_active ON public.monitored_domains(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_monitored_domains_updated_at ON public.monitored_domains;
CREATE TRIGGER trg_monitored_domains_updated_at
  BEFORE UPDATE ON public.monitored_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.domain_health_checks (
  id BIGSERIAL PRIMARY KEY,
  domain_id UUID NOT NULL,
  domain TEXT,
  status TEXT NOT NULL DEFAULT 'warning',
  ssl_valid BOOLEAN,
  ssl_expires_at TIMESTAMPTZ,
  ssl_days_remaining INTEGER,
  ssl_issuer TEXT,
  dns_ok BOOLEAN,
  http_status INTEGER,
  http_final_url TEXT,
  redirect_count INTEGER,
  blacklisted BOOLEAN,
  blacklist_sources JSONB,
  error_message TEXT,
  raw JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.domain_health_checks TO authenticated;
GRANT ALL ON public.domain_health_checks TO service_role;
ALTER TABLE public.domain_health_checks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'warning';
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS ssl_valid BOOLEAN;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS ssl_expires_at TIMESTAMPTZ;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS ssl_days_remaining INTEGER;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS ssl_issuer TEXT;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS dns_ok BOOLEAN;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS http_status INTEGER;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS http_final_url TEXT;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS redirect_count INTEGER;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS blacklist_sources JSONB;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS raw JSONB;
ALTER TABLE public.domain_health_checks ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'domain_health_checks' AND policyname = 'dhc_admin_all'
  ) THEN
    CREATE POLICY dhc_admin_all ON public.domain_health_checks
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dhc_domain_id_checked_at ON public.domain_health_checks(domain_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_dhc_checked_at ON public.domain_health_checks(checked_at DESC);

CREATE OR REPLACE FUNCTION public.prune_domain_health_history()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.domain_health_checks WHERE checked_at < now() - interval '30 days';
$$;

NOTIFY pgrst, 'reload schema';