-- ============================================
-- Batch 1: Cloaking & Defense schema
-- ============================================

-- Per-link geo-based destination overrides
CREATE TABLE public.link_geo_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (length(country_code) = 2),
  adsterra_url text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, country_code)
);
CREATE INDEX idx_link_geo_rules_link ON public.link_geo_rules(link_id) WHERE is_active = true;

ALTER TABLE public.link_geo_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view geo rules" ON public.link_geo_rules
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners insert geo rules" ON public.link_geo_rules
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners update geo rules" ON public.link_geo_rules
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners delete geo rules" ON public.link_geo_rules
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Admins view all geo rules" ON public.link_geo_rules
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_link_geo_rules_updated
  BEFORE UPDATE ON public.link_geo_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Per-link device+os destination overrides
CREATE TABLE public.link_device_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  device text NOT NULL CHECK (device IN ('mobile','tablet','desktop','any')),
  os text NOT NULL DEFAULT 'any',
  adsterra_url text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, device, os)
);
CREATE INDEX idx_link_device_rules_link ON public.link_device_rules(link_id) WHERE is_active = true;

ALTER TABLE public.link_device_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view device rules" ON public.link_device_rules
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners insert device rules" ON public.link_device_rules
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners update device rules" ON public.link_device_rules
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Owners delete device rules" ON public.link_device_rules
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY "Admins view all device rules" ON public.link_device_rules
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_link_device_rules_updated
  BEFORE UPDATE ON public.link_device_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Global FB / Meta ASN + IP blocklist (admin only)
CREATE TABLE public.fb_asn_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asn integer,
  ip_cidr text,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (asn IS NOT NULL OR ip_cidr IS NOT NULL)
);
CREATE INDEX idx_fb_blocklist_asn ON public.fb_asn_blocklist(asn) WHERE is_active = true AND asn IS NOT NULL;
CREATE INDEX idx_fb_blocklist_cidr ON public.fb_asn_blocklist(ip_cidr) WHERE is_active = true AND ip_cidr IS NOT NULL;

ALTER TABLE public.fb_asn_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view FB blocklist" ON public.fb_asn_blocklist
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert FB blocklist" ON public.fb_asn_blocklist
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update FB blocklist" ON public.fb_asn_blocklist
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete FB blocklist" ON public.fb_asn_blocklist
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_fb_blocklist_updated
  BEFORE UPDATE ON public.fb_asn_blocklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed with well-known Meta / Facebook entries
INSERT INTO public.fb_asn_blocklist (asn, ip_cidr, label) VALUES
  (32934, NULL, 'Meta / Facebook (AS32934)'),
  (54115, NULL, 'Facebook Edge (AS54115)'),
  (63293, NULL, 'Facebook Backbone (AS63293)'),
  (NULL, '31.13.24.0/21', 'Facebook IPv4 range 31.13.24.0/21'),
  (NULL, '31.13.64.0/18', 'Facebook IPv4 range 31.13.64.0/18'),
  (NULL, '66.220.144.0/20', 'Facebook IPv4 range 66.220.144.0/20'),
  (NULL, '69.63.176.0/20', 'Facebook IPv4 range 69.63.176.0/20'),
  (NULL, '69.171.224.0/19', 'Facebook IPv4 range 69.171.224.0/19'),
  (NULL, '74.119.76.0/22', 'Facebook IPv4 range 74.119.76.0/22'),
  (NULL, '102.132.96.0/20', 'Facebook IPv4 range 102.132.96.0/20'),
  (NULL, '157.240.0.0/16', 'Facebook IPv4 range 157.240.0.0/16'),
  (NULL, '173.252.64.0/18', 'Facebook IPv4 range 173.252.64.0/18'),
  (NULL, '179.60.192.0/22', 'Facebook IPv4 range 179.60.192.0/22'),
  (NULL, '185.60.216.0/22', 'Facebook IPv4 range 185.60.216.0/22'),
  (NULL, '199.201.64.0/22', 'Facebook IPv4 range 199.201.64.0/22'),
  (NULL, '204.15.20.0/22', 'Facebook IPv4 range 204.15.20.0/22');

-- Global referer rules (admin only)
CREATE TABLE public.referer_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_pattern text NOT NULL,
  action text NOT NULL CHECK (action IN ('safe','cloak','pass')),
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referer_rules_active ON public.referer_rules(priority) WHERE is_active = true;

ALTER TABLE public.referer_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view referer rules" ON public.referer_rules
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert referer rules" ON public.referer_rules
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update referer rules" ON public.referer_rules
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete referer rules" ON public.referer_rules
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_referer_rules_updated
  BEFORE UPDATE ON public.referer_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.referer_rules (host_pattern, action, priority, note) VALUES
  ('developers.facebook.com', 'safe', 10, 'FB dev tools — always safe'),
  ('business.facebook.com', 'safe', 10, 'FB Business Manager'),
  ('transparency.fb.com', 'safe', 10, 'FB Ad Library'),
  ('google.com', 'safe', 50, 'Google organic — safe by default'),
  ('bing.com', 'safe', 50, 'Bing organic — safe by default');

-- Duplicate click memory (internal table, no user RLS)
CREATE TABLE public.duplicate_clicks (
  ip text NOT NULL,
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  last_seen timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, link_id)
);
CREATE INDEX idx_duplicate_clicks_last_seen ON public.duplicate_clicks(last_seen);

ALTER TABLE public.duplicate_clicks ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Only service role (server functions) can read/write.

-- Extend links table
ALTER TABLE public.links
  ADD COLUMN duplicate_protection boolean NOT NULL DEFAULT true,
  ADD COLUMN duplicate_window_minutes integer NOT NULL DEFAULT 30 CHECK (duplicate_window_minutes BETWEEN 1 AND 1440);
