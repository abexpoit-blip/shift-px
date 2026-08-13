
-- link_time_rules
CREATE TABLE public.link_time_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL,
  days_mask integer NOT NULL DEFAULT 127, -- bit per day, Sun=1
  start_minute integer NOT NULL DEFAULT 0, -- minutes since 00:00
  end_minute integer NOT NULL DEFAULT 1440,
  action text NOT NULL DEFAULT 'cloak',
  timezone text NOT NULL DEFAULT 'UTC',
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ltr_action_chk CHECK (action IN ('safe','cloak','pass')),
  CONSTRAINT ltr_days_chk CHECK (days_mask BETWEEN 1 AND 127),
  CONSTRAINT ltr_window_chk CHECK (start_minute BETWEEN 0 AND 1440 AND end_minute BETWEEN 0 AND 1440),
  CONSTRAINT ltr_priority_chk CHECK (priority BETWEEN 0 AND 10000)
);

CREATE INDEX idx_link_time_rules_link ON public.link_time_rules(link_id, is_active, priority);

ALTER TABLE public.link_time_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view time rules" ON public.link_time_rules
  FOR SELECT USING (EXISTS (SELECT 1 FROM links l WHERE l.id = link_time_rules.link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners insert time rules" ON public.link_time_rules
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM links l WHERE l.id = link_time_rules.link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners update time rules" ON public.link_time_rules
  FOR UPDATE USING (EXISTS (SELECT 1 FROM links l WHERE l.id = link_time_rules.link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners delete time rules" ON public.link_time_rules
  FOR DELETE USING (EXISTS (SELECT 1 FROM links l WHERE l.id = link_time_rules.link_id AND l.user_id = auth.uid()));
CREATE POLICY "Admins view all time rules" ON public.link_time_rules
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'::app_role));

-- domain_health_checks
CREATE TABLE public.domain_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  dns_ok boolean NOT NULL DEFAULT false,
  http_ok boolean NOT NULL DEFAULT false,
  http_status integer,
  dns_target_observed text,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_domain_health_domain_time ON public.domain_health_checks(domain_id, checked_at DESC);

ALTER TABLE public.domain_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view domain health" ON public.domain_health_checks
  FOR SELECT USING (EXISTS (SELECT 1 FROM custom_domains d WHERE d.id = domain_health_checks.domain_id AND d.user_id = auth.uid()));
CREATE POLICY "Admins view all domain health" ON public.domain_health_checks
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'::app_role));
