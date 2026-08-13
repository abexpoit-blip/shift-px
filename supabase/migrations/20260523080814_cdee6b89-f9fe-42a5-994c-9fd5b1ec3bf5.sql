
-- ========== DROP EVERYTHING ==========
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS public.ad_rotation_config, public.admin_audit_logs, public.bot_protection_config,
  public.clicks, public.custom_domains, public.domain_health_checks, public.duplicate_clicks,
  public.fb_asn_blocklist, public.link_destinations, public.link_device_rules, public.link_geo_rules,
  public.link_time_rules, public.link_variant_overrides, public.link_variant_tests, public.links,
  public.packages, public.payment_settings, public.plisio_activity_log, public.plisio_webhook_logs,
  public.plisio_webhook_retry_queue, public.prelander_variants, public.profiles, public.referer_rules,
  public.shared_domains, public.upgrade_requests, public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at, public.has_role(uuid, public.app_role),
  public.handle_new_user, public.increment_link_clicks(uuid), public.increment_link_bot_clicks(uuid),
  public.enforce_link_quota, public.decrement_link_count, public.sync_quota_on_plan_change,
  public.clicks_daily(timestamptz, uuid), public.clicks_breakdown(timestamptz, uuid, text),
  public.get_user_click_status(uuid), public.check_and_increment_user_clicks(uuid) CASCADE;
DROP TYPE IF EXISTS public.app_role, public.link_status CASCADE;
DELETE FROM auth.users;

-- ========== NEW SCHEMA ==========
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "ur_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ur_admin" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- packages
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  price_usd numeric NOT NULL DEFAULT 0,
  click_quota bigint,
  link_limit int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pkg_view" ON public.packages FOR SELECT USING (is_active = true);
CREATE POLICY "pkg_admin" ON public.packages FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.packages (slug, name, price_usd, click_quota, link_limit, sort_order) VALUES
  ('free',     'Free',      0,     1000,   1,   0),
  ('starter',  'Starter',   9.99,  50000,  5,   1),
  ('pro',      'Pro',       29.99, 500000, 20,  2),
  ('unlimited','Unlimited', 99,    NULL,   100, 3);

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  plan_slug text NOT NULL DEFAULT 'free' REFERENCES public.packages(slug),
  click_quota bigint DEFAULT 1000,
  clicks_used bigint NOT NULL DEFAULT 0,
  clicks_period_start timestamptz NOT NULL DEFAULT now(),
  link_limit int NOT NULL DEFAULT 1,
  links_used int NOT NULL DEFAULT 0,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_own_s" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "p_own_u" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "p_adm_s" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "p_adm_u" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- links
CREATE TABLE public.links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_code text UNIQUE NOT NULL,
  title text,
  adsterra_url text NOT NULL,
  safe_url text NOT NULL DEFAULT 'https://sleepox.com/',
  is_active boolean NOT NULL DEFAULT true,
  clicks_count int NOT NULL DEFAULT 0,
  bot_clicks_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_links_user ON public.links(user_id);
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "l_own_s" ON public.links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "l_own_i" ON public.links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "l_own_u" ON public.links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "l_own_d" ON public.links FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "l_adm_s" ON public.links FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_links BEFORE UPDATE ON public.links FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- clicks
CREATE TABLE public.clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  ip text,
  country text,
  ua text,
  is_bot boolean NOT NULL DEFAULT false,
  bot_reason text,
  routed_to text NOT NULL DEFAULT 'offer',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clicks_link ON public.clicks(link_id, created_at DESC);
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "c_own_s" ON public.clicks FOR SELECT USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = clicks.link_id AND l.user_id = auth.uid()));
CREATE POLICY "c_adm_s" ON public.clicks FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- upgrade_requests
CREATE TABLE public.upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_slug text NOT NULL REFERENCES public.packages(slug),
  amount numeric NOT NULL DEFAULT 0,
  plisio_invoice_id text,
  plisio_invoice_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_own_s" ON public.upgrade_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ur_own_i" ON public.upgrade_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ur_adm_s" ON public.upgrade_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_adm_u" ON public.upgrade_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_ur BEFORE UPDATE ON public.upgrade_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- bot_rules
CREATE TABLE public.bot_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL,
  pattern text NOT NULL,
  action text NOT NULL DEFAULT 'safe',
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br_adm" ON public.bot_rules FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.bot_rules (rule_type, pattern, label) VALUES
  ('ua', 'facebookexternalhit', 'Facebook crawler'),
  ('ua', 'facebookcatalog', 'Facebook catalog bot'),
  ('ua', 'meta-externalagent', 'Meta agent'),
  ('ua', 'bytespider', 'TikTok ByteSpider'),
  ('ua', 'googlebot', 'Google bot'),
  ('ua', 'bingbot', 'Bing bot'),
  ('ua', 'ahrefsbot', 'Ahrefs'),
  ('ua', 'semrushbot', 'Semrush'),
  ('ua', 'curl/', 'curl'),
  ('ua', 'wget/', 'wget'),
  ('ua', 'python-requests', 'Python requests'),
  ('ua', 'headlesschrome', 'Headless Chrome'),
  ('ua', 'phantomjs', 'PhantomJS'),
  ('ua', 'puppeteer', 'Puppeteer');

-- handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role := 'user';
BEGIN
  IF NEW.email = 'admin@sleepox.com' THEN v_role := 'admin'; END IF;
  INSERT INTO public.profiles (id, email, full_name, plan_slug, click_quota, link_limit)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          CASE WHEN v_role='admin' THEN 'unlimited' ELSE 'free' END,
          CASE WHEN v_role='admin' THEN NULL ELSE 1000 END,
          CASE WHEN v_role='admin' THEN 100 ELSE 1 END);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
