
-- Monitored offer domains
CREATE TABLE public.monitored_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  -- denormalized latest result for fast list display
  status TEXT,                        -- 'healthy' | 'warning' | 'critical' | NULL (never checked)
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
CREATE POLICY md_admin_all ON public.monitored_domains
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_monitored_domains_status ON public.monitored_domains(status);
CREATE INDEX idx_monitored_domains_active ON public.monitored_domains(is_active) WHERE is_active = true;

CREATE TRIGGER trg_monitored_domains_updated_at
  BEFORE UPDATE ON public.monitored_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- History of every health check
CREATE TABLE public.domain_health_checks (
  id BIGSERIAL PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.monitored_domains(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
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
CREATE POLICY dhc_admin_all ON public.domain_health_checks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_dhc_domain_id_checked_at ON public.domain_health_checks(domain_id, checked_at DESC);
CREATE INDEX idx_dhc_checked_at ON public.domain_health_checks(checked_at DESC);

-- Helper: prune health history older than 30 days
CREATE OR REPLACE FUNCTION public.prune_domain_health_history()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.domain_health_checks WHERE checked_at < now() - interval '30 days';
$$;
