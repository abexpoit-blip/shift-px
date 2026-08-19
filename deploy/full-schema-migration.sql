
-- ==================== MIGRATION: 20260518171033_a4ca276e-2d45-4a83-a0be-7983372b00d9.sql ====================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.link_status AS ENUM ('active', 'paused', 'expired');

CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  link_limit INTEGER NOT NULL DEFAULT 50,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active packages" ON public.packages FOR SELECT USING (is_active = true);

INSERT INTO public.packages (name, slug, price_monthly, link_limit, features, sort_order) VALUES
  ('Starter', 'starter', 9, 50, '["50 short links/month","Basic analytics","Bot filtering","Email support"]'::jsonb, 1),
  ('Pro', 'pro', 29, 500, '["500 short links/month","Advanced analytics","Bot & fraud filter","Click heatmap","Priority support"]'::jsonb, 2),
  ('Agency', 'agency', 79, 5000, '["5,000 short links/month","All Pro features","Custom domains","Team accounts","API access","24/7 support"]'::jsonb, 3);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan_slug TEXT NOT NULL DEFAULT 'starter',
  link_quota INTEGER NOT NULL DEFAULT 50,
  links_used INTEGER NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$fn$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_code TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  title TEXT,
  status link_status NOT NULL DEFAULT 'active',
  clicks_count INTEGER NOT NULL DEFAULT 0,
  bot_clicks_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_links_user_id ON public.links(user_id);
CREATE INDEX idx_links_short_code ON public.links(short_code);
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own links" ON public.links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own links" ON public.links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own links" ON public.links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own links" ON public.links FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all links" ON public.links FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  bot_reason TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clicks_link_id ON public.clicks(link_id);
CREATE INDEX idx_clicks_created_at ON public.clicks(created_at DESC);
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view clicks on own links" ON public.clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.links WHERE links.id = clicks.link_id AND links.user_id = auth.uid()));
CREATE POLICY "Admins view all clicks" ON public.clicks FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER links_updated_at BEFORE UPDATE ON public.links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==================== MIGRATION: 20260518171106_44191a1c-518e-4fcc-8bc8-7480e2beb455.sql ====================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;

-- ==================== MIGRATION: 20260518171132_0a085515-3baf-40e5-8196-024a0bb74288.sql ====================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;

-- ==================== MIGRATION: 20260518182308_9aa04c13-a4f2-464f-8044-78effb828bd3.sql ====================
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS variant text DEFAULT 'wellness';
CREATE INDEX IF NOT EXISTS idx_clicks_link_id_created ON public.clicks(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_is_bot ON public.clicks(is_bot);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON public.clicks(country);
CREATE INDEX IF NOT EXISTS idx_clicks_variant ON public.clicks(variant);

-- ==================== MIGRATION: 20260518183628_a0898692-7f1d-4434-8d82-6efadb9b4fed.sql ====================
-- Pre-lander variant content (editable by admins)
CREATE TABLE public.prelander_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  outro text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prelander_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active variants"
  ON public.prelander_variants FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins view all variants"
  ON public.prelander_variants FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert variants"
  ON public.prelander_variants FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update variants"
  ON public.prelander_variants FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete variants"
  ON public.prelander_variants FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER prelander_variants_updated_at
  BEFORE UPDATE ON public.prelander_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Per-link forced winner (admin override)
CREATE TABLE public.link_variant_overrides (
  link_id uuid PRIMARY KEY,
  variant_slug text NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.link_variant_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all overrides"
  ON public.link_variant_overrides FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own overrides"
  ON public.link_variant_overrides FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.links
    WHERE links.id = link_variant_overrides.link_id
      AND links.user_id = auth.uid()
  ));

CREATE POLICY "Admins insert overrides"
  ON public.link_variant_overrides FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update overrides"
  ON public.link_variant_overrides FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete overrides"
  ON public.link_variant_overrides FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER link_variant_overrides_updated_at
  BEFORE UPDATE ON public.link_variant_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_link_variant_overrides_slug ON public.link_variant_overrides(variant_slug);

-- Seed the three existing variants
INSERT INTO public.prelander_variants (slug, category, title, subtitle, intro, sections, outro, sort_order) VALUES
('wellness',
 'Health & Wellness',
 '5 Simple Habits That Can Transform Your Daily Routine',
 'Published today Â· 4 min read',
 'Building a healthier, more productive routine doesn''t require a complete life overhaul. Small, consistent habits â€” practiced daily â€” create the biggest long-term changes. Here are five evidence-backed habits anyone can start this week.',
 '[
   {"heading":"1. Start your morning with water","body":"After 7-8 hours of sleep your body is mildly dehydrated. A glass of water before coffee kickstarts your metabolism and improves morning focus."},
   {"heading":"2. Move for 10 minutes","body":"You don''t need a gym. A brisk 10-minute walk or short stretching session boosts circulation and mood."},
   {"heading":"3. Plan three priorities","body":"Pick the three most important tasks for the day. This reduces decision fatigue and helps you finish what truly matters."},
   {"heading":"4. Take screen-free breaks","body":"Every 60-90 minutes, step away from screens for a few minutes. Your eyes, posture and concentration all benefit."},
   {"heading":"5. Wind down with a routine","body":"A consistent evening routine signals your body it''s time to rest. Dim lights, avoid heavy meals, and read instead of scrolling."}
 ]'::jsonb,
 'Try one habit this week. Once it sticks, add the next. Small steps compound into big results.',
 10),
('productivity',
 'Work & Productivity',
 'How High Performers Stay Focused All Day Without Burnout',
 'Published today Â· 5 min read',
 'Productivity isn''t about doing more â€” it''s about doing the right things, consistently. Top performers across industries share a small set of focus habits that anyone can copy. Here''s a practical breakdown.',
 '[
   {"heading":"1. Protect the first 90 minutes","body":"Your willpower is highest right after waking. Spend the first 90 minutes on deep work â€” no meetings, no email, no social media."},
   {"heading":"2. Use the two-minute rule","body":"If a task takes less than two minutes, do it immediately. Anything longer goes on the priority list."},
   {"heading":"3. Batch shallow work","body":"Group emails, messages and admin into 1-2 windows per day instead of reacting to them all day long."},
   {"heading":"4. Single-task with a timer","body":"A 25-minute focused block with no notifications beats 60 minutes of fragmented attention."},
   {"heading":"5. End the day with a shutdown ritual","body":"Write tomorrow''s top three tasks before you stop. Your brain stops looping at night and you start sharper the next morning."}
 ]'::jsonb,
 'Pick one technique this week and stack the rest as it becomes automatic.',
 20),
('finance',
 'Personal Finance',
 '7 Money Habits That Quietly Build Long-Term Wealth',
 'Published today Â· 5 min read',
 'You don''t need a six-figure salary to build wealth â€” you need a few simple habits, repeated for years. These are the basics financial planners recommend, in plain language.',
 '[
   {"heading":"1. Pay yourself first","body":"Move a fixed amount to savings the day your salary lands â€” before any spending decisions."},
   {"heading":"2. Track where your money actually goes","body":"Most people overestimate income and underestimate spending. Two weeks of honest tracking changes habits faster than any budget app."},
   {"heading":"3. Keep a 1-month emergency buffer","body":"Even a small buffer prevents one bad month from turning into months of debt."},
   {"heading":"4. Avoid lifestyle inflation","body":"Every raise should partly go to savings before being absorbed into bigger expenses."},
   {"heading":"5. Automate the boring stuff","body":"Set up automatic transfers for savings, bills, and investments. Decisions you don''t have to make get made consistently."}
 ]'::jsonb,
 'Pick one habit and start this month. Wealth is built by what you do repeatedly, not what you do occasionally.',
 30);

-- ==================== MIGRATION: 20260518190148_72fef3d1-2659-43ee-afb1-a2fb4ea24214.sql ====================

CREATE TABLE IF NOT EXISTS public.bot_protection_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ip_rate_limit_per_min INTEGER NOT NULL DEFAULT 30,
  ip_rate_limit_window_sec INTEGER NOT NULL DEFAULT 60,
  suspicious_action TEXT NOT NULL DEFAULT 'safe_page',
  block_threshold_score INTEGER NOT NULL DEFAULT 60,
  safe_page_message TEXT NOT NULL DEFAULT 'This article is temporarily unavailable. Please check back later.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bot_protection_config_singleton CHECK (id = 1),
  CONSTRAINT bot_protection_config_action CHECK (suspicious_action IN ('block','safe_page','allow'))
);

INSERT INTO public.bot_protection_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bot_protection_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read protection config"
  ON public.bot_protection_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update protection config"
  ON public.bot_protection_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS clicks_ip_created_idx
  ON public.clicks (ip_address, created_at DESC);


-- ==================== MIGRATION: 20260518191653_1784e437-1d98-4eb3-817f-503e9150895a.sql ====================

ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS referer_host text;

CREATE INDEX IF NOT EXISTS clicks_link_id_created_at_idx
  ON public.clicks (link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clicks_utm_source_idx
  ON public.clicks (link_id, utm_source);

ALTER TABLE public.clicks REPLICA IDENTITY FULL;
ALTER TABLE public.links REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clicks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.links;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- ==================== MIGRATION: 20260518200226_90419824-6221-4e0e-a025-c5a7e2305e48.sql ====================
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS targeting jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.link_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS link_destinations_link_id_idx
  ON public.link_destinations(link_id);

ALTER TABLE public.link_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view destinations"
  ON public.link_destinations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Owners insert destinations"
  ON public.link_destinations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Owners update destinations"
  ON public.link_destinations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Owners delete destinations"
  ON public.link_destinations FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY "Admins view all destinations"
  ON public.link_destinations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_link_destinations_updated_at
  BEFORE UPDATE ON public.link_destinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==================== MIGRATION: 20260518204243_47122699-dc67-4d71-8932-e2a565a1521a.sql ====================
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

-- ==================== MIGRATION: 20260518204404_e0a6ded9-0126-4509-bccb-eedb47b59d46.sql ====================
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

DROP POLICY IF EXISTS "Admins can read protection config" ON public.bot_protection_config;
CREATE POLICY "Admins can read protection config"
ON public.bot_protection_config
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update protection config" ON public.bot_protection_config;
CREATE POLICY "Admins can update protection config"
ON public.bot_protection_config
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view all clicks" ON public.clicks;
CREATE POLICY "Admins view all clicks"
ON public.clicks
FOR SELECT
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view all destinations" ON public.link_destinations;
CREATE POLICY "Admins view all destinations"
ON public.link_destinations
FOR SELECT
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete overrides" ON public.link_variant_overrides;
CREATE POLICY "Admins delete overrides"
ON public.link_variant_overrides
FOR DELETE
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins insert overrides" ON public.link_variant_overrides;
CREATE POLICY "Admins insert overrides"
ON public.link_variant_overrides
FOR INSERT
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update overrides" ON public.link_variant_overrides;
CREATE POLICY "Admins update overrides"
ON public.link_variant_overrides
FOR UPDATE
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view all overrides" ON public.link_variant_overrides;
CREATE POLICY "Admins view all overrides"
ON public.link_variant_overrides
FOR SELECT
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view all links" ON public.links;
CREATE POLICY "Admins view all links"
ON public.links
FOR SELECT
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete variants" ON public.prelander_variants;
CREATE POLICY "Admins delete variants"
ON public.prelander_variants
FOR DELETE
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins insert variants" ON public.prelander_variants;
CREATE POLICY "Admins insert variants"
ON public.prelander_variants
FOR INSERT
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update variants" ON public.prelander_variants;
CREATE POLICY "Admins update variants"
ON public.prelander_variants
FOR UPDATE
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view all variants" ON public.prelander_variants;
CREATE POLICY "Admins view all variants"
ON public.prelander_variants
FOR SELECT
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles"
ON public.profiles
FOR UPDATE
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles"
ON public.profiles
FOR SELECT
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles"
ON public.user_roles
FOR SELECT
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ==================== MIGRATION: 20260518210558_2257c068-c451-485a-aadd-9c5f0998b975.sql ====================
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- ==================== MIGRATION: 20260518214702_21ae2485-2378-4280-a9ec-b202bd3b87fc.sql ====================

CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  resource text,
  status text NOT NULL DEFAULT 'success',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_admin_audit_logs_user_id ON public.admin_audit_logs (user_id);
CREATE INDEX idx_admin_audit_logs_status ON public.admin_audit_logs (status);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));


-- ==================== MIGRATION: 20260519171958_3dbe5c7a-a7c5-4548-8db3-798abf4f3daa.sql ====================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;

-- ==================== MIGRATION: 20260519180129_d759aa56-92d4-4952-ba8f-8f78a83ae4cc.sql ====================
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_direct_link TEXT;

-- ==================== MIGRATION: 20260519182959_40407e35-9250-4ccf-bb01-137f25003a09.sql ====================
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
  ('developers.facebook.com', 'safe', 10, 'FB dev tools â€” always safe'),
  ('business.facebook.com', 'safe', 10, 'FB Business Manager'),
  ('transparency.fb.com', 'safe', 10, 'FB Ad Library'),
  ('google.com', 'safe', 50, 'Google organic â€” safe by default'),
  ('bing.com', 'safe', 50, 'Bing organic â€” safe by default');

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


-- ==================== MIGRATION: 20260519183818_0e23ccdc-7b96-4ed7-8e2b-13572921b417.sql ====================
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

-- ==================== MIGRATION: 20260519184745_fb5203f6-bab7-4a42-ada1-3383c7f1ede8.sql ====================

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


-- ==================== MIGRATION: 20260519185813_bce1dab7-3e7f-4e30-bbea-f3b711d402f2.sql ====================

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


-- ==================== MIGRATION: 20260519190053_4caa4050-7bff-4354-b36f-24966fc1f481.sql ====================

GRANT USAGE ON SCHEMA private TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon;


-- ==================== MIGRATION: 20260519191059_a5bbdc6d-7a71-4ae9-949c-ada8ceeb3c8f.sql ====================

-- 1) Admin CRUD on packages
CREATE POLICY "Admins manage packages insert"
ON public.packages FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage packages update"
ON public.packages FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage packages delete"
ON public.packages FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view all packages"
ON public.packages FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Seed default packages (idempotent)
INSERT INTO public.packages (slug, name, price_monthly, link_limit, features, sort_order, is_active)
VALUES
  ('free', 'Free', 0, 1, '["1 short link","Basic analytics"]'::jsonb, 0, true),
  ('pro',  'Pro',  9.99, 200, '["200 short links","Cloaking","Geo/Device targeting","Custom domains","Priority support"]'::jsonb, 10, true)
ON CONFLICT (slug) DO NOTHING;

-- 3) Default new users to free / quota 1
ALTER TABLE public.profiles ALTER COLUMN plan_slug SET DEFAULT 'free';
ALTER TABLE public.profiles ALTER COLUMN link_quota SET DEFAULT 1;

-- 4) Handle new user trigger: ensure profile created with free plan
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan_slug, link_quota, links_used)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'free', 1, 0);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) Enforce quota on link insert + maintain counter
CREATE OR REPLACE FUNCTION public.enforce_link_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_used INT;
  v_quota INT;
BEGIN
  SELECT links_used, link_quota INTO v_used, v_quota
  FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

  IF v_quota IS NULL THEN
    RAISE EXCEPTION 'No active plan. Please upgrade to create links.';
  END IF;

  IF v_used >= v_quota THEN
    RAISE EXCEPTION 'Link quota reached (%/%). Please upgrade your plan.', v_used, v_quota;
  END IF;

  UPDATE public.profiles SET links_used = links_used + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_link_quota ON public.links;
CREATE TRIGGER trg_enforce_link_quota
BEFORE INSERT ON public.links
FOR EACH ROW EXECUTE FUNCTION public.enforce_link_quota();

-- 6) Decrement on delete
CREATE OR REPLACE FUNCTION public.decrement_link_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET links_used = GREATEST(links_used - 1, 0) WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_link_count ON public.links;
CREATE TRIGGER trg_decrement_link_count
AFTER DELETE ON public.links
FOR EACH ROW EXECUTE FUNCTION public.decrement_link_count();

-- 7) Sync quota when plan_slug changes
CREATE OR REPLACE FUNCTION public.sync_quota_on_plan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limit INT;
BEGIN
  IF NEW.plan_slug IS DISTINCT FROM OLD.plan_slug THEN
    SELECT link_limit INTO v_limit FROM public.packages WHERE slug = NEW.plan_slug AND is_active = true;
    IF v_limit IS NOT NULL THEN
      NEW.link_quota := v_limit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quota_on_plan_change ON public.profiles;
CREATE TRIGGER trg_sync_quota_on_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_quota_on_plan_change();

-- 8) Payment settings table for Plisio (and future gateways)
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id INT PRIMARY KEY DEFAULT 1,
  plisio_enabled BOOLEAN NOT NULL DEFAULT false,
  plisio_api_key TEXT,
  plisio_webhook_secret TEXT,
  payment_instructions TEXT DEFAULT 'Crypto payments via Plisio coming soon. Contact admin for manual upgrade.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view payment settings"
ON public.payment_settings FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update payment settings"
ON public.payment_settings FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 9) Upgrade requests (user submits, admin approves)
CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  package_slug TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'manual',
  transaction_ref TEXT,
  amount NUMERIC,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user ON public.upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON public.upgrade_requests(status);

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own upgrade requests"
ON public.upgrade_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own upgrade requests"
ON public.upgrade_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all upgrade requests"
ON public.upgrade_requests FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update upgrade requests"
ON public.upgrade_requests FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));


-- ==================== MIGRATION: 20260519195232_8de487fd-bd1f-4689-bce3-0a3f2dfdb3c8.sql ====================

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@adspx.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      'admin@adspx.com',
      crypt('Shovon@5448', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@adspx.com', 'email_verified', true),
      'email', v_user_id::text, now(), now(), now());
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt('Shovon@5448', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, email, full_name, plan_slug, link_quota, links_used)
  VALUES (v_user_id, 'admin@adspx.com', 'Admin', 'free', 9999, 0)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Grant admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;


-- ==================== MIGRATION: 20260519202023_f4cf8bb7-73f3-4c9a-8831-c7f56fedb248.sql ====================
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON public.clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_link_id_created_at ON public.clicks (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_is_bot_created_at ON public.clicks (is_bot, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON public.clicks (country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_referer_host ON public.clicks (referer_host) WHERE referer_host IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status_created_at ON public.upgrade_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles (is_banned) WHERE is_banned = true;
CREATE INDEX IF NOT EXISTS idx_links_status ON public.links (status);
CREATE INDEX IF NOT EXISTS idx_links_user_id_created_at ON public.links (user_id, created_at DESC);

-- ==================== MIGRATION: 20260519203018_819d7fa9-4e39-4343-a855-fb4365afb5cb.sql ====================
-- Delete the old admin user (clicktaka@mailum.com) completely.
-- New admin admin@adspx.com remains intact.
DELETE FROM public.user_roles WHERE user_id = '0cde9c89-dedf-4a09-88e8-178552f75872';
DELETE FROM public.profiles WHERE id = '0cde9c89-dedf-4a09-88e8-178552f75872';
DELETE FROM auth.users WHERE id = '0cde9c89-dedf-4a09-88e8-178552f75872';

-- ==================== MIGRATION: 20260519205028_54d485d0-7bd4-41cb-b99d-32608ce6f415.sql ====================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clicks_verify_created_variant
ON public.clicks (created_at DESC, variant)
WHERE bot_reason LIKE 'verify:%' AND variant IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clicks_bot_reason_pattern
ON public.clicks (bot_reason text_pattern_ops)
WHERE bot_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
ON public.profiles USING gin (email gin_trgm_ops)
WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
ON public.profiles USING gin (full_name gin_trgm_ops)
WHERE full_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packages_active_sort
ON public.packages (is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_prelander_variants_sort
ON public.prelander_variants (sort_order);

-- ==================== MIGRATION: 20260519205216_6f93f271-00b8-48de-9bc3-883b84474324.sql ====================
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ==================== MIGRATION: 20260520124107_fcb3e411-fa27-4cae-b175-90294c590b7b.sql ====================

CREATE OR REPLACE FUNCTION public.clicks_daily(p_since timestamptz, p_link_id uuid DEFAULT NULL)
RETURNS TABLE(link_id uuid, day date, humans bigint, bots bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.link_id,
         (c.created_at AT TIME ZONE 'UTC')::date AS day,
         COUNT(*) FILTER (WHERE NOT c.is_bot) AS humans,
         COUNT(*) FILTER (WHERE c.is_bot) AS bots
  FROM public.clicks c
  WHERE c.created_at >= p_since
    AND (p_link_id IS NULL OR c.link_id = p_link_id)
  GROUP BY c.link_id, day;
$$;

GRANT EXECUTE ON FUNCTION public.clicks_daily(timestamptz, uuid) TO authenticated;


-- ==================== MIGRATION: 20260520124559_db4946d3-8bb5-4cfc-a3f0-2e63f28425e3.sql ====================

CREATE OR REPLACE FUNCTION public.clicks_breakdown(
  p_since timestamptz,
  p_link_id uuid,
  p_dim text
)
RETURNS TABLE(key text, total bigint, humans bigint, bots bigint)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_col text;
BEGIN
  v_col := CASE p_dim
    WHEN 'country' THEN 'country'
    WHEN 'device' THEN 'device'
    WHEN 'browser' THEN 'browser'
    WHEN 'os' THEN 'os'
    WHEN 'variant' THEN 'variant'
    WHEN 'utm_source' THEN 'utm_source'
    WHEN 'utm_medium' THEN 'utm_medium'
    WHEN 'utm_campaign' THEN 'utm_campaign'
    WHEN 'referer_host' THEN 'referer_host'
    ELSE NULL
  END;
  IF v_col IS NULL THEN
    RAISE EXCEPTION 'invalid dimension: %', p_dim;
  END IF;

  RETURN QUERY EXECUTE format($q$
    SELECT COALESCE(NULLIF(c.%I, ''), 'unknown')::text AS key,
           COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE NOT c.is_bot)::bigint AS humans,
           COUNT(*) FILTER (WHERE c.is_bot)::bigint AS bots
    FROM public.clicks c
    WHERE c.created_at >= $1
      AND c.link_id = $2
    GROUP BY 1
    ORDER BY total DESC
  $q$, v_col)
  USING p_since, p_link_id;
END;
$$;


-- ==================== MIGRATION: 20260520193508_b192ba56-67af-41fa-b38c-36cb9f722855.sql ====================
INSERT INTO storage.buckets (id, name, public) VALUES ('migration-temp', 'migration-temp', true) ON CONFLICT (id) DO NOTHING;

-- ==================== MIGRATION: 20260520202306_4e112ec5-381c-4da8-8200-e029578ffc4b.sql ====================
CREATE OR REPLACE FUNCTION public.increment_link_clicks(p_link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.links SET clicks_count = clicks_count + 1 WHERE id = p_link_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_link_bot_clicks(p_link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.links SET bot_clicks_count = bot_clicks_count + 1 WHERE id = p_link_id;
$$;

REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_link_bot_clicks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_link_bot_clicks(uuid) TO service_role;

-- ==================== MIGRATION: 20260520204858_c7058e21-341c-43ed-bf03-cdb238a045aa.sql ====================
-- Phase 2: Branded Prelander System

-- 1. Per-link branding (logo + colors + name + tagline)
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS brand_tagline text,
  ADD COLUMN IF NOT EXISTS brand_color text;

-- 2. Country / device targeting on prelander variants
ALTER TABLE public.prelander_variants
  ADD COLUMN IF NOT EXISTS country_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS device text NOT NULL DEFAULT 'any';

-- 'any' | 'mobile' | 'desktop' | 'tablet'
ALTER TABLE public.prelander_variants
  DROP CONSTRAINT IF EXISTS prelander_variants_device_check;
ALTER TABLE public.prelander_variants
  ADD CONSTRAINT prelander_variants_device_check
  CHECK (device IN ('any','mobile','desktop','tablet'));

CREATE INDEX IF NOT EXISTS idx_prelander_variants_country
  ON public.prelander_variants USING GIN (country_codes);
CREATE INDEX IF NOT EXISTS idx_prelander_variants_device
  ON public.prelander_variants (device) WHERE is_active = true;

-- 3. Public storage bucket for per-link logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('link-logos', 'link-logos', true, 2097152,
        ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'];

-- RLS for link-logos: public read, owner write under {user_id}/...
DROP POLICY IF EXISTS "Public read link logos" ON storage.objects;
CREATE POLICY "Public read link logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'link-logos');

DROP POLICY IF EXISTS "Users upload own link logos" ON storage.objects;
CREATE POLICY "Users upload own link logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'link-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own link logos" ON storage.objects;
CREATE POLICY "Users update own link logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'link-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own link logos" ON storage.objects;
CREATE POLICY "Users delete own link logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'link-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ==================== MIGRATION: 20260520233901_0cdb7e93-014b-4772-a74d-cb60a004b0fd.sql ====================
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS bot_score integer,
  ADD COLUMN IF NOT EXISTS fingerprint_hash text,
  ADD COLUMN IF NOT EXISTS signals jsonb,
  ADD COLUMN IF NOT EXISTS challenge_passed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS clicks_fp_hash_recent_idx
  ON public.clicks (fingerprint_hash, created_at DESC)
  WHERE fingerprint_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS clicks_bot_score_idx
  ON public.clicks (bot_score)
  WHERE bot_score IS NOT NULL;

-- ==================== MIGRATION: 20260520235440_83fba706-9755-4084-bdbe-d90bfa6c99b0.sql ====================
ALTER TABLE public.bot_protection_config
  ADD COLUMN IF NOT EXISTS signal_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS soft_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS inapp_browser_relief boolean NOT NULL DEFAULT true;

-- ==================== MIGRATION: 20260521091905_b640d628-94e1-4540-b2f9-68205fb63f1f.sql ====================

ALTER TABLE public.packages
  ALTER COLUMN link_limit DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS click_limit BIGINT,
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_onetime NUMERIC NOT NULL DEFAULT 0;

UPDATE public.profiles
SET plan_slug = 'free'
WHERE plan_slug IN ('starter', 'pro', 'agency');

DELETE FROM public.packages
WHERE slug IN ('free', 'starter', 'pro', 'agency');

INSERT INTO public.packages
  (slug, name, price_monthly, price_onetime, billing_period, link_limit, click_limit, features, is_active, sort_order)
VALUES
  ('free', 'Free', 0, 0, 'free', 1, 10000,
   '["1 short link","10,000 clicks / month","Bot & fraud detection","Geo / device / time targeting","Custom prelander variants","Basic analytics"]'::jsonb,
   true, 0),
  ('pro_monthly', 'Pro Monthly', 5, 0, 'monthly', 50, 10000000,
   '["50 short links","10,000,000 clicks / month","Bot & fraud detection","Geo / device / time targeting","Unlimited prelander variants","Advanced analytics","Custom domains","Priority support"]'::jsonb,
   true, 1),
  ('lifetime', 'Lifetime', 0, 50, 'lifetime', NULL, NULL,
   '["Unlimited short links","Unlimited clicks","Bot & fraud detection","All targeting features","Unlimited prelander variants","Advanced analytics","Custom domains","API access","Priority support","One-time payment â€” lifetime access"]'::jsonb,
   true, 2);

UPDATE public.profiles p
SET link_quota = COALESCE(pk.link_limit, 999999)
FROM public.packages pk
WHERE pk.slug = p.plan_slug;


-- ==================== MIGRATION: 20260521110912_8ab8890c-71f2-47f2-ab8d-2c75d7edf07e.sql ====================

ALTER TABLE public.upgrade_requests
  ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS plisio_status TEXT;

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_plisio_invoice
  ON public.upgrade_requests (plisio_invoice_id);


-- ==================== MIGRATION: 20260521114746_57b789f6-aee1-49a2-a635-930e463a72de.sql ====================
CREATE TABLE public.plisio_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upgrade_request_id uuid,
  txn_id text,
  order_number text,
  status text,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plisio_webhook_logs_request ON public.plisio_webhook_logs(upgrade_request_id);
CREATE INDEX idx_plisio_webhook_logs_txn ON public.plisio_webhook_logs(txn_id);
CREATE INDEX idx_plisio_webhook_logs_created ON public.plisio_webhook_logs(created_at DESC);

ALTER TABLE public.plisio_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view plisio webhook logs"
ON public.plisio_webhook_logs FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ==================== MIGRATION: 20260521121343_02b53f98-b4e6-489b-bb38-9981b79a99d9.sql ====================
UPDATE public.packages
SET click_limit = 1000000,
    features = (
      SELECT jsonb_agg(
        CASE
          WHEN value #>> '{}' = '10,000,000 clicks / month' THEN to_jsonb('1,000,000 clicks / month'::text)
          ELSE value
        END
      )
      FROM jsonb_array_elements(features) AS value
    )
WHERE slug = 'pro_monthly';

-- ==================== MIGRATION: 20260521124729_bf72c021-fc17-4da6-86f3-02f1a0652f43.sql ====================
CREATE TABLE IF NOT EXISTS public.plisio_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  request_id text NOT NULL,
  correlation_id text,
  status_code integer,
  outcome text NOT NULL DEFAULT 'info',
  upgrade_request_id uuid,
  user_id uuid,
  txn_id text,
  order_number text,
  plisio_status text,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pal_created_at ON public.plisio_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_correlation ON public.plisio_activity_log (correlation_id);
CREATE INDEX IF NOT EXISTS idx_pal_request ON public.plisio_activity_log (request_id);
CREATE INDEX IF NOT EXISTS idx_pal_event_type ON public.plisio_activity_log (event_type);
CREATE INDEX IF NOT EXISTS idx_pal_outcome ON public.plisio_activity_log (outcome);

ALTER TABLE public.plisio_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view plisio activity log"
ON public.plisio_activity_log
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ==================== MIGRATION: 20260521125224_805eaa05-8ce0-4fe1-a958-78f2c3dcd36b.sql ====================
CREATE TABLE public.plisio_webhook_retry_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  txn_id TEXT,
  order_number TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 6,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  source TEXT NOT NULL DEFAULT 'webhook',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plisio_retry_due
  ON public.plisio_webhook_retry_queue (status, next_attempt_at)
  WHERE status = 'queued';

CREATE INDEX idx_plisio_retry_txn ON public.plisio_webhook_retry_queue (txn_id);

ALTER TABLE public.plisio_webhook_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view plisio retry queue"
  ON public.plisio_webhook_retry_queue
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER plisio_retry_queue_updated_at
  BEFORE UPDATE ON public.plisio_webhook_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ==================== MIGRATION: 20260521204328_1fbf9b7c-3261-46d7-a7e6-59aa27531d39.sql ====================
ALTER TABLE public.upgrade_requests
  ADD COLUMN IF NOT EXISTS plisio_invoice_id text,
  ADD COLUMN IF NOT EXISTS plisio_invoice_url text,
  ADD COLUMN IF NOT EXISTS plisio_status text;

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_plisio_invoice
  ON public.upgrade_requests (plisio_invoice_id);

ALTER TABLE public.packages
  ALTER COLUMN link_limit DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS click_limit bigint,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_onetime numeric NOT NULL DEFAULT 0;

UPDATE public.profiles
SET plan_slug = 'free'
WHERE plan_slug IN ('starter', 'pro', 'agency');

DELETE FROM public.packages
WHERE slug IN ('starter', 'pro', 'agency');

INSERT INTO public.packages
  (slug, name, price_monthly, price_onetime, billing_period, link_limit, click_limit, features, is_active, sort_order)
VALUES
  (
    'free',
    'Free',
    0,
    0,
    'free',
    1,
    10000,
    '["1 short link","10,000 clicks / month","Smart bot & fraud detection","In-app browser relief (FB/IG/TikTok)","Geo / device / OS / time targeting","Custom prelander variants (rotating articles)","Duplicate click protection","Basic analytics (clicks, geo, device)","Shared safe domains","Community support"]'::jsonb,
    true,
    0
  ),
  (
    'pro_monthly',
    'Pro Monthly',
    5,
    0,
    'monthly',
    50,
    1000000,
    '["50 short links","1,000,000 clicks / month","Smart bot & fraud detection (advanced)","In-app browser relief + soft challenges","Geo / device / OS / time / referer targeting","Unlimited prelander variants","Auto-rotating A/B variants with autopilot","Custom domains (unlimited)","Domain health monitoring","Duplicate click protection (custom window)","Multi-destination weighted rotation","Custom branding (logo, color, tagline)","Advanced analytics (UTM, referer, breakdown)","Per-link variant overrides","ASN / IP blocklist","Referer rules engine","Priority support"]'::jsonb,
    true,
    1
  ),
  (
    'lifetime',
    'Lifetime',
    0,
    50,
    'lifetime',
    NULL,
    NULL,
    '["Unlimited short links","Unlimited clicks â€” forever","Everything in Pro Monthly","All current & future features","Unlimited custom domains","Unlimited prelander variants","Full targeting suite (geo/device/OS/time/referer)","Auto-tuning variant autopilot","Multi-destination rotation","Custom branding per link","Advanced analytics + exports","ASN / IP / referer blocklists","API access","Priority support â€” lifetime","One-time payment â€” no renewals ever"]'::jsonb,
    true,
    2
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_onetime = EXCLUDED.price_onetime,
  billing_period = EXCLUDED.billing_period,
  link_limit = EXCLUDED.link_limit,
  click_limit = EXCLUDED.click_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

UPDATE public.profiles p
SET link_quota = COALESCE(pk.link_limit, 999999)
FROM public.packages pk
WHERE pk.slug = p.plan_slug;

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260521205712_3e1fdd00-82a6-47be-b7f5-8867bf738dea.sql ====================
REVOKE ALL ON TABLE
  public.admin_audit_logs,
  public.payment_settings,
  public.plisio_webhook_logs,
  public.plisio_activity_log,
  public.plisio_webhook_retry_queue,
  public.bot_protection_config,
  public.fb_asn_blocklist,
  public.referer_rules,
  public.shared_domains,
  public.domain_health_checks,
  public.duplicate_clicks
FROM anon;

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260521210333_7cdcdfcc-7479-4744-9ea7-f623633b58fa.sql ====================
ALTER TABLE public.packages
  ALTER COLUMN link_limit DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS click_limit bigint,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_onetime numeric NOT NULL DEFAULT 0;

UPDATE public.packages
SET is_active = false
WHERE slug IN ('starter', 'pro', 'agency');

INSERT INTO public.packages
  (slug, name, price_monthly, price_onetime, billing_period, link_limit, click_limit, features, is_active, sort_order)
VALUES
  (
    'free',
    'Free',
    0,
    0,
    'free',
    1,
    10000,
    '["1 short link","10,000 clicks / month","Smart bot & fraud detection","In-app browser relief (FB/IG/TikTok)","Geo / device / OS / time targeting","Custom prelander variants (rotating articles)","Duplicate click protection","Basic analytics (clicks, geo, device)","Shared safe domains","Community support"]'::jsonb,
    true,
    0
  ),
  (
    'pro_monthly',
    'Pro Monthly',
    5,
    0,
    'monthly',
    50,
    1000000,
    '["50 short links","1,000,000 clicks / month","Smart bot & fraud detection (advanced)","In-app browser relief + soft challenges","Geo / device / OS / time / referer targeting","Unlimited prelander variants","Auto-rotating A/B variants with autopilot","Custom domains (unlimited)","Domain health monitoring","Duplicate click protection (custom window)","Multi-destination weighted rotation","Custom branding (logo, color, tagline)","Advanced analytics (UTM, referer, breakdown)","Per-link variant overrides","ASN / IP blocklist","Referer rules engine","Priority support"]'::jsonb,
    true,
    1
  ),
  (
    'lifetime',
    'Lifetime',
    0,
    50,
    'lifetime',
    NULL,
    NULL,
    '["Unlimited short links","Unlimited clicks â€” forever","Everything in Pro Monthly","All current & future features","Unlimited custom domains","Unlimited prelander variants","Full targeting suite (geo/device/OS/time/referer)","Auto-tuning variant autopilot","Multi-destination rotation","Custom branding per link","Advanced analytics + exports","ASN / IP / referer blocklists","API access","Priority support â€” lifetime","One-time payment â€” no renewals ever"]'::jsonb,
    true,
    2
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_onetime = EXCLUDED.price_onetime,
  billing_period = EXCLUDED.billing_period,
  link_limit = EXCLUDED.link_limit,
  click_limit = EXCLUDED.click_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

UPDATE public.profiles
SET plan_slug = 'pro_monthly'
WHERE plan_slug IN ('starter', 'pro', 'agency');

UPDATE public.profiles p
SET link_quota = COALESCE(pk.link_limit, 999999)
FROM public.packages pk
WHERE pk.slug = p.plan_slug;

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260521212802_385aa365-c3b3-4e4d-b23d-87c3ad991e8c.sql ====================

-- Ad rotation + login ad config (single row)
CREATE TABLE IF NOT EXISTS public.ad_rotation_config (
  id integer PRIMARY KEY DEFAULT 1,
  login_ad_enabled boolean NOT NULL DEFAULT false,
  login_ad_url text,
  login_ads_per_day integer NOT NULL DEFAULT 2,
  rotation_enabled boolean NOT NULL DEFAULT false,
  rotation_admin_url text,
  rotation_user_clicks integer NOT NULL DEFAULT 1000,
  rotation_admin_clicks integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_rotation_config_singleton CHECK (id = 1)
);

INSERT INTO public.ad_rotation_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ad_rotation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ad config" ON public.ad_rotation_config
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update ad config" ON public.ad_rotation_config
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Daily login-ad tracker on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_ad_date date,
  ADD COLUMN IF NOT EXISTS ads_shown_today integer NOT NULL DEFAULT 0;


-- ==================== MIGRATION: 20260521214316_44dd2a98-e539-496f-95d5-58b4c8794481.sql ====================
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
UPDATE public.packages SET is_featured = true WHERE slug = 'lifetime';

-- ==================== MIGRATION: 20260521215611_c38a8e38-f25e-4f54-8cfb-f09829add363.sql ====================
CREATE TABLE IF NOT EXISTS public.ad_rotation_config (
  id integer PRIMARY KEY DEFAULT 1,
  login_ad_enabled boolean NOT NULL DEFAULT false,
  login_ad_url text,
  login_ads_per_day integer NOT NULL DEFAULT 2,
  rotation_enabled boolean NOT NULL DEFAULT false,
  rotation_admin_url text,
  rotation_user_clicks integer NOT NULL DEFAULT 1000,
  rotation_admin_clicks integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_rotation_config_singleton CHECK (id = 1)
);

INSERT INTO public.ad_rotation_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ad_rotation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read ad config" ON public.ad_rotation_config;
DROP POLICY IF EXISTS "Admins update ad config" ON public.ad_rotation_config;

CREATE POLICY "Admins read ad config"
ON public.ad_rotation_config
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update ad config"
ON public.ad_rotation_config
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ==================== MIGRATION: 20260522175141_9597da71-b7f5-4d19-9c7b-b6f387b6b505.sql ====================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS click_quota BIGINT,
  ADD COLUMN IF NOT EXISTS clicks_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS clicks_period_kind TEXT NOT NULL DEFAULT 'monthly';

-- Backfill from current plan
UPDATE public.profiles p
SET click_quota = pk.click_limit,
    clicks_period_kind = COALESCE(NULLIF(pk.billing_period,'free'),'monthly')
FROM public.packages pk
WHERE pk.slug = p.plan_slug AND p.click_quota IS NULL;

-- Extend plan-change sync to also keep click_quota in sync
CREATE OR REPLACE FUNCTION public.sync_quota_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link_limit INT;
  v_click_limit BIGINT;
  v_period TEXT;
BEGIN
  IF NEW.plan_slug IS DISTINCT FROM OLD.plan_slug THEN
    SELECT link_limit, click_limit, billing_period
      INTO v_link_limit, v_click_limit, v_period
      FROM public.packages
      WHERE slug = NEW.plan_slug AND is_active = true;
    IF v_link_limit IS NOT NULL THEN
      NEW.link_quota := v_link_limit;
    END IF;
    NEW.click_quota := v_click_limit; -- NULL = unlimited
    NEW.clicks_used := 0;
    NEW.clicks_period_start := now();
    NEW.clicks_period_kind := COALESCE(NULLIF(v_period,'free'),'monthly');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quota_on_plan_change ON public.profiles;
CREATE TRIGGER trg_sync_quota_on_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_quota_on_plan_change();

-- Status reader (used by dashboard)
CREATE OR REPLACE FUNCTION public.get_user_click_status(p_user_id uuid)
RETURNS TABLE(click_quota BIGINT, clicks_used BIGINT, exceeded BOOLEAN, period_kind TEXT, period_start TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id;

  -- Auto-reset monthly window if 30+ days old
  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    u := 0;
  END IF;

  RETURN QUERY SELECT q, u, (q IS NOT NULL AND u >= q), k, s;
END;
$$;

-- Atomic increment + over-quota check (used by redirect handler)
CREATE OR REPLACE FUNCTION public.check_and_increment_user_clicks(p_user_id uuid)
RETURNS TABLE(exceeded BOOLEAN, clicks_used BIGINT, click_quota BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, NULL::BIGINT;
    RETURN;
  END IF;

  -- Monthly auto-reset
  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    UPDATE public.profiles
       SET clicks_used = 0, clicks_period_start = now()
     WHERE id = p_user_id;
    u := 0;
  END IF;

  -- Unlimited plan (NULL quota) â†’ always allow, still track usage
  IF q IS NULL THEN
    UPDATE public.profiles SET clicks_used = clicks_used + 1 WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, u + 1, NULL::BIGINT;
    RETURN;
  END IF;

  -- Over quota: do NOT increment further (saves writes), just report
  IF u >= q THEN
    RETURN QUERY SELECT TRUE, u, q;
    RETURN;
  END IF;

  UPDATE public.profiles SET clicks_used = clicks_used + 1 WHERE id = p_user_id;
  RETURN QUERY SELECT FALSE, u + 1, q;
END;
$$;


-- ==================== MIGRATION: 20260522220918_7a550ca2-4603-4cc5-8117-8b115f78a43a.sql ====================
INSERT INTO public.payment_settings (id, plisio_enabled, plisio_api_key, payment_instructions)
VALUES (1, true, 'SkkZKl5C_QLes32hefTT3xokoeSrgf1CWc2SUn5C8u4GioW88bgPvxoLxXZV1ORb', 'Pay with crypto (BTC, LTC, USDT) via Plisio. Click Upgrade to start checkout.')
ON CONFLICT (id) DO UPDATE
SET plisio_enabled = true,
    plisio_api_key = EXCLUDED.plisio_api_key,
    payment_instructions = EXCLUDED.payment_instructions,
    updated_at = now();

-- ==================== MIGRATION: 20260522223408_9e8434c6-2036-4e80-a996-d3dca9bae243.sql ====================
-- Speed up analytics breakdowns (clicks_breakdown, clicks_daily)
CREATE INDEX IF NOT EXISTS idx_clicks_link_id_created_at 
  ON public.clicks (link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_created_at 
  ON public.clicks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_link_id_is_bot 
  ON public.clicks (link_id, is_bot);

-- Speed up redirect lookups (most critical - hit on every /r/:code request)
CREATE INDEX IF NOT EXISTS idx_links_short_code 
  ON public.links (short_code);

CREATE INDEX IF NOT EXISTS idx_links_user_id 
  ON public.links (user_id);

-- Speed up duplicate click protection
CREATE INDEX IF NOT EXISTS idx_duplicate_clicks_link_ip 
  ON public.duplicate_clicks (link_id, ip);

-- Speed up RLS policy checks (link ownership)
CREATE INDEX IF NOT EXISTS idx_link_destinations_link_id 
  ON public.link_destinations (link_id);

CREATE INDEX IF NOT EXISTS idx_link_geo_rules_link_id 
  ON public.link_geo_rules (link_id);

CREATE INDEX IF NOT EXISTS idx_link_device_rules_link_id 
  ON public.link_device_rules (link_id);

-- Analyze tables to update planner stats
ANALYZE public.clicks;
ANALYZE public.links;
ANALYZE public.duplicate_clicks;

-- ==================== MIGRATION: 20260522234718_a11c96fc-23e9-4f43-ab66-2e2a7def730e.sql ====================
ALTER TABLE public.upgrade_requests
  ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS plisio_status TEXT;

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_plisio_invoice
  ON public.upgrade_requests (plisio_invoice_id);

CREATE OR REPLACE FUNCTION public.check_and_increment_user_clicks(p_user_id uuid)
RETURNS TABLE(exceeded BOOLEAN, clicks_used BIGINT, click_quota BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, NULL::BIGINT;
    RETURN;
  END IF;

  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    UPDATE public.profiles p
       SET clicks_used = 0, clicks_period_start = now()
     WHERE p.id = p_user_id;
    u := 0;
  END IF;

  IF q IS NULL THEN
    UPDATE public.profiles p
       SET clicks_used = p.clicks_used + 1
     WHERE p.id = p_user_id
     RETURNING p.clicks_used INTO u;
    RETURN QUERY SELECT FALSE, u, NULL::BIGINT;
    RETURN;
  END IF;

  IF u >= q THEN
    RETURN QUERY SELECT TRUE, u, q;
    RETURN;
  END IF;

  UPDATE public.profiles p
     SET clicks_used = p.clicks_used + 1
   WHERE p.id = p_user_id
   RETURNING p.clicks_used INTO u;

  RETURN QUERY SELECT FALSE, u, q;
END;
$$;

-- ==================== MIGRATION: 20260523000045_2d2be21a-dfd6-4e8d-882d-a1e48cb3d864.sql ====================
-- Drop and recreate with non-clashing OUT column names
DROP FUNCTION IF EXISTS public.check_and_increment_user_clicks(uuid);

CREATE OR REPLACE FUNCTION public.check_and_increment_user_clicks(p_user_id uuid)
 RETURNS TABLE(exceeded boolean, used bigint, quota bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, NULL::BIGINT;
    RETURN;
  END IF;

  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    UPDATE public.profiles p
       SET clicks_used = 0, clicks_period_start = now()
     WHERE p.id = p_user_id;
    u := 0;
  END IF;

  IF q IS NULL THEN
    UPDATE public.profiles p
       SET clicks_used = p.clicks_used + 1
     WHERE p.id = p_user_id
     RETURNING p.clicks_used INTO u;
    RETURN QUERY SELECT FALSE, u, NULL::BIGINT;
    RETURN;
  END IF;

  IF u >= q THEN
    RETURN QUERY SELECT TRUE, u, q;
    RETURN;
  END IF;

  UPDATE public.profiles p
     SET clicks_used = p.clicks_used + 1
   WHERE p.id = p_user_id
   RETURNING p.clicks_used INTO u;

  RETURN QUERY SELECT FALSE, u, q;
END;
$function$;

-- Tell PostgREST to refresh its schema cache (picks up plisio_status column)
NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260523001124_b89343f5-ac79-4cf9-9a9f-01c862d08fe5.sql ====================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ==================== MIGRATION: 20260523080814_cdee6b89-f9fe-42a5-994c-9fd5b1ec3bf5.sql ====================

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
  safe_url text NOT NULL DEFAULT 'https://adspx.com/',
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
  IF NEW.email = 'admin@adspx.com' THEN v_role := 'admin'; END IF;
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


-- ==================== MIGRATION: 20260523081552_b27e06e7-b340-4e53-82d7-037aca352d56.sql ====================

ALTER TABLE public.packages ALTER COLUMN link_limit DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN link_limit DROP NOT NULL;


-- ==================== MIGRATION: 20260523115135_eee191bf-d391-4b98-92c2-e11f3934b6d3.sql ====================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role := 'user';
BEGIN
  IF NEW.email = 'admin@adspx.com' THEN v_role := 'admin'; END IF;
  INSERT INTO public.profiles (id, email, full_name, telegram, plan_slug, click_quota, link_limit)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NULLIF(NEW.raw_user_meta_data->>'telegram',''),
    CASE WHEN v_role='admin' THEN 'unlimited' ELSE 'free' END,
    CASE WHEN v_role='admin' THEN NULL ELSE 1000 END,
    CASE WHEN v_role='admin' THEN 100 ELSE 1 END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== MIGRATION: 20260523205319_71f127b7-3d63-4b72-90de-75bc4ac2e82e.sql ====================

-- 1. app_settings singleton table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  fallback_url TEXT NOT NULL DEFAULT 'https://consciousdunkvastly.com/qdg9kcmh?key=615ddb2bcc3fac3d25f1df64465f1da7',
  our_adsterra_url TEXT NOT NULL DEFAULT 'https://consciousdunkvastly.com/qdg9kcmh?key=615ddb2bcc3fac3d25f1df64465f1da7',
  injection_threshold INTEGER NOT NULL DEFAULT 5000,
  injection_count INTEGER NOT NULL DEFAULT 50,
  daily_redirect_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = true)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "as_read_auth" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "as_admin_all" ON public.app_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER app_settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default row
INSERT INTO public.app_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- 2. profiles.last_daily_redirect_at
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_daily_redirect_at TIMESTAMPTZ;


-- ==================== MIGRATION: 20260523213000_record_redirect_click.sql ====================
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS referer_host text,
  ADD COLUMN IF NOT EXISTS bot_score integer,
  ADD COLUMN IF NOT EXISTS signals jsonb,
  ADD COLUMN IF NOT EXISTS challenge_passed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clicks_link_utm_source
  ON public.clicks (link_id, utm_source);

CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id,
    ip,
    country,
    ua,
    is_bot,
    bot_reason,
    routed_to,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _routed_to,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = _link_id;

    UPDATE public.profiles
    SET clicks_used = COALESCE(clicks_used, 0) + 1
    WHERE id = _user_id;
  END IF;
EXCEPTION WHEN undefined_column THEN
  INSERT INTO public.clicks (
    link_id,
    ip_address,
    country,
    user_agent,
    is_bot,
    bot_reason,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = _link_id;

    UPDATE public.profiles
    SET clicks_used = COALESCE(clicks_used, 0) + 1
    WHERE id = _user_id;
  END IF;
END;
$$;


-- ==================== MIGRATION: 20260524172705_55bf6623-1dd2-473b-bf2f-8f94306e22d6.sql ====================
-- Phase 1: Prelanding + JS Challenge support
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS prelanding_template TEXT NOT NULL DEFAULT 'verify';

-- Constrain to known templates (none = skip prelanding, direct redirect)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'links_prelanding_template_check'
  ) THEN
    ALTER TABLE public.links
      ADD CONSTRAINT links_prelanding_template_check
      CHECK (prelanding_template IN ('none','verify','reward','countdown','article'));
  END IF;
END $$;

ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS prelanding_shown BOOLEAN NOT NULL DEFAULT false;

-- challenge_passed already added in earlier migration on VPS; ensure for Lovable Cloud
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS challenge_passed BOOLEAN NOT NULL DEFAULT false;

-- ==================== MIGRATION: 20260524221117_ba4fc41a-2f2d-400d-8e62-8de92ebe3452.sql ====================

-- ============ Country tiers ============
CREATE TABLE IF NOT EXISTS public.country_tiers (
  country_code TEXT PRIMARY KEY,
  tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  country_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.country_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_read_all ON public.country_tiers FOR SELECT USING (true);
CREATE POLICY ct_admin_all ON public.country_tiers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed tiers
INSERT INTO public.country_tiers (country_code, tier, country_name) VALUES
('US',1,'United States'),('UK',1,'United Kingdom'),('GB',1,'United Kingdom'),
('CA',1,'Canada'),('AU',1,'Australia'),('DE',1,'Germany'),('FR',1,'France'),
('NL',1,'Netherlands'),('SE',1,'Sweden'),('NO',1,'Norway'),('CH',1,'Switzerland'),
('IE',1,'Ireland'),('NZ',1,'New Zealand'),('DK',1,'Denmark'),('FI',1,'Finland'),
('BR',2,'Brazil'),('MX',2,'Mexico'),('IN',2,'India'),('ID',2,'Indonesia'),
('TR',2,'Turkey'),('IT',2,'Italy'),('ES',2,'Spain'),('PL',2,'Poland'),
('AR',2,'Argentina'),('CL',2,'Chile'),('CO',2,'Colombia'),('MY',2,'Malaysia'),
('TH',2,'Thailand'),('PH',2,'Philippines'),('VN',2,'Vietnam'),('ZA',2,'South Africa'),
('SA',2,'Saudi Arabia'),('AE',2,'UAE'),('JP',2,'Japan'),('KR',2,'South Korea')
ON CONFLICT (country_code) DO NOTHING;

-- ============ Geo offers (per-link, per-tier override) ============
CREATE TABLE IF NOT EXISTS public.geo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  tier SMALLINT CHECK (tier BETWEEN 1 AND 3),
  country_codes TEXT[],
  offer_url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100 CHECK (weight > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_geo_offers_link ON public.geo_offers(link_id) WHERE is_active = true;
ALTER TABLE public.geo_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY go_owner_all ON public.geo_offers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY go_admin_all ON public.geo_offers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ A/B variants ============
CREATE TABLE IF NOT EXISTS public.ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  offer_url TEXT NOT NULL,
  weight_pct INTEGER NOT NULL DEFAULT 50 CHECK (weight_pct BETWEEN 1 AND 100),
  clicks_count BIGINT NOT NULL DEFAULT 0,
  conversions_count BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(link_id, variant_label)
);
CREATE INDEX idx_ab_variants_link ON public.ab_variants(link_id) WHERE is_active = true;
ALTER TABLE public.ab_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY ab_owner_all ON public.ab_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));
CREATE POLICY ab_admin_all ON public.ab_variants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ Referrer rules ============
CREATE TABLE IF NOT EXISTS public.referrer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  label TEXT,
  trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  action TEXT NOT NULL DEFAULT 'allow' CHECK (action IN ('allow','suspect','block')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referrer_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY rr_read_auth ON public.referrer_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY rr_admin_all ON public.referrer_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.referrer_rules (pattern, label, trust_score, action) VALUES
('facebook.com','Facebook',95,'allow'),
('fb.com','Facebook',95,'allow'),
('instagram.com','Instagram',95,'allow'),
('t.co','Twitter',90,'allow'),
('twitter.com','Twitter',90,'allow'),
('x.com','X/Twitter',90,'allow'),
('telegram.org','Telegram',95,'allow'),
('t.me','Telegram',95,'allow'),
('whatsapp.com','WhatsApp',95,'allow'),
('wa.me','WhatsApp',95,'allow'),
('tiktok.com','TikTok',90,'allow'),
('youtube.com','YouTube',90,'allow'),
('reddit.com','Reddit',85,'allow'),
('google.com','Google',80,'allow'),
('googlebot.com','Googlebot',0,'block'),
('ahrefs.com','Ahrefs',0,'block'),
('semrush.com','Semrush',0,'block')
ON CONFLICT DO NOTHING;

-- ============ Cloaking rules ============
CREATE TABLE IF NOT EXISTS public.cloaking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('ua','ip','asn','country')),
  pattern TEXT NOT NULL,
  label TEXT,
  action TEXT NOT NULL DEFAULT 'safe' CHECK (action IN ('safe','block','offer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloaking_active ON public.cloaking_rules(rule_type, is_active) WHERE is_active = true;
ALTER TABLE public.cloaking_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_read_auth ON public.cloaking_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY cr_admin_all ON public.cloaking_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.cloaking_rules (rule_type, pattern, label, action) VALUES
('ua','facebookexternalhit','Facebook Crawler','safe'),
('ua','facebot','Facebook Bot','safe'),
('ua','meta-externalagent','Meta Agent','safe'),
('ua','meta-externalfetcher','Meta Fetcher','safe'),
('ua','googlebot','Google Bot','safe'),
('ua','adsbot-google','Google AdsBot','safe'),
('ua','bingbot','Bing Bot','safe'),
('ua','yandexbot','Yandex Bot','safe'),
('ua','duckduckbot','DuckDuckGo','safe'),
('asn','32934','Facebook AS','safe'),
('asn','15169','Google AS','safe'),
('asn','8075','Microsoft AS','safe'),
('asn','13335','Cloudflare AS','safe'),
('asn','14618','Amazon AS','safe'),
('asn','16509','Amazon AWS','safe')
ON CONFLICT DO NOTHING;

-- ============ Bot fingerprints (auto-learn) ============
CREATE TABLE IF NOT EXISTS public.bot_fingerprints (
  fingerprint_hash TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 1,
  bot_hits INTEGER NOT NULL DEFAULT 0,
  auto_blocked BOOLEAN NOT NULL DEFAULT false,
  sample_ip TEXT,
  sample_ua TEXT,
  sample_country TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bf_blocked ON public.bot_fingerprints(auto_blocked) WHERE auto_blocked = true;
ALTER TABLE public.bot_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY bf_admin_all ON public.bot_fingerprints FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ Extend clicks table ============
ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT,
  ADD COLUMN IF NOT EXISTS referrer_source TEXT,
  ADD COLUMN IF NOT EXISTS country_tier SMALLINT,
  ADD COLUMN IF NOT EXISTS ab_variant TEXT,
  ADD COLUMN IF NOT EXISTS ja3_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_clicks_fingerprint ON public.clicks(fingerprint_hash) WHERE fingerprint_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_link_created ON public.clicks(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_referrer ON public.clicks(referrer_source) WHERE referrer_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_country_created ON public.clicks(country, created_at DESC) WHERE country IS NOT NULL;

-- ============ Helper function: record bot fingerprint hit ============
CREATE OR REPLACE FUNCTION public.record_bot_fingerprint(
  _hash TEXT, _is_bot BOOLEAN, _ip TEXT, _ua TEXT, _country TEXT, _block_threshold INTEGER DEFAULT 3
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked BOOLEAN;
BEGIN
  INSERT INTO public.bot_fingerprints (fingerprint_hash, hit_count, bot_hits, sample_ip, sample_ua, sample_country, last_seen)
  VALUES (_hash, 1, CASE WHEN _is_bot THEN 1 ELSE 0 END, _ip, _ua, _country, now())
  ON CONFLICT (fingerprint_hash) DO UPDATE
    SET hit_count = bot_fingerprints.hit_count + 1,
        bot_hits  = bot_fingerprints.bot_hits + CASE WHEN _is_bot THEN 1 ELSE 0 END,
        last_seen = now(),
        auto_blocked = CASE
          WHEN bot_fingerprints.auto_blocked THEN true
          WHEN bot_fingerprints.bot_hits + CASE WHEN _is_bot THEN 1 ELSE 0 END >= _block_threshold THEN true
          ELSE false
        END
  RETURNING auto_blocked INTO v_blocked;
  RETURN v_blocked;
END $$;

-- ============ Cohort analytics view ============
CREATE OR REPLACE VIEW public.cohort_stats AS
SELECT
  COALESCE(referrer_source, 'direct') AS source,
  COUNT(*) AS total_clicks,
  SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) AS bot_clicks,
  SUM(CASE WHEN NOT is_bot THEN 1 ELSE 0 END) AS human_clicks,
  ROUND(100.0 * SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS bot_pct,
  COUNT(DISTINCT country) AS countries,
  COUNT(DISTINCT fingerprint_hash) AS unique_fps,
  MIN(created_at) AS first_click,
  MAX(created_at) AS last_click
FROM public.clicks
WHERE created_at > now() - interval '7 days'
GROUP BY COALESCE(referrer_source, 'direct');

-- ============ Country stats view (for live dashboard map) ============
CREATE OR REPLACE VIEW public.country_stats_24h AS
SELECT
  country,
  COUNT(*) AS clicks,
  SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) AS bots,
  SUM(CASE WHEN NOT is_bot THEN 1 ELSE 0 END) AS humans
FROM public.clicks
WHERE created_at > now() - interval '24 hours' AND country IS NOT NULL AND country <> ''
GROUP BY country;


-- ==================== MIGRATION: 20260524221144_8cab3876-eb68-42a5-aea3-e7efd13e3dcd.sql ====================

ALTER VIEW public.cohort_stats SET (security_invoker = on);
ALTER VIEW public.country_stats_24h SET (security_invoker = on);

-- Restrict access to these views to admins only (they aggregate across all users)
REVOKE ALL ON public.cohort_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.country_stats_24h FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cohort_stats TO authenticated;
GRANT SELECT ON public.country_stats_24h TO authenticated;


-- ==================== MIGRATION: 20260524221210_457b2247-fa5d-4d59-9b2d-ff2cc159ba42.sql ====================

REVOKE EXECUTE ON FUNCTION public.record_bot_fingerprint(TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bot_fingerprint(TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER) TO service_role;


-- ==================== MIGRATION: 20260524223733_7d980d53-eb59-47c4-b6a3-8c84019062d5.sql ====================

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


-- ==================== MIGRATION: 20260524224846_b2e7e41d-1e25-47ea-b14a-7fe5f8e66360.sql ====================
-- Sync package pricing/quotas to final published values.
-- Idempotent UPSERT â€” safe to re-run on any environment (Lovable Cloud or VPS).
INSERT INTO public.packages (slug, name, price_usd, click_quota, link_limit, is_active, sort_order)
VALUES
  ('free',     'Free',               0,  10000,    1,    true, 1),
  ('monthly',  'Monthly Pro',        5,  1000000,  50,   true, 2),
  ('lifetime', 'Lifetime Unlimited', 50, NULL,     NULL, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  price_usd   = EXCLUDED.price_usd,
  click_quota = EXCLUDED.click_quota,
  link_limit  = EXCLUDED.link_limit,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

-- ==================== MIGRATION: 20260524225510_d400f1d3-57e9-4814-9b9a-e097f47064a1.sql ====================

-- Fast click recorder RPC (replaces slow fallback path)
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text,
  _country text,
  _ua text,
  _is_bot boolean,
  _bot_reason text,
  _routed_to text,
  _utm_source text,
  _utm_medium text,
  _utm_campaign text,
  _utm_term text,
  _utm_content text,
  _referer_host text,
  _bot_score integer,
  _signals jsonb,
  _challenge_passed boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (link_id, ip, country, ua, is_bot, bot_reason, routed_to, challenge_passed)
  VALUES (_link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to, COALESCE(_challenge_passed, false));

  IF _is_bot THEN
    UPDATE public.links
       SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
     WHERE id = _link_id;
  ELSE
    UPDATE public.links
       SET clicks_count = COALESCE(clicks_count, 0) + 1
     WHERE id = _link_id;
    UPDATE public.profiles
       SET clicks_used = COALESCE(clicks_used, 0) + 1
     WHERE id = _user_id;
  END IF;
END $$;

-- Speed up the daily-1-ad-per-visitor lookup
CREATE INDEX IF NOT EXISTS idx_clicks_fp_routed_created
  ON public.clicks (fingerprint_hash, routed_to, created_at DESC);

-- Speed up generic per-link recent-click scans
CREATE INDEX IF NOT EXISTS idx_clicks_link_created
  ON public.clicks (link_id, created_at DESC);


-- ==================== MIGRATION: 20260524225539_0ba8d482-aa28-439b-a5e9-2a6183e93663.sql ====================

REVOKE ALL ON FUNCTION public.record_redirect_click(uuid, uuid, text, text, text, boolean, text, text, text, text, text, text, text, text, integer, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_redirect_click(uuid, uuid, text, text, text, boolean, text, text, text, text, text, text, text, text, integer, jsonb, boolean) TO service_role;


-- ==================== MIGRATION: 20260524225847_c52404a4-56db-4c61-becd-216cc45a0fb3.sql ====================
-- Backfill admin role for admin@adspx.com (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email = 'admin@adspx.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Upgrade their profile to unlimited
UPDATE public.profiles
   SET plan_slug = 'unlimited',
       click_quota = NULL,
       link_limit = 100
 WHERE email = 'admin@adspx.com';

-- ==================== MIGRATION: 20260524231729_468eefcd-53d1-4c7d-9ace-882cd77abaeb.sql ====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role := 'user';
BEGIN
  IF NEW.email = 'admin@adspx.com' THEN v_role := 'admin'; END IF;
  INSERT INTO public.profiles (id, email, full_name, telegram, plan_slug, click_quota, link_limit)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NULLIF(NEW.raw_user_meta_data->>'telegram',''),
    CASE WHEN v_role='admin' THEN 'unlimited' ELSE 'free' END,
    CASE WHEN v_role='admin' THEN NULL ELSE 10000 END,
    CASE WHEN v_role='admin' THEN 100 ELSE 1 END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

UPDATE public.profiles
SET click_quota = 10000
WHERE plan_slug = 'free' AND click_quota = 1000;

UPDATE public.packages SET price_usd = 0,  click_quota = 10000,   link_limit = 1    WHERE slug = 'free';
UPDATE public.packages SET price_usd = 5,  click_quota = 1000000, link_limit = 50   WHERE slug = 'monthly';
UPDATE public.packages SET price_usd = 50, click_quota = NULL,    link_limit = NULL WHERE slug = 'lifetime';

-- ==================== MIGRATION: 20260524232044_62e445ee-bb00-4657-a252-d9296023c609.sql ====================
DROP POLICY IF EXISTS ur_admin ON public.user_roles;

-- ==================== MIGRATION: 20260525000205_fix_link_limits_package_sync.sql ====================
-- Fix link creation for every plan by using the current package columns.
-- Free: 1 link / 10,000 clicks, Monthly: 50 links / 1,000,000 clicks, Lifetime/Admin: unlimited.

ALTER TABLE public.profiles ALTER COLUMN link_limit DROP NOT NULL;
ALTER TABLE public.packages ALTER COLUMN link_limit DROP NOT NULL;

INSERT INTO public.packages (slug, name, price_usd, click_quota, link_limit, is_active, sort_order)
VALUES
  ('free', 'Free', 0, 10000, 1, true, 1),
  ('monthly', 'Monthly Pro', 5, 1000000, 50, true, 2),
  ('lifetime', 'Lifetime', 50, NULL, NULL, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_usd = EXCLUDED.price_usd,
  click_quota = EXCLUDED.click_quota,
  link_limit = EXCLUDED.link_limit,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

UPDATE public.profiles
SET plan_slug = 'monthly'
WHERE plan_slug IN ('pro_monthly', 'starter', 'pro');

UPDATE public.profiles
SET plan_slug = 'lifetime'
WHERE plan_slug = 'unlimited';

UPDATE public.packages
SET click_quota = 1000000,
    link_limit = 50,
    is_active = false
WHERE slug IN ('pro_monthly', 'starter', 'pro');

UPDATE public.packages
SET click_quota = NULL,
    link_limit = NULL,
    is_active = false
WHERE slug = 'unlimited';

UPDATE public.profiles p
SET click_quota = pk.click_quota,
    link_limit = pk.link_limit
FROM public.packages pk
WHERE pk.slug = p.plan_slug;

UPDATE public.profiles
SET click_quota = NULL,
    link_limit = NULL
WHERE public.has_role(id, 'admin');

CREATE OR REPLACE FUNCTION public.enforce_link_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_used int;
  v_limit int;
  v_is_admin boolean;
  v_free_click_quota bigint;
  v_free_link_limit int;
BEGIN
  SELECT public.has_role(NEW.user_id, 'admin') INTO v_is_admin;

  SELECT links_used, link_limit
    INTO v_used, v_limit
    FROM public.profiles
    WHERE id = NEW.user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    SELECT click_quota, link_limit
      INTO v_free_click_quota, v_free_link_limit
      FROM public.packages
      WHERE slug = 'free';

    INSERT INTO public.profiles (id, plan_slug, click_quota, link_limit, links_used)
    VALUES (NEW.user_id, 'free', COALESCE(v_free_click_quota, 10000), COALESCE(v_free_link_limit, 1), 0);

    v_used := 0;
    v_limit := COALESCE(v_free_link_limit, 1);
  END IF;

  IF COALESCE(v_is_admin, false) THEN
    UPDATE public.profiles SET links_used = links_used + 1 WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;

  IF v_limit IS NOT NULL AND v_used >= v_limit THEN
    RAISE EXCEPTION 'Link limit reached (%/%). Please upgrade your plan.', v_used, v_limit;
  END IF;

  UPDATE public.profiles SET links_used = links_used + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_link_quota ON public.links;
CREATE TRIGGER trg_enforce_link_quota
BEFORE INSERT ON public.links
FOR EACH ROW EXECUTE FUNCTION public.enforce_link_quota();

CREATE OR REPLACE FUNCTION public.sync_quota_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link_limit int;
  v_click_quota bigint;
BEGIN
  IF NEW.plan_slug IS DISTINCT FROM OLD.plan_slug THEN
    SELECT link_limit, click_quota
      INTO v_link_limit, v_click_quota
      FROM public.packages
      WHERE slug = NEW.plan_slug AND is_active = true;

    NEW.link_limit := v_link_limit;
    NEW.click_quota := v_click_quota;
    NEW.links_used := 0;
    NEW.clicks_used := 0;
    NEW.clicks_period_start := now();
  END IF;

  IF public.has_role(NEW.id, 'admin') THEN
    NEW.link_limit := NULL;
    NEW.click_quota := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quota_on_plan_change ON public.profiles;
CREATE TRIGGER trg_sync_quota_on_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_quota_on_plan_change();


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role := 'user';
  v_telegram text;
BEGIN
  IF NEW.email = 'admin@adspx.com' THEN
    v_role := 'admin';
  END IF;

  v_telegram := NULLIF(NEW.raw_user_meta_data->>'telegram','');

  INSERT INTO public.profiles (id, email, full_name, telegram, plan_slug, click_quota, link_limit)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    v_telegram,
    CASE WHEN v_role = 'admin' THEN 'lifetime' ELSE 'free' END,
    CASE WHEN v_role = 'admin' THEN NULL ELSE 10000 END,
    CASE WHEN v_role = 'admin' THEN NULL ELSE 1 END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==================== MIGRATION: 20260525084000_owner_safe_signup_auth_repair_selfhost.sql ====================
-- Owner-safe Adspx self-host auth repair.
-- IMPORTANT: Run this as the actual table owner if plain `postgres` says "must be owner".
-- First check owners:
--   SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relname IN ('profiles','packages','user_roles','users');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='telegram') THEN
    EXECUTE 'ALTER TABLE public.profiles ADD COLUMN telegram text';
  END IF;
END $$;

ALTER TABLE public.profiles ALTER COLUMN link_limit DROP NOT NULL;
ALTER TABLE public.packages ALTER COLUMN link_limit DROP NOT NULL;

INSERT INTO public.packages (slug, name, price_usd, click_quota, link_limit, is_active, sort_order)
VALUES
  ('free', 'Free', 0, 10000, 1, true, 1),
  ('monthly', 'Monthly Pro', 5, 1000000, 50, true, 2),
  ('lifetime', 'Lifetime', 50, NULL, NULL, true, 3),
  ('unlimited', 'Lifetime', 50, NULL, NULL, true, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_usd = EXCLUDED.price_usd,
  click_quota = EXCLUDED.click_quota,
  link_limit = EXCLUDED.link_limit,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

UPDATE public.profiles SET plan_slug='lifetime' WHERE plan_slug IN ('unlimited','pro','starter','pro_monthly');
DELETE FROM public.user_roles WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.user_roles a USING public.user_roles b WHERE a.id < b.id AND a.user_id=b.user_id AND a.role=b.role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_roles_user_id_role_key' AND conrelid='public.user_roles'::regclass) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(COALESCE(NEW.email, ''));
  v_role public.app_role := CASE WHEN lower(COALESCE(NEW.email, ''))='admin@adspx.com' THEN 'admin'::public.app_role ELSE 'user'::public.app_role END;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, telegram, plan_slug, click_quota, link_limit)
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(v_email,'@',1)),
    NULLIF(NEW.raw_user_meta_data->>'telegram',''),
    CASE WHEN v_role='admin' THEN 'lifetime' ELSE 'free' END,
    CASE WHEN v_role='admin' THEN NULL ELSE 10000 END,
    CASE WHEN v_role='admin' THEN NULL ELSE 1 END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name,''), EXCLUDED.full_name),
    telegram = COALESCE(NULLIF(public.profiles.telegram,''), EXCLUDED.telegram),
    plan_slug = COALESCE(public.profiles.plan_slug, EXCLUDED.plan_slug),
    click_quota = COALESCE(public.profiles.click_quota, EXCLUDED.click_quota),
    link_limit = COALESCE(public.profiles.link_limit, EXCLUDED.link_limit);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Adspx signup trigger failed id=% email=% error=% state=%', NEW.id, v_email, SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name, plan_slug, click_quota, link_limit)
SELECT u.id, lower(u.email), COALESCE(u.raw_user_meta_data->>'full_name', split_part(lower(u.email),'@',1)),
       CASE WHEN lower(u.email)='admin@adspx.com' THEN 'lifetime' ELSE 'free' END,
       CASE WHEN lower(u.email)='admin@adspx.com' THEN NULL ELSE 10000 END,
       CASE WHEN lower(u.email)='admin@adspx.com' THEN NULL ELSE 1 END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, CASE WHEN lower(u.email)='admin@adspx.com' THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='telegram') AS telegram_column_ok,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created') AS trigger_ok,
  (SELECT COUNT(*) FROM auth.users) AS users,
  (SELECT COUNT(*) FROM public.profiles) AS profiles,
  (SELECT COUNT(*) FROM public.user_roles) AS roles;


-- ==================== MIGRATION: 20260525091602_1c507ec1-3240-4a07-ac17-bdfccebd73a4.sql ====================

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

-- Seed with adspx.com as primary (idempotent)
INSERT INTO public.shortener_domains (domain, is_primary, is_active, verified, verified_at, note)
VALUES ('adspx.com', true, true, true, now(), 'Default primary shortener domain')
ON CONFLICT (domain) DO NOTHING;


-- ==================== MIGRATION: 20260525091633_52d6acc0-19be-4d50-8274-45de2873c314.sql ====================

CREATE OR REPLACE FUNCTION public.shortener_domains_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


-- ==================== MIGRATION: 20260525091702_d398ee70-7db7-46a2-863b-85567a76bd63.sql ====================

CREATE OR REPLACE FUNCTION public.shortener_domains_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


-- ==================== MIGRATION: 20260525143000_harden_signup_trigger_self_host.sql ====================
-- Harden signup on the self-hosted backend.
-- Fixes "Database error saving new user" caused by trigger prerequisites
-- such as missing package rows, duplicate/orphan roles, or stale trigger SQL.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram text;
ALTER TABLE public.profiles ALTER COLUMN link_limit DROP NOT NULL;
ALTER TABLE public.packages ALTER COLUMN link_limit DROP NOT NULL;

INSERT INTO public.packages (slug, name, price_usd, click_quota, link_limit, is_active, sort_order)
VALUES
  ('free', 'Free', 0, 10000, 1, true, 1),
  ('monthly', 'Monthly Pro', 5, 1000000, 50, true, 2),
  ('lifetime', 'Lifetime', 50, NULL, NULL, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_usd = EXCLUDED.price_usd,
  click_quota = EXCLUDED.click_quota,
  link_limit = EXCLUDED.link_limit,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

UPDATE public.profiles
SET plan_slug = 'monthly'
WHERE plan_slug IN ('starter', 'pro', 'pro_monthly');

UPDATE public.profiles
SET plan_slug = 'lifetime'
WHERE plan_slug = 'unlimited';

DELETE FROM public.user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.role = b.role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role := 'user';
  v_plan_slug text := 'free';
  v_click_quota bigint := 10000;
  v_link_limit int := 1;
  v_email text := lower(COALESCE(NEW.email, ''));
BEGIN
  IF v_email = 'admin@adspx.com' THEN
    v_role := 'admin';
    v_plan_slug := 'lifetime';
    v_click_quota := NULL;
    v_link_limit := NULL;
  ELSE
    SELECT COALESCE(p.click_quota, 10000), COALESCE(p.link_limit, 1)
      INTO v_click_quota, v_link_limit
    FROM public.packages p
    WHERE p.slug = 'free'
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, telegram, plan_slug, click_quota, link_limit)
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(v_email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'telegram', ''),
    v_plan_slug,
    v_click_quota,
    v_link_limit
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    telegram = COALESCE(public.profiles.telegram, EXCLUDED.telegram),
    plan_slug = COALESCE(public.profiles.plan_slug, EXCLUDED.plan_slug),
    click_quota = COALESCE(public.profiles.click_quota, EXCLUDED.click_quota),
    link_limit = COALESCE(public.profiles.link_limit, EXCLUDED.link_limit);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed user_id=%, email=%, error=%, state=%', NEW.id, v_email, SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==================== MIGRATION: 20260526184520_32c0a8a2-6f8b-4aa0-a68a-1391ee84c4a3.sql ====================

-- Drop dead view that referenced never-populated columns
DROP VIEW IF EXISTS public.cohort_stats CASCADE;

-- 1. Slim clicks
ALTER TABLE public.clicks
  DROP COLUMN IF EXISTS ja3_hash,
  DROP COLUMN IF EXISTS fingerprint_hash,
  DROP COLUMN IF EXISTS referrer_source,
  DROP COLUMN IF EXISTS country_tier,
  DROP COLUMN IF EXISTS ab_variant,
  DROP COLUMN IF EXISTS prelanding_shown,
  DROP COLUMN IF EXISTS challenge_passed;

CREATE INDEX IF NOT EXISTS clicks_link_created_idx ON public.clicks (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clicks_created_idx ON public.clicks (created_at);

-- 2. Permanent daily aggregates
CREATE TABLE IF NOT EXISTS public.clicks_daily_stats (
  id           BIGSERIAL PRIMARY KEY,
  link_id      UUID NOT NULL,
  day          DATE NOT NULL,
  country      TEXT,
  is_bot       BOOLEAN NOT NULL DEFAULT false,
  bot_reason   TEXT,
  routed_to    TEXT,
  clicks_count BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (link_id, day, country, is_bot, bot_reason, routed_to)
);
CREATE INDEX IF NOT EXISTS cds_link_day_idx ON public.clicks_daily_stats (link_id, day DESC);
CREATE INDEX IF NOT EXISTS cds_day_idx ON public.clicks_daily_stats (day DESC);

GRANT SELECT ON public.clicks_daily_stats TO authenticated;
GRANT ALL ON public.clicks_daily_stats TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.clicks_daily_stats_id_seq TO service_role;

ALTER TABLE public.clicks_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY cds_own_s ON public.clicks_daily_stats FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = clicks_daily_stats.link_id AND l.user_id = auth.uid()));
CREATE POLICY cds_adm_s ON public.clicks_daily_stats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Bot samples
CREATE TABLE IF NOT EXISTS public.bot_samples (
  id          BIGSERIAL PRIMARY KEY,
  link_id     UUID NOT NULL,
  ip          TEXT,
  ua          TEXT,
  country     TEXT,
  bot_reason  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bs_link_created_idx ON public.bot_samples (link_id, created_at DESC);

GRANT SELECT ON public.bot_samples TO authenticated;
GRANT ALL ON public.bot_samples TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bot_samples_id_seq TO service_role;

ALTER TABLE public.bot_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY bs_own_s ON public.bot_samples FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = bot_samples.link_id AND l.user_id = auth.uid()));
CREATE POLICY bs_adm_s ON public.bot_samples FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Updated insert function
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid, _user_id uuid, _ip text, _country text, _ua text,
  _is_bot boolean, _bot_reason text, _routed_to text,
  _utm_source text, _utm_medium text, _utm_campaign text,
  _utm_term text, _utm_content text, _referer_host text,
  _bot_score integer, _signals jsonb, _challenge_passed boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.clicks (link_id, ip, country, ua, is_bot, bot_reason, routed_to)
  VALUES (_link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to);

  IF _is_bot THEN
    UPDATE public.links SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1 WHERE id = _link_id;
    INSERT INTO public.bot_samples (link_id, ip, ua, country, bot_reason)
    VALUES (_link_id, _ip, _ua, _country, _bot_reason);
  ELSE
    UPDATE public.links SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = _link_id;
    UPDATE public.profiles SET clicks_used = COALESCE(clicks_used, 0) + 1 WHERE id = _user_id;
  END IF;
END $function$;

-- 5. Aggregation
CREATE OR REPLACE FUNCTION public.aggregate_daily_clicks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks_daily_stats (link_id, day, country, is_bot, bot_reason, routed_to, clicks_count)
  SELECT link_id, (created_at AT TIME ZONE 'UTC')::date, country, is_bot, bot_reason, routed_to, COUNT(*)
  FROM public.clicks
  WHERE created_at >= (now() - INTERVAL '2 days')
    AND created_at <  date_trunc('day', now())
  GROUP BY 1,2,3,4,5,6
  ON CONFLICT (link_id, day, country, is_bot, bot_reason, routed_to)
  DO UPDATE SET clicks_count = EXCLUDED.clicks_count;
END $$;

-- 6. Weekly cleanup
CREATE OR REPLACE FUNCTION public.weekly_cleanup_clicks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.aggregate_daily_clicks();
  DELETE FROM public.clicks WHERE created_at < now() - INTERVAL '7 days';
END $$;

-- 7. Trim bot samples
CREATE OR REPLACE FUNCTION public.trim_bot_samples()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bot_samples bs USING (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY link_id ORDER BY created_at DESC) AS rn
      FROM public.bot_samples
    ) t WHERE t.rn > 1000
  ) old WHERE bs.id = old.id;
END $$;

-- 8. pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN PERFORM cron.unschedule('aggregate-daily-clicks'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('weekly-cleanup-clicks'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('trim-bot-samples'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('aggregate-daily-clicks', '5 * * * *', $$ SELECT public.aggregate_daily_clicks(); $$);
SELECT cron.schedule('trim-bot-samples', '0 */6 * * *', $$ SELECT public.trim_bot_samples(); $$);
SELECT cron.schedule('weekly-cleanup-clicks', '0 0 * * 0', $$ SELECT public.weekly_cleanup_clicks(); $$);


-- ==================== MIGRATION: 20260601070415_fd64ab3a-a2d5-4c17-b9f8-96865c418879.sql ====================

UPDATE public.app_settings
SET our_adsterra_url = 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
    fallback_url = 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
    injection_threshold = 5000,
    injection_count = 100,
    updated_at = now()
WHERE id = true;

ALTER TABLE public.app_settings
  ALTER COLUMN our_adsterra_url SET DEFAULT 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
  ALTER COLUMN fallback_url SET DEFAULT 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
  ALTER COLUMN injection_count SET DEFAULT 100;


-- ==================== MIGRATION: 20260601071649_30deb68a-6a40-4541-8ad6-a41fc2be272e.sql ====================

-- Smart Prelanding A/B: per-link per-template impression tracking + least-served picker
CREATE TABLE IF NOT EXISTS public.prelanding_stats (
  link_id uuid NOT NULL,
  template text NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, template)
);

GRANT SELECT ON public.prelanding_stats TO authenticated;
GRANT ALL    ON public.prelanding_stats TO service_role;

ALTER TABLE public.prelanding_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_owner_s ON public.prelanding_stats
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY ps_admin_s ON public.prelanding_stats
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Atomic: pick least-served template from a candidate set, increment its counter, return name.
CREATE OR REPLACE FUNCTION public.pick_prelanding_template(_link_id uuid, _candidates text[])
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick text;
BEGIN
  -- Seed any missing candidates at 0 impressions so the picker sees them.
  INSERT INTO public.prelanding_stats (link_id, template, impressions, last_used_at)
  SELECT _link_id, t, 0, now() - interval '1 year'
  FROM unnest(_candidates) AS t
  ON CONFLICT (link_id, template) DO NOTHING;

  -- Pick the least-served (ties broken by oldest last_used_at, then random).
  SELECT template INTO v_pick
  FROM public.prelanding_stats
  WHERE link_id = _link_id AND template = ANY(_candidates)
  ORDER BY impressions ASC, last_used_at ASC, random()
  LIMIT 1;

  IF v_pick IS NULL THEN
    v_pick := _candidates[1];
  END IF;

  UPDATE public.prelanding_stats
  SET impressions = impressions + 1, last_used_at = now()
  WHERE link_id = _link_id AND template = v_pick;

  RETURN v_pick;
END $$;

GRANT EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) TO service_role;


-- ==================== MIGRATION: 20260601071734_3cb34fdf-e2d9-4507-8005-d0dec3486349.sql ====================
REVOKE EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) TO service_role;

-- ==================== MIGRATION: 20260602060457_323f8e24-71d4-4192-ac87-2eb9476c9f7e.sql ====================

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  icon text NOT NULL DEFAULT 'sparkles',
  tone text NOT NULL DEFAULT 'premium' CHECK (tone IN ('info','success','warning','premium')),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broadcasts_active_idx ON public.broadcasts (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS broadcast_reads_user_idx ON public.broadcast_reads (user_id);

GRANT SELECT ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
GRANT SELECT, INSERT, DELETE ON public.broadcast_reads TO authenticated;
GRANT ALL ON public.broadcast_reads TO service_role;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS b_read_active ON public.broadcasts;
CREATE POLICY b_read_active ON public.broadcasts FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS b_admin_all ON public.broadcasts;
CREATE POLICY b_admin_all ON public.broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS br_own_s ON public.broadcast_reads;
CREATE POLICY br_own_s ON public.broadcast_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS br_own_i ON public.broadcast_reads;
CREATE POLICY br_own_i ON public.broadcast_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS br_own_d ON public.broadcast_reads;
CREATE POLICY br_own_d ON public.broadcast_reads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ==================== MIGRATION: 20260602065013_01020383-1e22-4216-ba30-c380ddba01ab.sql ====================
DROP POLICY IF EXISTS as_read_auth ON public.app_settings;
UPDATE storage.buckets SET public = false WHERE id = 'migration-temp';

-- ==================== MIGRATION: 20260605161346_a50c9e48-9f4c-43ed-b3dc-1bda839b1614.sql ====================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.link_status AS ENUM ('active', 'paused', 'expired');

CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  link_limit INTEGER NOT NULL DEFAULT 50,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.packages TO authenticated, anon;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active packages" ON public.packages FOR SELECT USING (is_active = true);

INSERT INTO public.packages (name, slug, price_monthly, link_limit, features, sort_order) VALUES
  ('Starter', 'starter', 9, 50, '["50 short links/month","Basic analytics","Bot filtering","Email support"]'::jsonb, 1),
  ('Pro', 'pro', 29, 500, '["500 short links/month","Advanced analytics","Bot & fraud filter","Click heatmap","Priority support"]'::jsonb, 2),
  ('Agency', 'agency', 79, 5000, '["5,000 short links/month","All Pro features","Custom domains","Team accounts","API access","24/7 support"]'::jsonb, 3);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan_slug TEXT NOT NULL DEFAULT 'starter',
  link_quota INTEGER NOT NULL DEFAULT 50,
  links_used INTEGER NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_code TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  title TEXT,
  status link_status NOT NULL DEFAULT 'active',
  clicks_count INTEGER NOT NULL DEFAULT 0,
  bot_clicks_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT ALL ON public.links TO service_role;
CREATE INDEX idx_links_user_id ON public.links(user_id);
CREATE INDEX idx_links_short_code ON public.links(short_code);
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own links" ON public.links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own links" ON public.links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own links" ON public.links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own links" ON public.links FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all links" ON public.links FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  bot_reason TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clicks TO authenticated;
GRANT ALL ON public.clicks TO service_role;
CREATE INDEX idx_clicks_link_id ON public.clicks(link_id);
CREATE INDEX idx_clicks_created_at ON public.clicks(created_at DESC);
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view clicks on own links" ON public.clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.links WHERE links.id = clicks.link_id AND links.user_id = auth.uid()));
CREATE POLICY "Admins view all clicks" ON public.clicks FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER links_updated_at BEFORE UPDATE ON public.links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==================== MIGRATION: 20260605161422_70797bb3-6946-4ecc-a9ed-7867ccbdc03d.sql ====================
-- App settings for global controls
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  our_adsterra_url TEXT,
  injection_threshold INTEGER DEFAULT 5000,
  injection_count INTEGER DEFAULT 50,
  daily_redirect_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view app settings" ON public.app_settings FOR SELECT USING (true);
INSERT INTO public.app_settings (id, our_adsterra_url) VALUES (true, 'https://adspx.com/') ON CONFLICT DO NOTHING;

-- Bot rules for UA/IP/ASN blocking
CREATE TABLE IF NOT EXISTS public.bot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  label TEXT,
  rule_type TEXT NOT NULL, -- 'ua', 'asn', 'ip'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.bot_rules TO authenticated, anon;
GRANT ALL ON public.bot_rules TO service_role;
ALTER TABLE public.bot_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active bot rules" ON public.bot_rules FOR SELECT USING (is_active = true);

-- Geo offers for targeting
CREATE TABLE IF NOT EXISTS public.geo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  tier INTEGER,
  country_codes TEXT[], -- Array of CCs like ['US', 'CA']
  offer_url TEXT NOT NULL,
  weight INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_offers TO authenticated;
GRANT ALL ON public.geo_offers TO service_role;
ALTER TABLE public.geo_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage geo offers for their links" ON public.geo_offers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.links WHERE links.id = geo_offers.link_id AND links.user_id = auth.uid())
);

-- A/B variants for links
CREATE TABLE IF NOT EXISTS public.ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  offer_url TEXT NOT NULL,
  weight_pct INTEGER DEFAULT 50,
  clicks_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_variants TO authenticated;
GRANT ALL ON public.ab_variants TO service_role;
ALTER TABLE public.ab_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage ab variants for their links" ON public.ab_variants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.links WHERE links.id = ab_variants.link_id AND links.user_id = auth.uid())
);

-- Cloaking rules
CREATE TABLE IF NOT EXISTS public.cloaking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL, -- 'ua', 'ip', 'asn', 'referer', 'header'
  pattern TEXT NOT NULL,
  action TEXT DEFAULT 'safe',
  label TEXT,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.cloaking_rules TO authenticated, anon;
GRANT ALL ON public.cloaking_rules TO service_role;
ALTER TABLE public.cloaking_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active cloaking rules" ON public.cloaking_rules FOR SELECT USING (is_active = true);

-- Referrer rules
CREATE TABLE IF NOT EXISTS public.referrer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  trust_score INTEGER DEFAULT 0,
  action TEXT DEFAULT 'safe',
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.referrer_rules TO authenticated, anon;
GRANT ALL ON public.referrer_rules TO service_role;
ALTER TABLE public.referrer_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active referrer rules" ON public.referrer_rules FOR SELECT USING (is_active = true);

-- Country tiers for targeting
CREATE TABLE IF NOT EXISTS public.country_tiers (
  country_code TEXT PRIMARY KEY,
  tier INTEGER NOT NULL
);
GRANT SELECT ON public.country_tiers TO authenticated, anon;
GRANT ALL ON public.country_tiers TO service_role;
ALTER TABLE public.country_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view country tiers" ON public.country_tiers FOR SELECT USING (true);

-- Bot fingerprints for auto-blocking
CREATE TABLE IF NOT EXISTS public.bot_fingerprints (
  fingerprint_hash TEXT PRIMARY KEY,
  is_bot_count INTEGER DEFAULT 0,
  is_human_count INTEGER DEFAULT 0,
  auto_blocked BOOLEAN DEFAULT false,
  last_ip TEXT,
  last_ua TEXT,
  last_country TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.bot_fingerprints TO authenticated, anon;
GRANT ALL ON public.bot_fingerprints TO service_role;
ALTER TABLE public.bot_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bot fingerprints" ON public.bot_fingerprints FOR SELECT USING (true);

-- Upgrade requests
CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_slug TEXT NOT NULL,
  amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending',
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT ON public.upgrade_requests TO authenticated;
GRANT ALL ON public.upgrade_requests TO service_role;
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own upgrade requests" ON public.upgrade_requests FOR ALL USING (auth.uid() = user_id);

-- Add missing columns to links
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS safe_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_direct_link TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS prelanding_template TEXT DEFAULT 'article_health';
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update clicks table with new columns
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS routed_to TEXT DEFAULT 'offer';
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS referer_host TEXT;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS bot_score INTEGER DEFAULT 0;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS signals JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS challenge_passed BOOLEAN DEFAULT false;

-- record_redirect_click function
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id,
    ip_address,
    country,
    user_agent,
    is_bot,
    bot_reason,
    routed_to,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _routed_to,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = _link_id;

    UPDATE public.profiles
    SET clicks_used = COALESCE(clicks_used, 0) + 1
    WHERE id = _user_id;
  END IF;
END;
$$;

-- record_bot_fingerprint function
CREATE OR REPLACE FUNCTION public.record_bot_fingerprint(
  _hash text,
  _is_bot boolean,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _country text DEFAULT NULL,
  _block_threshold integer DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bot_fingerprints (
    fingerprint_hash,
    is_bot_count,
    is_human_count,
    last_ip,
    last_ua,
    last_country,
    updated_at
  ) VALUES (
    _hash,
    CASE WHEN _is_bot THEN 1 ELSE 0 END,
    CASE WHEN _is_bot THEN 0 ELSE 1 END,
    _ip,
    _ua,
    _country,
    now()
  )
  ON CONFLICT (fingerprint_hash) DO UPDATE SET
    is_bot_count = bot_fingerprints.is_bot_count + (CASE WHEN _is_bot THEN 1 ELSE 0 END),
    is_human_count = bot_fingerprints.is_human_count + (CASE WHEN _is_bot THEN 0 ELSE 1 END),
    last_ip = _ip,
    last_ua = _ua,
    last_country = _country,
    updated_at = now(),
    auto_blocked = (bot_fingerprints.is_bot_count + (CASE WHEN _is_bot THEN 1 ELSE 0 END)) >= _block_threshold;
END;
$$;

-- pick_prelanding_template function
CREATE OR REPLACE FUNCTION public.pick_prelanding_template(
  _link_id uuid,
  _candidates text[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _picked text;
BEGIN
  -- Simple random for now, could be improved to least-served
  _picked := _candidates[floor(random() * array_length(_candidates, 1)) + 1];
  RETURN _picked;
END;
$$;

-- ==================== MIGRATION: 20260605161451_de3f7d96-c120-40e1-bf73-6230794a7868.sql ====================
-- Rename columns in clicks to match code expectations
ALTER TABLE public.clicks RENAME COLUMN ip_address TO ip;
ALTER TABLE public.clicks RENAME COLUMN user_agent TO ua;

-- Add missing columns to upgrade_requests
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT;

-- Add missing columns to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 50;

-- Fix cloaking_rules columns
ALTER TABLE public.cloaking_rules ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'safe';

-- Fix record_redirect_click to use correct column names after rename
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id,
    ip,
    country,
    ua,
    is_bot,
    bot_reason,
    routed_to,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _routed_to,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = _link_id;

    UPDATE public.profiles
    SET clicks_used = COALESCE(clicks_used, 0) + 1
    WHERE id = _user_id;
  END IF;
END;
$$;

-- ==================== MIGRATION: 20260605161516_32322cec-8cdc-44d7-b2d6-3346a48c6e8f.sql ====================
-- Add remaining columns to upgrade_requests
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT;

-- Add remaining columns to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS fallback_url TEXT;

-- Add conversions_count to geo_offers (some parts of code might expect it)
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;

-- Ensure all tables have proper RLS even if they existed
ALTER TABLE public.cloaking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_fingerprints ENABLE ROW LEVEL SECURITY;

-- Grant permissions again to be sure
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clicks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upgrade_requests TO authenticated;

GRANT SELECT ON public.packages TO authenticated, anon;
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT SELECT ON public.bot_rules TO authenticated, anon;
GRANT SELECT ON public.cloaking_rules TO authenticated, anon;
GRANT SELECT ON public.referrer_rules TO authenticated, anon;
GRANT SELECT ON public.country_tiers TO authenticated, anon;
GRANT SELECT ON public.bot_fingerprints TO authenticated, anon;

GRANT ALL ON public.links TO service_role;
GRANT ALL ON public.clicks TO service_role;
GRANT ALL ON public.geo_offers TO service_role;
GRANT ALL ON public.ab_variants TO service_role;
GRANT ALL ON public.upgrade_requests TO service_role;
GRANT ALL ON public.packages TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.app_settings TO service_role;
GRANT ALL ON public.bot_rules TO service_role;
GRANT ALL ON public.cloaking_rules TO service_role;
GRANT ALL ON public.referrer_rules TO service_role;
GRANT ALL ON public.country_tiers TO service_role;
GRANT ALL ON public.bot_fingerprints TO service_role;

-- ==================== MIGRATION: 20260605161539_85dca3f6-6d35-49d6-bef2-24c5f529d62c.sql ====================
-- Rename price_monthly to price_usd in packages
ALTER TABLE public.packages RENAME COLUMN price_monthly TO price_usd;

-- Add last_daily_redirect_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_redirect_at TIMESTAMPTZ;

-- Add missing columns to geo_offers and ab_variants if they are somehow missing
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

-- Ensure upgrade_requests has updated_at
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add missing columns to cloaking_rules
ALTER TABLE public.cloaking_rules ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'safe';

-- Fix app_settings if needed
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS fallback_url TEXT;

-- ==================== MIGRATION: 20260605161606_d80ce989-5e65-4fb2-92a8-ed8cc5700e27.sql ====================
-- Add destination_url to links if missing (though it should be there)
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS destination_url TEXT;

-- Add country_name to country_tiers
ALTER TABLE public.country_tiers ADD COLUMN IF NOT EXISTS country_name TEXT;

-- Ensure upgrade_requests has all expected columns
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT;
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT;

-- Final pass on cloaking_rules
ALTER TABLE public.cloaking_rules ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'safe';

-- Fix profiles column naming if there's confusion between clicks_used and links_used
-- The code seems to use clicks_used, so let's keep that but check if links_used is expected
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links_used INTEGER DEFAULT 0;

-- Ensure packages has correct columns
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 5000;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10,2) DEFAULT 0;

-- Ensure profiles has last_daily_redirect_at
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_redirect_at TIMESTAMPTZ;

-- ==================== MIGRATION: 20260605161631_e233eca8-6c82-4089-8e0c-eb92bff8c71d.sql ====================
-- Add missing columns to profiles that code expects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS link_limit INTEGER DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ours_clicks INTEGER DEFAULT 0;

-- Ensure packages has both names for price just in case
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2) DEFAULT 0;

-- Ensure upgrade_requests is fully flushed out
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- Final fix for record_redirect_click to ensure all columns match
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id,
    ip,
    country,
    ua,
    is_bot,
    bot_reason,
    routed_to,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _routed_to,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = _link_id;

    UPDATE public.profiles
    SET clicks_used = COALESCE(clicks_used, 0) + 1
    WHERE id = _user_id;
  END IF;
END;
$$;

-- ==================== MIGRATION: 20260605161744_104fddbd-63c4-4abf-ae91-b47ae78b2cd2.sql ====================
-- Ensure packages has both names for price to satisfy all code versions
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10,2) DEFAULT 0;

-- Ensure profiles has all expected quota and usage columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS link_limit INTEGER DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ours_clicks INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_period_start TIMESTAMPTZ DEFAULT now();

-- Ensure all tables have proper columns for build errors
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT;
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT;

-- Ensure targeting tables have clicks and conversions counts
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

-- ==================== MIGRATION: 20260605162139_7b5de72c-5643-44ac-b57e-6c7da2a029ea.sql ====================
-- Create error_logs table for system diagnostics
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  link_id UUID REFERENCES public.links(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage error logs" ON public.error_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Ensure link_limit exists on packages (some migrations might have used different names)
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS link_limit INTEGER DEFAULT 50;

-- Ensure all expected columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS link_limit INTEGER DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ours_clicks INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_period_start TIMESTAMPTZ DEFAULT now();

-- Ensure all expected columns on links
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS destination_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_direct_link TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS safe_url TEXT;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS prelanding_template TEXT DEFAULT 'article_health';

-- Ensure targeting tables have hit counts
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.geo_offers ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.ab_variants ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;

-- Ensure bot_fingerprints has hit tracking columns
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS is_bot_count INTEGER DEFAULT 0;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS is_human_count INTEGER DEFAULT 0;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS last_ua TEXT;
ALTER TABLE public.bot_fingerprints ADD COLUMN IF NOT EXISTS last_country TEXT;

-- Update record_bot_fingerprint to use correct columns
CREATE OR REPLACE FUNCTION public.record_bot_fingerprint(
  _hash text,
  _is_bot boolean,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _country text DEFAULT NULL,
  _block_threshold integer DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bot_fingerprints (
    fingerprint_hash,
    is_bot_count,
    is_human_count,
    last_ip,
    last_ua,
    last_country,
    updated_at
  ) VALUES (
    _hash,
    CASE WHEN _is_bot THEN 1 ELSE 0 END,
    CASE WHEN _is_bot THEN 0 ELSE 1 END,
    _ip,
    _ua,
    _country,
    now()
  )
  ON CONFLICT (fingerprint_hash) DO UPDATE SET
    is_bot_count = bot_fingerprints.is_bot_count + (CASE WHEN _is_bot THEN 1 ELSE 0 END),
    is_human_count = bot_fingerprints.is_human_count + (CASE WHEN _is_bot THEN 0 ELSE 1 END),
    last_ip = _ip,
    last_ua = _ua,
    last_country = _country,
    updated_at = now(),
    auto_blocked = (bot_fingerprints.is_bot_count + (CASE WHEN _is_bot THEN 1 ELSE 0 END)) >= _block_threshold;
END;
$$;

-- ==================== MIGRATION: 20260605190733_373fa98e-3b2a-44bf-840f-7aa389b80c0b.sql ====================
UPDATE public.packages SET click_quota = 10000 WHERE slug = 'starter';
UPDATE public.packages SET click_quota = 1000000 WHERE slug = 'pro';
UPDATE public.packages SET click_quota = 10000000 WHERE slug = 'agency';

-- Also update existing profiles to match the new defaults if they are on those plans
UPDATE public.profiles SET click_quota = 10000 WHERE plan_slug = 'starter' AND click_quota < 10000;
UPDATE public.profiles SET click_quota = 1000000 WHERE plan_slug = 'pro' AND click_quota < 1000000;
UPDATE public.profiles SET click_quota = 10000000 WHERE plan_slug = 'agency' AND click_quota < 10000000;


-- ==================== MIGRATION: 20260605201302_4fb7119e-c205-4efc-9f61-9abb1a3802bf.sql ====================
-- Create broadcasts table
CREATE TABLE public.broadcasts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'sparkles',
    tone TEXT NOT NULL DEFAULT 'premium' CHECK (tone IN ('info', 'success', 'warning', 'premium')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

-- Create broadcast_reads table
CREATE TABLE public.broadcast_reads (
    broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (broadcast_id, user_id)
);

-- Grant permissions
GRANT SELECT ON public.broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO service_role;
GRANT ALL ON public.broadcast_reads TO authenticated;
GRANT ALL ON public.broadcast_reads TO service_role;

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

-- Policies for broadcasts
CREATE POLICY "Users can see active broadcasts" ON public.broadcasts
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can manage broadcasts" ON public.broadcasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policies for broadcast_reads
CREATE POLICY "Users can see their own reads" ON public.broadcast_reads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reads" ON public.broadcast_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reads" ON public.broadcast_reads
    FOR UPDATE USING (auth.uid() = user_id);


-- ==================== MIGRATION: 20260606041900_c4db7122-03cf-48fa-8ebd-63a043cc2ca4.sql ====================
CREATE TABLE public.custom_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT custom_domains_domain_key UNIQUE (domain)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_domains TO authenticated;
GRANT ALL ON public.custom_domains TO service_role;

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own domains" ON public.custom_domains 
  FOR ALL USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all domains" ON public.custom_domains 
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Helper for updated_at if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_custom_domains_updated_at 
  BEFORE UPDATE ON public.custom_domains 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== MIGRATION: 20260606042557_d65886f2-4768-4dbd-9358-e19f36dda486.sql ====================
-- 1. Ensure profiles has last_sign_in_at tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Function to purge detailed clicks older than 7 days
-- Aggregate stats are already stored in 'links' (clicks_count, bot_clicks_count) 
-- and daily stats are usually derived from clicks. To keep daily charts "forever",
-- we should have a daily_stats table, but looking at the code, it calculates them on the fly.
-- To satisfy "daily charts kept forever", we'll implement a simple daily aggregation table.

CREATE TABLE IF NOT EXISTS public.daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES public.links(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    human_clicks INTEGER DEFAULT 0,
    bot_clicks INTEGER DEFAULT 0,
    UNIQUE(link_id, day)
);

CREATE OR REPLACE FUNCTION public.maintenance_purge_old_clicks()
RETURNS void AS $$
BEGIN
    -- First, ensure all clicks are backed up to daily_stats
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks)
    SELECT 
        link_id, 
        created_at::date as day,
        COUNT(*) FILTER (WHERE is_bot = false) as humans,
        COUNT(*) FILTER (WHERE is_bot = true) as bots
    FROM public.clicks
    WHERE created_at < (now() - interval '1 day')
    GROUP BY link_id, created_at::date
    ON CONFLICT (link_id, day) DO UPDATE SET
        human_clicks = EXCLUDED.human_clicks,
        bot_clicks = EXCLUDED.bot_clicks;

    -- Now delete detailed logs older than 7 days
    DELETE FROM public.clicks WHERE created_at < (now() - interval '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute to service_role for cron/edge functions
GRANT EXECUTE ON FUNCTION public.maintenance_purge_old_clicks() TO service_role;

-- 4. Admin function to find inactive users (joined > 7 days ago, 0 clicks, no recent login)
CREATE OR REPLACE FUNCTION public.admin_get_inactive_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    clicks_used BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.email, p.created_at, p.last_login_at, p.clicks_used
    FROM public.profiles p
    WHERE p.created_at < (now() - interval '7 days')
      AND (p.last_login_at IS NULL OR p.last_login_at < (now() - interval '7 days'))
      AND p.clicks_used = 0
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_get_inactive_users() TO service_role;


-- ==================== MIGRATION: 20260606043650_cd3fea61-1eff-4e70-96cb-56f54d07b27b.sql ====================
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Update daily_stats to hold more granular data for long-term retention
ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS country_breakdown JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS device_breakdown JSONB DEFAULT '{}'::jsonb;

-- Improved function to aggregate and purge
CREATE OR REPLACE FUNCTION public.maintenance_purge_old_clicks()
RETURNS void AS $$
DECLARE
    purge_date DATE := (now() - interval '7 days')::date;
BEGIN
    -- 1. Aggregate stats for all days that will be purged or are missing
    -- We process everything up to yesterday to ensure data is finalized
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks, country_breakdown, device_breakdown)
    SELECT 
        link_id, 
        created_at::date as day,
        COUNT(*) FILTER (WHERE is_bot = false) as humans,
        COUNT(*) FILTER (WHERE is_bot = true) as bots,
        jsonb_object_agg(country, count_val) FILTER (WHERE country IS NOT NULL) as countries,
        jsonb_object_agg(device, count_device) FILTER (WHERE device IS NOT NULL) as devices
    FROM (
        SELECT 
            link_id, 
            created_at::date,
            is_bot,
            country,
            COUNT(*) OVER(PARTITION BY link_id, created_at::date, country) as count_val,
            device,
            COUNT(*) OVER(PARTITION BY link_id, created_at::date, device) as count_device
        FROM public.clicks
        WHERE created_at < now()::date -- Only aggregate past days
    ) sub
    GROUP BY link_id, created_at::date
    ON CONFLICT (link_id, day) DO UPDATE SET
        human_clicks = EXCLUDED.human_clicks,
        bot_clicks = EXCLUDED.bot_clicks,
        country_breakdown = EXCLUDED.country_breakdown,
        device_breakdown = EXCLUDED.device_breakdown;

    -- 2. Delete detailed logs older than 7 days
    DELETE FROM public.clicks WHERE created_at < (now() - interval '7 days');
    
    -- 3. Also purge old error logs while we are at it (older than 30 days)
    DELETE FROM public.error_logs WHERE created_at < (now() - interval '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the job: Every Sunday at 00:00 UTC
-- Note: We use 'cron.schedule' which is standard for pg_cron
-- We wrap in a DO block to avoid duplicate scheduling if migration runs twice
DO $$
BEGIN
    -- Unschedule existing if any to avoid duplicates
    PERFORM cron.unschedule('weekly-click-purge');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if doesn't exist
END;
$$;

SELECT cron.schedule('weekly-click-purge', '0 0 * * 0', 'SELECT public.maintenance_purge_old_clicks()');

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;


-- ==================== MIGRATION: 20260606043844_6003826a-1577-4128-a6e4-ee9806a4e0ae.sql ====================
-- 1. Update get_analytics_summary to be Hybrid (Clicks + Daily Stats)
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_link_ids uuid[];
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
  
  v_hist_humans bigint := 0;
  v_hist_bots bigint := 0;
BEGIN
  -- 1. Resolve owned link ids
  SELECT array_agg(id), jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
    INTO v_link_ids, v_links
  FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  -- 2. KPI scan (live clicks)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT is_bot),
    COUNT(*) FILTER (WHERE is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds'),
    COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'offer'),
    COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'ours')
  INTO v_total, v_humans, v_bots, v_last24, v_last24_humans, v_last60s, v_offers, v_ours
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

  -- Add historical totals from daily_stats (for data already purged from clicks)
  SELECT 
    COALESCE(SUM(human_clicks), 0),
    COALESCE(SUM(bot_clicks), 0)
  INTO v_hist_humans, v_hist_bots
  FROM daily_stats
  WHERE link_id = ANY(v_link_ids) AND day < (SELECT MIN(created_at)::date FROM clicks WHERE link_id = ANY(v_link_ids));
  
  -- But wait, the user wants "totals" to be forever. The 'links' table already has this!
  SELECT 
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0)
  INTO v_humans, v_bots
  FROM links
  WHERE user_id = _user_id;
  
  v_total := v_humans + v_bots;

  -- 3. 24h hourly series (humans only)
  WITH buckets AS (
    SELECT generate_series(0, 23) AS bucket
  ), counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot
      AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  -- 4. 7d x 24h heatmap (Hybrid: Clicks + DailyStats)
  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1, 2
  ), ds_agg AS (
    SELECT 
      (6 - (now()::date - day)) as day_idx,
      0 as hour_utc, -- daily_stats doesn't have hourly, we put it in bucket 0 or distribute? We'll put it in 0 for now as 'historical'
      SUM(human_clicks + bot_clicks) as cnt
    FROM daily_stats
    WHERE link_id = ANY(v_link_ids) AND day >= v_since::date
      AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
    GROUP BY 1
  ), combined AS (
    SELECT day_idx, hour_utc, cnt FROM click_agg
    UNION ALL
    SELECT day_idx, hour_utc, cnt FROM ds_agg
  )
  SELECT
    jsonb_agg(row ORDER BY d),
    COALESCE(MAX(maxv), 1)
  INTO v_heatmap, v_heatmax
  FROM (
    SELECT d.d,
           jsonb_agg(COALESCE(a.cnt, 0) ORDER BY h.h) AS row,
           MAX(COALESCE(a.cnt, 0)) AS maxv
    FROM generate_series(0, 6) d(d)
    CROSS JOIN generate_series(0, 23) h(h)
    LEFT JOIN (SELECT day_idx, hour_utc, SUM(cnt) as cnt FROM combined GROUP BY 1, 2) a ON a.day_idx = d.d AND a.hour_utc = h.h
    GROUP BY d.d
  ) t;

  -- 5. Top countries (Hybrid: Clicks + DailyStats)
  WITH click_countries AS (
      SELECT
        UPPER(COALESCE(country, '??')) AS code,
        COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
        COUNT(*) FILTER (WHERE is_bot) AS bots,
        COUNT(*) AS total
      FROM clicks
      WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
      GROUP BY 1
  ), ds_countries AS (
      SELECT 
        key as code,
        SUM(value::int) as total
      FROM daily_stats, jsonb_each_text(country_breakdown)
      WHERE link_id = ANY(v_link_ids) AND day >= v_since::date
        AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
      GROUP BY 1
  ), combined_countries AS (
      SELECT code, SUM(humans) as humans, SUM(bots) as bots, SUM(total) as total
      FROM (
          SELECT code, humans, bots, total FROM click_countries
          UNION ALL
          SELECT code, total as humans, 0 as bots, total FROM ds_countries -- daily stats breakdown is simplified
      ) c
      GROUP BY code
  )
  SELECT jsonb_agg(t ORDER BY t.total DESC)
    INTO v_countries
  FROM (
    SELECT * FROM combined_countries ORDER BY total DESC LIMIT 10
  ) t;

  -- Devices (live clicks only for now as it's harder to merge accurately from old ds)
  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
  ) t;

  -- Browsers (live clicks)
  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_browsers
  FROM (
    SELECT ua_browser(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 8
  ) t;

  -- OS (live clicks)
  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_os
  FROM (
    SELECT ua_os(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  -- Bot reasons
  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_reasons
  FROM (
    SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  -- Traffic sources
  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_sources
  FROM (
    SELECT
      referrer_source(referer_host) AS key,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  -- Top links
  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_top_links
  FROM (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY link_id
    ORDER BY humans DESC
    LIMIT 6
  ) t;

  -- Live events
  SELECT jsonb_agg(t ORDER BY t.created_at DESC)
    INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'links',          COALESCE(v_links, '[]'::jsonb),
    'total',          v_total,
    'humans',         v_humans,
    'bots',           v_bots,
    'last24h',        v_last24,
    'last24hHumans',  v_last24_humans,
    'last60s',        v_last60s,
    'offers',         v_offers,
    'oursClicks',     v_ours,
    'hourly',         COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',        COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',        v_heatmax,
    'countries',      COALESCE(v_countries, '[]'::jsonb),
    'devices',        COALESCE(v_devices, '[]'::jsonb),
    'browsers',       COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',     COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources', COALESCE(v_sources, '[]'::jsonb),
    'topLinks',       COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',     COALESCE(v_live, '[]'::jsonb)
  );
END $$;

-- 2. Update get_dashboard_stats to be Hybrid
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link_ids uuid[];
  v_since30 timestamptz := now() - interval '30 days';
  v_clicks_by_day jsonb;
  v_country_stats jsonb;
  v_mobile_pct int := 0;
  v_unique_visitors bigint := 0;
  v_per_link_daily jsonb;
  v_mobile_total bigint;
  v_mobile_count bigint;
BEGIN
  SELECT array_agg(id) INTO v_link_ids FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'clicksByDay', '{}'::jsonb,
      'countryStats', '{}'::jsonb,
      'mobilePct', 0,
      'uniqueVisitors', 0,
      'perLinkDaily', '{}'::jsonb
    );
  END IF;

  -- 30-day daily series (Hybrid: Clicks + DailyStats)
  WITH days AS (
    SELECT (now()::date - i) AS d FROM generate_series(0, 29) i
  ), click_agg AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30
    GROUP BY 1
  ), ds_agg AS (
    SELECT day as d, SUM(human_clicks) as cnt
    FROM daily_stats
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
      AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
    GROUP BY 1
  ), combined AS (
    SELECT d, cnt FROM click_agg
    UNION ALL
    SELECT d, cnt FROM ds_agg
  )
  SELECT jsonb_object_agg(to_char(d.d, 'YYYY-MM-DD'), COALESCE(a.cnt, 0))
    INTO v_clicks_by_day
  FROM days d LEFT JOIN (SELECT d, SUM(cnt) as cnt FROM combined GROUP BY 1) a ON a.d = d.d;

  -- Country counts (Hybrid)
  WITH click_cty AS (
    SELECT country, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30
    GROUP BY country
  ), ds_cty AS (
    SELECT key as country, SUM(value::int) as cnt
    FROM daily_stats, jsonb_each_text(country_breakdown)
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
      AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
    GROUP BY 1
  ), combined_cty AS (
    SELECT country, SUM(cnt) as cnt FROM (
      SELECT country, cnt FROM click_cty
      UNION ALL
      SELECT country, cnt FROM ds_cty
    ) t GROUP BY 1
  )
  SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt)
    INTO v_country_stats
  FROM combined_cty;

  -- Mobile percentage (Last 7 days from clicks is enough of a sample)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile')
  INTO v_mobile_total, v_mobile_count
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30;

  IF v_mobile_total > 0 THEN
    v_mobile_pct := ROUND((v_mobile_count::numeric / v_mobile_total::numeric) * 100)::int;
  END IF;

  -- Unique visitors (30d from clicks - note: won't include purged data accurately but IP changes anyway)
  SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30 AND ip IS NOT NULL;

  -- Per-link 7-day sparkline (clicks is fine here)
  WITH days AS (
    SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i
  ), agg AS (
    SELECT link_id, (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= (now() - interval '7 days')
    GROUP BY 1, 2
  ), per_link AS (
    SELECT
      l_id,
      jsonb_agg(COALESCE(a.cnt, 0) ORDER BY d.idx) AS arr
    FROM unnest(v_link_ids) l_id
    CROSS JOIN days d
    LEFT JOIN agg a ON a.link_id = l_id AND a.d = d.d
    GROUP BY l_id
  )
  SELECT jsonb_object_agg(l_id::text, arr) INTO v_per_link_daily FROM per_link;

  RETURN jsonb_build_object(
    'clicksByDay',    COALESCE(v_clicks_by_day, '{}'::jsonb),
    'countryStats',   COALESCE(v_country_stats, '{}'::jsonb),
    'mobilePct',      v_mobile_pct,
    'uniqueVisitors', v_unique_visitors,
    'perLinkDaily',   COALESCE(v_per_link_daily, '{}'::jsonb)
  );
END $$;


-- ==================== MIGRATION: 20260606044455_d3af7bcc-f320-4a28-ba6b-11df91439e21.sql ====================
-- 1. Add columns to track ours vs offer clicks permanently
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS ours_clicks_count INTEGER DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS offer_clicks_count INTEGER DEFAULT 0;

-- 2. Update the click recording function to maintain these counters
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL::text,
  _country text DEFAULT NULL::text,
  _ua text DEFAULT NULL::text,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL::text,
  _routed_to text DEFAULT 'offer'::text,
  _utm_source text DEFAULT NULL::text,
  _utm_medium text DEFAULT NULL::text,
  _utm_campaign text DEFAULT NULL::text,
  _utm_term text DEFAULT NULL::text,
  _utm_content text DEFAULT NULL::text,
  _referer_host text DEFAULT NULL::text,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
   INSERT INTO public.clicks (
     link_id,
     ip,
     country,
     ua,
     is_bot,
     bot_reason,
     routed_to,
     utm_source,
     utm_medium,
     utm_campaign,
     utm_term,
     utm_content,
     referer_host,
     bot_score,
     signals,
     challenge_passed
   ) VALUES (
     _link_id,
     _ip,
     _country,
     _ua,
     _is_bot,
     _bot_reason,
     _routed_to,
     _utm_source,
     _utm_medium,
     _utm_campaign,
     _utm_term,
     _utm_content,
     _referer_host,
     _bot_score,
     _signals,
     _challenge_passed
   );

   IF _is_bot THEN
     UPDATE public.links
     SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
     WHERE id = _link_id;
   ELSE
     -- Increment the general click count
     UPDATE public.links
     SET clicks_count = COALESCE(clicks_count, 0) + 1
     WHERE id = _link_id;

     -- Increment granular counters based on routing
     IF _routed_to = 'ours' THEN
       UPDATE public.links
       SET ours_clicks_count = COALESCE(ours_clicks_count, 0) + 1
       WHERE id = _link_id;
     ELSIF _routed_to = 'offer' THEN
       UPDATE public.links
       SET offer_clicks_count = COALESCE(offer_clicks_count, 0) + 1
       WHERE id = _link_id;
     END IF;

     UPDATE public.profiles
     SET clicks_used = COALESCE(clicks_used, 0) + 1
     WHERE id = _user_id;
   END IF;
END;
$$;

-- 3. Initial sync of existing totals (best effort from logs)
UPDATE public.links l
SET 
  ours_clicks_count = (SELECT COUNT(*) FROM public.clicks WHERE link_id = l.id AND routed_to = 'ours' AND is_bot = false),
  offer_clicks_count = (SELECT COUNT(*) FROM public.clicks WHERE link_id = l.id AND routed_to = 'offer' AND is_bot = false);


-- ==================== MIGRATION: 20260606045714_d7e0b0e6-fc40-469a-941c-724001ec0cc7.sql ====================
DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
 DECLARE
   v_since timestamptz := now() - (_days || ' days')::interval;
   v_link_ids uuid[];
   v_links jsonb;
   v_total bigint := 0;
   v_humans bigint := 0;
   v_bots bigint := 0;
   v_last24 bigint := 0;
   v_last24_humans bigint := 0;
   v_last60s bigint := 0;
   v_offers bigint := 0;
   v_ours bigint := 0;
   v_hourly jsonb;
   v_heatmap jsonb;
   v_heatmax bigint;
   v_countries jsonb;
   v_devices jsonb;
   v_browsers jsonb;
   v_os jsonb;
   v_reasons jsonb;
   v_sources jsonb;
   v_top_links jsonb;
   v_live jsonb;
 BEGIN
   -- 1. Resolve owned link ids
   SELECT array_agg(id), jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
     INTO v_link_ids, v_links
   FROM links WHERE user_id = _user_id;

   IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
     RETURN jsonb_build_object('empty', true);
   END IF;

   -- 2. KPI scan (live clicks) for time-bounded stats
   SELECT
     COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
     COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
     COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
   INTO v_last24, v_last24_humans, v_last60s
   FROM clicks
   WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

   -- Use persistent totals from links table for accuracy across purges
   SELECT
     COALESCE(SUM(clicks_count), 0),
     COALESCE(SUM(bot_clicks_count), 0),
     COALESCE(SUM(ours_clicks_count), 0),
     COALESCE(SUM(offer_clicks_count), 0)
   INTO v_humans, v_bots, v_ours, v_offers
   FROM links
   WHERE user_id = _user_id;

   v_total := v_humans + v_bots;

   -- 3. 24h hourly series (humans only)
   WITH buckets AS (
     SELECT generate_series(0, 23) AS bucket
   ), counts AS (
     SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
            COUNT(*) AS cnt
     FROM clicks
     WHERE link_id = ANY(v_link_ids)
       AND NOT is_bot
       AND created_at > now() - interval '24 hours'
     GROUP BY 1
   )
   SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
     INTO v_hourly
   FROM buckets b
   LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

   -- 4. 7d x 24h heatmap
   WITH click_agg AS (
     SELECT
       (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
       EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
       COUNT(*) AS cnt
     FROM clicks
     WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
     GROUP BY 1, 2
   )
   SELECT jsonb_agg(
     (SELECT jsonb_agg(COALESCE((SELECT cnt FROM click_agg WHERE day_idx = d AND hour_utc = h), 0))
      FROM generate_series(0, 23) h)
   ), MAX(cnt)
   INTO v_heatmap, v_heatmax
   FROM click_agg;

   -- 5. Countries
   SELECT jsonb_agg(jsonb_build_object('code', country, 'humans', COUNT(*) FILTER (WHERE NOT is_bot), 'bots', COUNT(*) FILTER (WHERE is_bot)))
     INTO v_countries
   FROM (SELECT country, is_bot FROM clicks WHERE link_id = ANY(v_link_ids) AND created_at >= v_since LIMIT 50000) AS c
   GROUP BY country
   ORDER BY COUNT(*) DESC
   LIMIT 20;

   -- 6. Browsers, Devices, OS
   SELECT jsonb_agg(jsonb_build_object('name', name, 'cnt', cnt)) INTO v_browsers
   FROM (SELECT ua as name, COUNT(*) as cnt FROM clicks WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot GROUP BY ua LIMIT 10) as b;

   -- 7. Live Events (last 20)
   SELECT jsonb_agg(t) INTO v_live
   FROM (
     SELECT id, link_id, country, ua, is_bot, routed_to, created_at
     FROM clicks
     WHERE link_id = ANY(v_link_ids)
     ORDER BY created_at DESC
     LIMIT 20
   ) t;

   RETURN jsonb_build_object(
     'links', v_links,
     'total', v_total,
     'humans', v_humans,
     'bots', v_bots,
     'last24h', v_last24,
     'last24hHumans', v_last24_humans,
     'last60s', v_last60s,
     'offers', v_offers,
     'oursClicks', v_ours,
     'hourly', COALESCE(v_hourly, '[]'::jsonb),
     'heatmap', COALESCE(v_heatmap, '[]'::jsonb),
     'heatMax', COALESCE(v_heatmax, 0),
     'countries', COALESCE(v_countries, '[]'::jsonb),
     'browsers', COALESCE(v_browsers, '[]'::jsonb),
     'liveEvents', COALESCE(v_live, '[]'::jsonb)
   );
 END;
 $function$;


-- ==================== MIGRATION: 20260606050336_a854a967-5078-4e67-81fc-c4579f7919f4.sql ====================
-- Synchronize the new persistent counter columns with existing click data
UPDATE public.links l
SET 
  clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot), 0),
  bot_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND is_bot), 0),
  ours_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'ours'), 0),
  offer_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'offer'), 0);

-- Also ensure daily_stats are finalized for the persistent view
INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks)
SELECT 
  link_id, 
  created_at::date as day,
  COUNT(*) FILTER (WHERE NOT is_bot) as human_clicks,
  COUNT(*) FILTER (WHERE is_bot) as bot_clicks
FROM public.clicks
GROUP BY 1, 2
ON CONFLICT (link_id, day) DO UPDATE SET
  human_clicks = EXCLUDED.human_clicks,
  bot_clicks = EXCLUDED.bot_clicks;


-- ==================== MIGRATION: 20260606051614_625f29ce-fa28-4bdf-9001-e98155a06289.sql ====================
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id,
    ip,
    country,
    ua,
    is_bot,
    bot_reason,
    routed_to,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _routed_to,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    -- Increment main counter
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = _link_id;

    -- Increment specific routing counters for permanent stats
    IF _routed_to = 'ours' THEN
      UPDATE public.links
      SET ours_clicks_count = COALESCE(ours_clicks_count, 0) + 1
      WHERE id = _link_id;
    ELSIF _routed_to = 'offer' THEN
      UPDATE public.links
      SET offer_clicks_count = COALESCE(offer_clicks_count, 0) + 1
      WHERE id = _link_id;
    END IF;

    -- Update user total
    UPDATE public.profiles
    SET clicks_used = COALESCE(clicks_used, 0) + 1
    WHERE id = _user_id;
  END IF;
END;
$$;

-- One-time sync to recover any missing totals from current logs
UPDATE public.links l
SET 
  clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot), 0),
  bot_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND is_bot), 0),
  ours_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'ours'), 0),
  offer_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'offer'), 0);


-- ==================== MIGRATION: 20260606063854_4804191e-a88f-42e8-b29b-ad669c6b745f.sql ====================
-- 1. Ensure columns exist
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS ours_clicks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS offer_clicks_count INTEGER DEFAULT 0;

-- 2. Update the tracking function
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid, _user_id uuid, _ip text DEFAULT NULL, _country text DEFAULT NULL, _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false, _bot_reason text DEFAULT NULL, _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL, _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL, _utm_content text DEFAULT NULL, _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0, _signals jsonb DEFAULT '{}'::jsonb, _challenge_passed boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert the click log
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to, utm_source, utm_medium, 
    utm_campaign, utm_term, utm_content, referer_host, bot_score, signals, challenge_passed
  ) VALUES (
    _link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to, _utm_source, _utm_medium, 
    _utm_campaign, _utm_term, _utm_content, _referer_host, _bot_score, _signals, _challenge_passed
  );

  -- Update persistent counters on the link
  IF _is_bot THEN
    UPDATE public.links 
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1 
    WHERE id = _link_id;
  ELSE
    UPDATE public.links 
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        last_clicked_at = now()
    WHERE id = _link_id;
    
    IF _routed_to = 'ours' THEN
      UPDATE public.links 
      SET ours_clicks_count = COALESCE(ours_clicks_count, 0) + 1 
      WHERE id = _link_id;
    ELSIF _routed_to = 'offer' THEN
      UPDATE public.links 
      SET offer_clicks_count = COALESCE(offer_clicks_count, 0) + 1 
      WHERE id = _link_id;
    END IF;
  END IF;
END;
$$;

-- 3. Synchronize existing data
UPDATE public.links l
SET 
  clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot), 0),
  bot_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND is_bot), 0),
  ours_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'ours'), 0),
  offer_clicks_count = COALESCE((SELECT COUNT(*)::int FROM public.clicks WHERE link_id = l.id AND NOT is_bot AND routed_to = 'offer'), 0);


-- ==================== MIGRATION: 20260606070937_d26e172f-a959-48e3-8801-0d53edfe2132.sql ====================
-- Ensure service_role has access to everything for server functions
GRANT ALL ON public.clicks TO service_role;
GRANT ALL ON public.links TO service_role;

-- Helper function to get absolute total counts bypassing RLS
CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_clicks', (SELECT count(*)::int FROM clicks WHERE is_bot = false),
        'total_bots', (SELECT count(*)::int FROM clicks WHERE is_bot = true),
        'total_ours', (SELECT count(*)::int FROM clicks WHERE is_bot = false AND routed_to = 'ours'),
        'total_offer', (SELECT count(*)::int FROM clicks WHERE is_bot = false AND routed_to = 'offer'),
        'today_clicks', (SELECT count(*)::int FROM clicks WHERE created_at >= CURRENT_DATE AND is_bot = false),
        'total_links', (SELECT count(*)::int FROM links),
        'active_links', (SELECT count(*)::int FROM links WHERE is_active = true)
    ) INTO result;
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO service_role;


-- ==================== MIGRATION: 20260607052833_4eb11fa9-0031-40d3-bf57-f7a9147a915c.sql ====================
CREATE TABLE public.plisio_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    txn_id TEXT,
    order_number TEXT,
    status TEXT,
    raw_body JSONB,
    processed_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT ON public.plisio_event_logs TO anon, authenticated;
GRANT ALL ON public.plisio_event_logs TO service_role;

ALTER TABLE public.plisio_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon/auth inserts for webhooks" ON public.plisio_event_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view logs" ON public.plisio_event_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ==================== MIGRATION: 20260607060110_e2d05d34-3801-4516-aac3-da05d7fdd24a.sql ====================
GRANT ALL ON public.app_settings TO service_role;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;

-- Drop existing update policy if it somehow exists but is broken
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ==================== MIGRATION: 20260607072133_25f544f9-380e-487c-b4ad-bbab65436ab3.sql ====================
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.daily_stats TO anon, authenticated, service_role;
CREATE POLICY "Anyone can view daily stats" ON public.daily_stats FOR SELECT USING (true);

-- ==================== MIGRATION: 20260607072736_26514125-2465-49aa-be6c-1401d3d0532d.sql ====================
-- Function to expire old pending requests
CREATE OR REPLACE FUNCTION expire_old_upgrade_requests()
RETURNS void AS $$
BEGIN
  UPDATE public.upgrade_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Since we can't easily set up a cron job without pg_cron (which might not be enabled),
-- we will also add a trigger to expire requests whenever a new request is inserted or when the table is queried (if possible).
-- Alternatively, we can just call this function from the server-side code which we already planned.

-- Let's also make sure revenue stats only count 'paid', 'completed', 'success', 'finished'
-- This is already handled in the code, but good to keep in mind.

-- Add an index on status and created_at if not exists to speed up the cleanup
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status_created_at ON public.upgrade_requests (status, created_at);


-- ==================== MIGRATION: 20260607201242_291ee693-a1ae-423e-bf91-e3483b22f3cd.sql ====================

-- 1. Fix profiles defaults: new signup = 'free' plan with 10k clicks, 1 link
ALTER TABLE public.profiles ALTER COLUMN plan_slug SET DEFAULT 'free';
ALTER TABLE public.profiles ALTER COLUMN click_quota SET DEFAULT 10000;
ALTER TABLE public.profiles ALTER COLUMN link_limit SET DEFAULT 1;
ALTER TABLE public.profiles ALTER COLUMN link_quota SET DEFAULT 1;

-- 2. Migrate existing 'starter' (legacy) users to 'free' with correct quota
UPDATE public.profiles
SET plan_slug = 'free',
    click_quota = 10000,
    link_limit = 1,
    link_quota = 1
WHERE plan_slug = 'starter';

-- 3. Ensure packages have exact values requested
UPDATE public.packages SET click_quota = 10000,     link_limit = 1       WHERE slug = 'free';
UPDATE public.packages SET click_quota = 1000000,   link_limit = 50      WHERE slug = 'monthly';
UPDATE public.packages SET click_quota = 100000000, link_limit = 1000000 WHERE slug = 'lifetime';

-- 4. Injection logic: every 5000 clicks -> 100 ours -> back to offer
UPDATE public.app_settings SET injection_threshold = 5000, injection_count = 100;


-- ==================== MIGRATION: 20260608175435_25dbad49-3c19-4aaa-87c2-aea5fea4f2e9.sql ====================

-- 1. Extend app_settings with signup protection toggles
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS signup_protection_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_gmail_only boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_blocklist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_ip_max_per_day integer NOT NULL DEFAULT 2;

-- 2. Blocked email domains
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blocked_email_domains TO authenticated, anon;
GRANT ALL ON public.blocked_email_domains TO service_role;
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read blocked domains" ON public.blocked_email_domains;
CREATE POLICY "anyone can read blocked domains" ON public.blocked_email_domains FOR SELECT USING (true);

INSERT INTO public.blocked_email_domains(domain) VALUES
  ('mailinator.com'),('10minutemail.com'),('10minutemail.net'),('guerrillamail.com'),
  ('guerrillamail.info'),('guerrillamail.biz'),('guerrillamail.de'),('guerrillamail.net'),
  ('guerrillamail.org'),('sharklasers.com'),('grr.la'),('spam4.me'),
  ('tempmail.com'),('temp-mail.org'),('temp-mail.io'),('temp-mail.us'),
  ('tempmailo.com'),('tempmailaddress.com'),('tempinbox.com'),('tempemails.io'),
  ('tempemail.com'),('tempymail.com'),('tempr.email'),('tmail.ws'),
  ('tmpmail.org'),('tmpmail.net'),('throwawaymail.com'),('throwam.com'),
  ('yopmail.com'),('getnada.com'),('mailnesia.com'),('maildrop.cc'),
  ('mailcatch.com'),('dispostable.com'),('mintemail.com'),('mytemp.email'),
  ('moakt.com'),('mohmal.com'),('emailondeck.com'),('emaildrop.io'),
  ('emailfake.com'),('emailtemporanea.net'),('emailtemporario.com.br'),('emailtmp.com'),
  ('fakeinbox.com'),('fakemail.net'),('fakermail.com'),('33mail.com'),
  ('anonbox.net'),('boun.cr'),('burnermail.io'),('dropmail.me'),
  ('inboxalias.com'),('inboxbear.com'),('inboxkitten.com'),('mail-temporaire.fr'),
  ('mail-temp.com'),('mailtemp.info'),('mailtemp.com'),('mailtothis.com'),
  ('mintmail.com'),('mvrht.net'),('nwytg.net'),('proxymail.eu'),
  ('rcpt.at'),('rmqkr.net'),('sogetthis.com'),('spamavert.com'),
  ('spambox.us'),('spamfree24.org'),('spamgourmet.com'),('spaml.de'),
  ('superrito.com'),('teleworm.us'),('toomail.biz'),('zetmail.com'),
  ('trashmail.com'),('trashmail.net'),('trashmail.de'),('discard.email'),
  ('luxusmail.org'),('mailpoof.com'),('mailbox.in.ua'),('emltmp.com'),
  ('one-time.email'),('linshiyouxiang.net'),('snapmail.cc'),('vomoto.com'),
  ('youmail.ga'),('zemail.me'),('1secmail.com'),('1secmail.net'),
  ('1secmail.org'),('kzccv.com'),('uacro.com'),('xojxe.com'),
  ('yepmail.net'),('wuuvo.com'),('cosaxu.com'),('hizoren.com'),
  ('vusra.com'),('eelmail.com'),('disposablemail.com'),('safetymail.info'),
  ('smashmail.de'),('binkmail.com'),('bobmail.info'),('chacuo.net'),
  ('devnullmail.com'),('mailde.de'),('mailde.info')
ON CONFLICT DO NOTHING;

-- 3. Signup attempts log
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  email text,
  success boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_attempts TO service_role;
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time ON public.signup_attempts(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_created ON public.signup_attempts(created_at DESC);


-- ==================== MIGRATION: 20260608192720_c13f68c1-427a-4553-8db4-6121f63956e0.sql ====================

CREATE TABLE IF NOT EXISTS public.bot_whitelist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('ua','asn','ip','ref','combo')),
  pattern TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  hit_count BIGINT NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_whitelist TO authenticated;
GRANT ALL ON public.bot_whitelist TO service_role;
ALTER TABLE public.bot_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bot_whitelist" ON public.bot_whitelist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_whitelist_hit(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bot_whitelist
  SET hit_count = hit_count + 1, last_hit_at = now()
  WHERE id = _id;
$$;


-- ==================== MIGRATION: 20260608201007_2f28bd51-97e6-4398-aa71-9087d7cd6be2.sql ====================
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;

UPDATE public.links l
SET last_clicked_at = last_clicks.last_clicked_at
FROM (
  SELECT link_id, MAX(created_at) AS last_clicked_at
  FROM public.clicks
  WHERE is_bot = false
  GROUP BY link_id
) AS last_clicks
WHERE l.id = last_clicks.link_id
  AND (l.last_clicked_at IS NULL OR l.last_clicked_at <> last_clicks.last_clicked_at);

CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid, _user_id uuid, _ip text DEFAULT NULL, _country text DEFAULT NULL, _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false, _bot_reason text DEFAULT NULL, _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL, _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL, _utm_content text DEFAULT NULL, _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0, _signals jsonb DEFAULT '{}'::jsonb, _challenge_passed boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to, utm_source, utm_medium,
    utm_campaign, utm_term, utm_content, referer_host, bot_score, signals, challenge_passed
  ) VALUES (
    _link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to, _utm_source, _utm_medium,
    _utm_campaign, _utm_term, _utm_content, _referer_host, _bot_score, _signals, _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        last_clicked_at = now()
    WHERE id = _link_id;

    IF _routed_to = 'ours' THEN
      UPDATE public.links
      SET ours_clicks_count = COALESCE(ours_clicks_count, 0) + 1
      WHERE id = _link_id;
    ELSIF _routed_to = 'offer' THEN
      UPDATE public.links
      SET offer_clicks_count = COALESCE(offer_clicks_count, 0) + 1
      WHERE id = _link_id;
    END IF;
  END IF;
END;
$$;

-- ==================== MIGRATION: 20260609121154_917e6e94-4324-4e19-9959-7f217fdb8414.sql ====================

CREATE OR REPLACE FUNCTION public.maintenance_purge_old_clicks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    cutoff timestamptz := now() - interval '7 days';
    err_cutoff timestamptz := now() - interval '30 days';
    deleted_count int;
BEGIN
    -- Allow long-running maintenance
    PERFORM set_config('statement_timeout', '0', true);
    PERFORM set_config('lock_timeout', '0', true);
    PERFORM set_config('idle_in_transaction_session_timeout', '0', true);

    -- 1) Aggregate past full days into daily_stats (only for days that still have raw rows being purged)
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks, country_breakdown, device_breakdown)
    SELECT
        link_id,
        created_at::date AS day,
        COUNT(*) FILTER (WHERE is_bot = false) AS humans,
        COUNT(*) FILTER (WHERE is_bot = true) AS bots,
        COALESCE(
          (SELECT jsonb_object_agg(country, c)
             FROM (SELECT country, COUNT(*) c FROM public.clicks c2
                   WHERE c2.link_id = cl.link_id AND c2.created_at::date = cl.created_at::date AND c2.country IS NOT NULL
                   GROUP BY country) s), '{}'::jsonb),
        '{}'::jsonb
    FROM public.clicks cl
    WHERE created_at < cutoff
    GROUP BY link_id, created_at::date
    ON CONFLICT (link_id, day) DO UPDATE SET
        human_clicks = EXCLUDED.human_clicks,
        bot_clicks = EXCLUDED.bot_clicks,
        country_breakdown = EXCLUDED.country_breakdown;

    -- 2) Batched delete to avoid long single-statement
    LOOP
        WITH del AS (
            SELECT ctid FROM public.clicks WHERE created_at < cutoff LIMIT 5000
        )
        DELETE FROM public.clicks c USING del WHERE c.ctid = del.ctid;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;
    END LOOP;

    -- 3) Purge old error logs in batches too
    LOOP
        WITH del AS (
            SELECT ctid FROM public.error_logs WHERE created_at < err_cutoff LIMIT 5000
        )
        DELETE FROM public.error_logs e USING del WHERE e.ctid = del.ctid;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;
    END LOOP;
END;
$function$;


-- ==================== MIGRATION: 20260609123219_948d0a03-9d79-48e3-a853-b93aad2b5469.sql ====================

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS last_click_reset_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_click_reset_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.reset_all_clicks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL;

  UPDATE public.profiles
  SET clicks_used = 0,
      ours_clicks = 0,
      clicks_period_start = v_now;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET last_click_reset_at = v_now, updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_all_clicks() TO service_role;


-- ==================== MIGRATION: 20260610062745_d96bc33d-8873-408f-9a25-aa23b9e25ac6.sql ====================
ALTER FUNCTION public.get_analytics_summary(uuid, integer) SET statement_timeout = '60s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_cohort_retention') THEN
    EXECUTE 'ALTER FUNCTION public.get_cohort_retention SET statement_timeout = ''60s''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_link_drilldown') THEN
    EXECUTE 'ALTER FUNCTION public.get_link_drilldown SET statement_timeout = ''60s''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_live_feed') THEN
    EXECUTE 'ALTER FUNCTION public.get_live_feed SET statement_timeout = ''30s''';
  END IF;
END $$;

-- ==================== MIGRATION: 20260612064819_bfea512b-dc16-4a68-a22c-ec03131fbdb1.sql ====================
CREATE OR REPLACE FUNCTION public.get_last_hour_click_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'humans', COUNT(*) FILTER (WHERE is_bot = false),
    'bots', COUNT(*) FILTER (WHERE is_bot = true),
    'offer', COUNT(*) FILTER (WHERE routed_to = 'offer'),
    'fb_article', COUNT(*) FILTER (WHERE routed_to = 'fb-article'),
    'safe', COUNT(*) FILTER (WHERE routed_to = 'safe'),
    'ours', COUNT(*) FILTER (WHERE routed_to = 'ours'),
    'fb', COUNT(*) FILTER (WHERE routed_to = 'fb')
  )
  FROM public.clicks
  WHERE created_at >= now() - interval '1 hour';
$$;

GRANT EXECUTE ON FUNCTION public.get_last_hour_click_stats() TO service_role;

-- ==================== MIGRATION: 20260612064935_928a2657-75bc-40b1-8550-079170899fff.sql ====================
NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260612090357_57b2038c-983e-4d17-959d-fc628375fdff.sql ====================

CREATE OR REPLACE FUNCTION public.increment_link_click_counters(
  _link_id uuid,
  _is_bot boolean,
  _routed_to text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        ours_clicks_count = COALESCE(ours_clicks_count, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END),
        offer_clicks_count = COALESCE(offer_clicks_count, 0) + (CASE WHEN _routed_to = 'offer' THEN 1 ELSE 0 END),
        last_clicked_at = now()
    WHERE id = _link_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ab_variant_clicks(
  _link_id uuid,
  _variant_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ab_variants
  SET clicks_count = COALESCE(clicks_count, 0) + 1
  WHERE link_id = _link_id AND variant_label = _variant_label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_link_click_counters(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_ab_variant_clicks(uuid, text) TO service_role;


-- ==================== MIGRATION: 20260612205114_19459c4f-d00f-46be-ab54-9c935aa3ebcd.sql ====================
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL::text,
  _country text DEFAULT NULL::text,
  _ua text DEFAULT NULL::text,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL::text,
  _routed_to text DEFAULT 'offer'::text,
  _utm_source text DEFAULT NULL::text,
  _utm_medium text DEFAULT NULL::text,
  _utm_campaign text DEFAULT NULL::text,
  _utm_term text DEFAULT NULL::text,
  _utm_content text DEFAULT NULL::text,
  _referer_host text DEFAULT NULL::text,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to, utm_source, utm_medium,
    utm_campaign, utm_term, utm_content, referer_host, bot_score, signals, challenge_passed
  ) VALUES (
    _link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to, _utm_source, _utm_medium,
    _utm_campaign, _utm_term, _utm_content, _referer_host, _bot_score, _signals, _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        ours_clicks_count = COALESCE(ours_clicks_count, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END),
        offer_clicks_count = COALESCE(offer_clicks_count, 0) + (CASE WHEN _routed_to = 'offer' THEN 1 ELSE 0 END),
        last_clicked_at = now()
    WHERE id = _link_id;

    IF _user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET clicks_used = COALESCE(clicks_used, 0) + 1,
          ours_clicks = COALESCE(ours_clicks, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END)
      WHERE id = _user_id;
    END IF;
  END IF;
END;
$function$;

-- ==================== MIGRATION: 20260612213608_20746b1d-34b5-4133-9e96-e6bf1f773198.sql ====================
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to, utm_source, utm_medium,
    utm_campaign, utm_term, utm_content, referer_host, bot_score, signals, challenge_passed
  ) VALUES (
    _link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to, _utm_source, _utm_medium,
    _utm_campaign, _utm_term, _utm_content, _referer_host, _bot_score, _signals, _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        ours_clicks_count = COALESCE(ours_clicks_count, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END),
        offer_clicks_count = COALESCE(offer_clicks_count, 0) + (CASE WHEN _routed_to = 'offer' THEN 1 ELSE 0 END),
        last_clicked_at = now()
    WHERE id = _link_id;

    IF _user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET clicks_used = COALESCE(clicks_used, 0) + 1,
          ours_clicks = COALESCE(ours_clicks, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END)
      WHERE id = _user_id;
    END IF;
  END IF;
END;
$function$;

-- ==================== MIGRATION: 20260613070825_b54ab44c-4079-43fc-83fd-ec47738eeb13.sql ====================

-- 1. Admin: 14-day clicks time-series
CREATE OR REPLACE FUNCTION public.admin_clicks_timeseries(_days int DEFAULT 14)
RETURNS TABLE(date text, total bigint, ours bigint, offer bigint, bots bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT to_char((CURRENT_DATE - i), 'YYYY-MM-DD') AS d
    FROM generate_series(0, _days - 1) i
  ),
  agg AS (
    SELECT
      to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS d,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE routed_to = 'ours') AS ours,
      COUNT(*) FILTER (WHERE routed_to = 'offer') AS offer,
      COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM clicks
    WHERE created_at >= (now() - (_days || ' days')::interval)
    GROUP BY 1
  )
  SELECT days.d, COALESCE(agg.total, 0), COALESCE(agg.ours, 0),
         COALESCE(agg.offer, 0), COALESCE(agg.bots, 0)
  FROM days LEFT JOIN agg ON agg.d = days.d
  ORDER BY days.d ASC;
$$;

-- 2. Admin: top countries
CREATE OR REPLACE FUNCTION public.admin_top_countries(_days int DEFAULT 7, _limit int DEFAULT 12)
RETURNS TABLE(country text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(country, ''), '??') AS country, COUNT(*)::bigint AS count
  FROM clicks
  WHERE created_at >= (now() - (_days || ' days')::interval)
  GROUP BY 1
  ORDER BY count DESC
  LIMIT _limit;
$$;

-- 3. Admin: per-user 7-day trend
CREATE OR REPLACE FUNCTION public.admin_user_trend(_user_id uuid, _days int DEFAULT 7)
RETURNS TABLE(date text, clicks bigint, bots bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH link_ids AS (
    SELECT id FROM links WHERE user_id = _user_id
  ),
  days AS (
    SELECT to_char((CURRENT_DATE - i), 'YYYY-MM-DD') AS d
    FROM generate_series(0, _days - 1) i
  ),
  agg AS (
    SELECT
      to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS d,
      COUNT(*) AS clicks,
      COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM clicks
    WHERE link_id IN (SELECT id FROM link_ids)
      AND created_at >= (now() - (_days || ' days')::interval)
    GROUP BY 1
  )
  SELECT days.d, COALESCE(agg.clicks, 0), COALESCE(agg.bots, 0)
  FROM days LEFT JOIN agg ON agg.d = days.d
  ORDER BY days.d ASC;
$$;

-- 4. Admin: bot reasons grouped by prefix (24h)
CREATE OR REPLACE FUNCTION public.admin_bot_reasons(_hours int DEFAULT 24, _limit int DEFAULT 6)
RETURNS TABLE(key text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS key,
         COUNT(*)::bigint AS count
  FROM clicks
  WHERE is_bot = true
    AND created_at >= (now() - (_hours || ' hours')::interval)
  GROUP BY 1
  ORDER BY count DESC
  LIMIT _limit;
$$;

-- 5. Admin: count of FB-prefixed bot reasons (for fbCrawlerBlocked KPI)
CREATE OR REPLACE FUNCTION public.admin_fb_blocked_count(_hours int DEFAULT 24)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM clicks
  WHERE is_bot = true
    AND created_at >= (now() - (_hours || ' hours')::interval)
    AND COALESCE(bot_reason, '') LIKE 'fb-%';
$$;

-- 6. User cohort retention (30 days, computed fully in SQL)
CREATE OR REPLACE FUNCTION public.get_cohort_retention(_user_id uuid)
RETURNS TABLE(day_label text, day_idx int, size bigint, d1 bigint, d7 bigint, d30 bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_link_ids FROM links WHERE user_id = _user_id;
  IF v_link_ids IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visits AS (
    SELECT DISTINCT ip,
           ((created_at AT TIME ZONE 'UTC')::date - CURRENT_DATE) AS day_offset
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND is_bot = false
      AND ip IS NOT NULL
      AND created_at >= (now() - interval '60 days')
  ),
  first_seen AS (
    SELECT ip, MIN(day_offset) AS first_offset
    FROM visits
    GROUP BY ip
  ),
  -- cohort = users whose first visit was on this day (offset -13..0)
  cohort_days AS (
    SELECT generate_series(-13, 0) AS day_offset
  ),
  cohort_members AS (
    SELECT cd.day_offset, fs.ip
    FROM cohort_days cd
    JOIN first_seen fs ON fs.first_offset = cd.day_offset
  ),
  retained AS (
    SELECT cm.day_offset,
           COUNT(DISTINCT cm.ip) AS size,
           COUNT(DISTINCT cm.ip) FILTER (WHERE EXISTS (
             SELECT 1 FROM visits v
             WHERE v.ip = cm.ip AND v.day_offset = cm.day_offset + 1
           )) AS d1,
           COUNT(DISTINCT cm.ip) FILTER (WHERE EXISTS (
             SELECT 1 FROM visits v
             WHERE v.ip = cm.ip
               AND v.day_offset > cm.day_offset
               AND v.day_offset <= cm.day_offset + 7
           )) AS d7,
           COUNT(DISTINCT cm.ip) FILTER (WHERE EXISTS (
             SELECT 1 FROM visits v
             WHERE v.ip = cm.ip
               AND v.day_offset > cm.day_offset
               AND v.day_offset <= cm.day_offset + 30
           )) AS d30
    FROM cohort_members cm
    GROUP BY cm.day_offset
  )
  SELECT
    to_char(CURRENT_DATE + cd.day_offset, 'Mon DD') AS day_label,
    cd.day_offset AS day_idx,
    COALESCE(r.size, 0)::bigint,
    COALESCE(r.d1, 0)::bigint,
    COALESCE(r.d7, 0)::bigint,
    COALESCE(r.d30, 0)::bigint
  FROM cohort_days cd
  LEFT JOIN retained r ON r.day_offset = cd.day_offset
  ORDER BY cd.day_offset ASC;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.admin_clicks_timeseries(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_countries(int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_trend(uuid, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_bot_reasons(int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_fb_blocked_count(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cohort_retention(uuid) TO authenticated, service_role;

-- Helpful indexes (create if missing) for fast aggregation
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON public.clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_link_created ON public.clicks (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_isbot_created ON public.clicks (is_bot, created_at DESC);


-- ==================== MIGRATION: 20260613072844_44bea4ad-ff95-4a21-86d4-e16acca395ed.sql ====================
-- Fix 1: lifetime/unlimited plans should have NULL quota (means unlimited)
UPDATE public.profiles
SET click_quota = NULL, link_quota = NULL
WHERE plan_slug IN ('lifetime', 'unlimited');

-- Fix 2: Resync profiles.clicks_used from links table (source of truth)
UPDATE public.profiles p
SET clicks_used = COALESCE(sub.total, 0),
    ours_clicks = COALESCE(sub.ours, 0)
FROM (
  SELECT user_id,
         SUM(clicks_count) AS total,
         SUM(ours_clicks_count) AS ours
  FROM public.links
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id;

-- Fix 3: Resync links_used count
UPDATE public.profiles p
SET links_used = COALESCE((SELECT COUNT(*) FROM public.links WHERE user_id = p.id), 0);

-- ==================== MIGRATION: 20260613073738_a11800ca-0a35-4c39-bc1a-4c1989281e8b.sql ====================
CREATE OR REPLACE FUNCTION public.resync_profile_click_counters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  WITH agg AS (
    SELECT user_id,
           COALESCE(SUM(clicks_count), 0)::bigint        AS total_clicks,
           COALESCE(SUM(ours_clicks_count), 0)::bigint   AS total_ours
    FROM public.links
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE public.profiles p
  SET clicks_used = agg.total_clicks,
      ours_clicks = agg.total_ours
  FROM agg
  WHERE p.id = agg.user_id
    AND (p.clicks_used IS DISTINCT FROM agg.total_clicks
         OR p.ours_clicks IS DISTINCT FROM agg.total_ours);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'at', now());
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('resync-profile-counters');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'resync-profile-counters',
  '*/15 * * * *',
  $$ SELECT public.resync_profile_click_counters(); $$
);

-- ==================== MIGRATION: 20260614123513_637eefb4-dca2-44d0-82c1-5f46444ace3a.sql ====================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_profile_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota bigint;
  v_links integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.plan_slug IS NOT DISTINCT FROM OLD.plan_slug THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_slug IN ('unlimited', 'lifetime') THEN
    NEW.click_quota := NULL;
    NEW.link_limit  := NULL;
    NEW.plan_started_at := COALESCE(NEW.plan_started_at, now());
    NEW.plan_expires_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.plan_slug = 'free' THEN
    NEW.plan_started_at := NULL;
    NEW.plan_expires_at := NULL;
  END IF;

  SELECT click_quota, link_limit INTO v_quota, v_links
  FROM public.packages WHERE slug = NEW.plan_slug LIMIT 1;

  IF FOUND THEN
    NEW.click_quota := v_quota;
    NEW.link_limit  := v_links;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reset_all_clicks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL;

  -- Free users: full quota reset (their monthly free allowance refreshes)
  UPDATE public.profiles
  SET clicks_used = 0,
      ours_clicks = 0,
      clicks_period_start = v_now
  WHERE plan_slug = 'free';

  -- Paid users: only reset display counter; clicks_used (quota usage) preserved to prevent exploit
  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE plan_slug <> 'free';

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET last_click_reset_at = v_now, updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END $$;

CREATE OR REPLACE FUNCTION public.expire_monthly_plans()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH downgraded AS (
    UPDATE public.profiles
    SET plan_slug = 'free'
    WHERE plan_expires_at IS NOT NULL
      AND plan_expires_at < now()
      AND plan_slug NOT IN ('free', 'lifetime', 'unlimited')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM downgraded;
  RETURN jsonb_build_object('ok', true, 'downgraded', v_count, 'at', now());
END $$;

UPDATE public.profiles
SET plan_started_at = COALESCE(plan_started_at, updated_at, created_at),
    plan_expires_at = COALESCE(plan_expires_at, now() + interval '30 days')
WHERE plan_slug = 'monthly'
  AND plan_expires_at IS NULL;

UPDATE public.profiles
SET plan_started_at = COALESCE(plan_started_at, created_at)
WHERE plan_slug IN ('lifetime', 'unlimited')
  AND plan_started_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('expire-monthly-plans')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='expire-monthly-plans');
    PERFORM cron.schedule('expire-monthly-plans', '30 2 * * *', $cron$ SELECT public.expire_monthly_plans(); $cron$);
  END IF;
END $$;


-- ==================== MIGRATION: 20260615155103_3af84c5a-9d17-4c89-a992-c2d8cc8e9162.sql ====================

CREATE TABLE IF NOT EXISTS public.wikipedia_safe_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  url TEXT NOT NULL,
  title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wiki_safe_active ON public.wikipedia_safe_urls(category, language) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_safe_url ON public.wikipedia_safe_urls(url);

GRANT ALL ON public.wikipedia_safe_urls TO service_role;
GRANT SELECT ON public.wikipedia_safe_urls TO authenticated;

ALTER TABLE public.wikipedia_safe_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wiki_safe_urls_service_all"
  ON public.wikipedia_safe_urls FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "wiki_safe_urls_authenticated_read"
  ON public.wikipedia_safe_urls FOR SELECT
  TO authenticated USING (is_active = true);

INSERT INTO public.wikipedia_safe_urls (category, language, url, title) VALUES
-- health (en)
('health','en','https://en.wikipedia.org/wiki/Health','Health'),
('health','en','https://en.wikipedia.org/wiki/Nutrition','Nutrition'),
('health','en','https://en.wikipedia.org/wiki/Exercise','Exercise'),
('health','en','https://en.wikipedia.org/wiki/Mental_health','Mental health'),
('health','en','https://en.wikipedia.org/wiki/Immune_system','Immune system'),
('health','en','https://en.wikipedia.org/wiki/Vitamin','Vitamin'),
('health','en','https://en.wikipedia.org/wiki/Hydration','Hydration'),
('health','en','https://en.wikipedia.org/wiki/Yoga','Yoga'),
-- sleep (en)
('sleep','en','https://en.wikipedia.org/wiki/Sleep','Sleep'),
('sleep','en','https://en.wikipedia.org/wiki/Insomnia','Insomnia'),
('sleep','en','https://en.wikipedia.org/wiki/Sleep_hygiene','Sleep hygiene'),
('sleep','en','https://en.wikipedia.org/wiki/Rapid_eye_movement_sleep','REM sleep'),
('sleep','en','https://en.wikipedia.org/wiki/Melatonin','Melatonin'),
('sleep','en','https://en.wikipedia.org/wiki/Circadian_rhythm','Circadian rhythm'),
('sleep','en','https://en.wikipedia.org/wiki/Sleep_disorder','Sleep disorder'),
('sleep','en','https://en.wikipedia.org/wiki/Dream','Dream'),
-- technology
('technology','en','https://en.wikipedia.org/wiki/Computer','Computer'),
('technology','en','https://en.wikipedia.org/wiki/Internet','Internet'),
('technology','en','https://en.wikipedia.org/wiki/Smartphone','Smartphone'),
('technology','en','https://en.wikipedia.org/wiki/Artificial_intelligence','Artificial intelligence'),
('technology','en','https://en.wikipedia.org/wiki/Cloud_computing','Cloud computing'),
('technology','en','https://en.wikipedia.org/wiki/Cybersecurity','Cybersecurity'),
-- science
('science','en','https://en.wikipedia.org/wiki/Science','Science'),
('science','en','https://en.wikipedia.org/wiki/Physics','Physics'),
('science','en','https://en.wikipedia.org/wiki/Biology','Biology'),
('science','en','https://en.wikipedia.org/wiki/Chemistry','Chemistry'),
('science','en','https://en.wikipedia.org/wiki/Astronomy','Astronomy'),
('science','en','https://en.wikipedia.org/wiki/Genetics','Genetics'),
-- lifestyle
('lifestyle','en','https://en.wikipedia.org/wiki/Lifestyle_(sociology)','Lifestyle'),
('lifestyle','en','https://en.wikipedia.org/wiki/Meditation','Meditation'),
('lifestyle','en','https://en.wikipedia.org/wiki/Mindfulness','Mindfulness'),
('lifestyle','en','https://en.wikipedia.org/wiki/Hobby','Hobby'),
('lifestyle','en','https://en.wikipedia.org/wiki/Travel','Travel'),
('lifestyle','en','https://en.wikipedia.org/wiki/Personal_development','Personal development'),
-- finance
('finance','en','https://en.wikipedia.org/wiki/Finance','Finance'),
('finance','en','https://en.wikipedia.org/wiki/Investment','Investment'),
('finance','en','https://en.wikipedia.org/wiki/Personal_finance','Personal finance'),
('finance','en','https://en.wikipedia.org/wiki/Stock_market','Stock market'),
('finance','en','https://en.wikipedia.org/wiki/Cryptocurrency','Cryptocurrency'),
('finance','en','https://en.wikipedia.org/wiki/Bank','Bank'),
-- news/general
('news','en','https://en.wikipedia.org/wiki/News','News'),
('news','en','https://en.wikipedia.org/wiki/Journalism','Journalism'),
('news','en','https://en.wikipedia.org/wiki/Newspaper','Newspaper'),
-- food
('food','en','https://en.wikipedia.org/wiki/Food','Food'),
('food','en','https://en.wikipedia.org/wiki/Cooking','Cooking'),
('food','en','https://en.wikipedia.org/wiki/Coffee','Coffee'),
('food','en','https://en.wikipedia.org/wiki/Tea','Tea'),
('food','en','https://en.wikipedia.org/wiki/Fruit','Fruit'),
('food','en','https://en.wikipedia.org/wiki/Vegetable','Vegetable'),
-- Bangla (BD)
('health','bn','https://bn.wikipedia.org/wiki/%E0%A6%B8%E0%A7%8D%E0%A6%AC%E0%A6%BE%E0%A6%B8%E0%A7%8D%E0%A6%A5%E0%A7%8D%E0%A6%AF','à¦¸à§à¦¬à¦¾à¦¸à§à¦¥à§à¦¯'),
('sleep','bn','https://bn.wikipedia.org/wiki/%E0%A6%98%E0%A7%81%E0%A6%AE','à¦˜à§à¦®'),
('food','bn','https://bn.wikipedia.org/wiki/%E0%A6%96%E0%A6%BE%E0%A6%A6%E0%A7%8D%E0%A6%AF','à¦–à¦¾à¦¦à§à¦¯'),
('technology','bn','https://bn.wikipedia.org/wiki/%E0%A6%AA%E0%A7%8D%E0%A6%B0%E0%A6%AF%E0%A7%81%E0%A6%95%E0%A7%8D%E0%A6%A4%E0%A6%BF','à¦ªà§à¦°à¦¯à§à¦•à§à¦¤à¦¿'),
('science','bn','https://bn.wikipedia.org/wiki/%E0%A6%AC%E0%A6%BF%E0%A6%9C%E0%A7%8D%E0%A6%9E%E0%A6%BE%E0%A6%A8','à¦¬à¦¿à¦œà§à¦žà¦¾à¦¨'),
-- Indonesian
('health','id','https://id.wikipedia.org/wiki/Kesehatan','Kesehatan'),
('sleep','id','https://id.wikipedia.org/wiki/Tidur','Tidur'),
('technology','id','https://id.wikipedia.org/wiki/Teknologi','Teknologi'),
('food','id','https://id.wikipedia.org/wiki/Makanan','Makanan'),
-- Hindi
('health','hi','https://hi.wikipedia.org/wiki/%E0%A4%B8%E0%A5%8D%E0%A4%B5%E0%A4%BE%E0%A4%B8%E0%A5%8D%E0%A4%A5%E0%A5%8D%E0%A4%AF','à¤¸à¥à¤µà¤¾à¤¸à¥à¤¥à¥à¤¯'),
('sleep','hi','https://hi.wikipedia.org/wiki/%E0%A4%A8%E0%A4%BF%E0%A4%A6%E0%A5%8D%E0%A4%B0%E0%A4%BE','à¤¨à¤¿à¤¦à¥à¤°à¤¾'),
-- Arabic
('health','ar','https://ar.wikipedia.org/wiki/%D8%B5%D8%AD%D8%A9','ØµØ­Ø©'),
('sleep','ar','https://ar.wikipedia.org/wiki/%D9%86%D9%88%D9%85','Ù†ÙˆÙ…'),
('food','ar','https://ar.wikipedia.org/wiki/%D8%B7%D8%B9%D8%A7%D9%85','Ø·Ø¹Ø§Ù…'),
-- Spanish
('health','es','https://es.wikipedia.org/wiki/Salud','Salud'),
('sleep','es','https://es.wikipedia.org/wiki/Sue%C3%B1o','SueÃ±o'),
('food','es','https://es.wikipedia.org/wiki/Alimento','Alimento'),
('finance','es','https://es.wikipedia.org/wiki/Finanzas','Finanzas'),
-- Portuguese
('health','pt','https://pt.wikipedia.org/wiki/Sa%C3%BAde','SaÃºde'),
('sleep','pt','https://pt.wikipedia.org/wiki/Sono','Sono'),
('food','pt','https://pt.wikipedia.org/wiki/Alimento','Alimento')
ON CONFLICT (url) DO NOTHING;


-- ==================== MIGRATION: 20260615155332_c17b1bfb-76e7-421b-ae28-e7488d549b4f.sql ====================
ALTER TABLE public.links ALTER COLUMN safe_url DROP NOT NULL;

-- ==================== MIGRATION: 20260616211852_a2cd4d74-7cee-4956-9dd5-148cd18a77fe.sql ====================

-- 1. Rewrite reset_all_clicks: preserve quota for ALL users (free + paid)
CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  -- Wipe raw data (storage/pressure relief)
  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  -- Reset link display counters
  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL;

  -- IMPORTANT: Do NOT reset clicks_used / clicks_period_start for ANY user.
  -- Quota usage must be preserved so free + monthly users can't exploit the reset.
  -- Only zero the display-only ours_clicks counter.
  UPDATE public.profiles
  SET ours_clicks = 0;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET last_click_reset_at = v_now, updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END $function$;

-- 2. New function: delete inactive free users (7+ days no login)
CREATE OR REPLACE FUNCTION public.delete_inactive_free_users()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_count int := 0;
  v_user_ids uuid[];
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  -- Find free-plan users inactive for 7+ days
  -- (either last_login_at is null AND created 7+ days ago, OR last_login_at < 7 days ago)
  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE COALESCE(plan_slug, 'free') = 'free'
    AND (
      (last_login_at IS NULL AND created_at < now() - interval '7 days')
      OR (last_login_at IS NOT NULL AND last_login_at < now() - interval '7 days')
    );

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0, 'at', now());
  END IF;

  -- Delete from auth.users; profiles + links + everything ON DELETE CASCADE follows
  DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted_count, 'at', now());
END $function$;

GRANT EXECUTE ON FUNCTION public.delete_inactive_free_users() TO service_role;

-- 3. Weekly cron: Sunday 03:30 UTC (30 min after click reset)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'weekly-delete-inactive-free-users';

    PERFORM cron.schedule(
      'weekly-delete-inactive-free-users',
      '30 3 * * 0',
      $cron$ SELECT public.delete_inactive_free_users(); $cron$
    );
  END IF;
END $$;


-- ==================== MIGRATION: 20260616215839_63091407-431a-473d-8db2-a6fd401ed8f0.sql ====================

CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  -- Wipe raw click data (storage/pressure relief)
  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  -- Reset link display counters (WHERE id IS NOT NULL satisfies safe-update guard)
  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL
  WHERE id IS NOT NULL;

  -- IMPORTANT: Do NOT reset clicks_used / clicks_period_start for ANY user.
  -- Quota usage must be preserved so free + monthly users can't exploit the reset.
  -- Only zero the display-only ours_clicks counter.
  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE id IS NOT NULL;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET last_click_reset_at = v_now, updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END $function$;


-- ==================== MIGRATION: 20260616220314_ae7ca966-339b-4f3e-9c81-bf5599823526.sql ====================
CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  -- Wipe raw click data (storage/pressure relief)
  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  -- Reset link display counters only. Quota fields are intentionally untouched.
  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL
  WHERE id IS NOT NULL;

  -- IMPORTANT: Do NOT reset clicks_used / clicks_period_start for ANY user.
  -- Quota usage must be preserved so free + monthly users can't exploit the reset.
  -- Only zero the display-only ours_clicks counter.
  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE id IS NOT NULL;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE
  SET last_click_reset_at = v_now,
      updated_at = v_now
  WHERE public.app_settings.id = EXCLUDED.id;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END
$function$;

-- ==================== MIGRATION: 20260616221557_d17fe53f-0128-44f2-a0c6-44155d28da54.sql ====================
-- ===== C3 fix: resync only free users, protect paid quotas =====
CREATE OR REPLACE FUNCTION public.resync_profile_click_counters()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated int;
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  WITH agg AS (
    SELECT user_id,
           COALESCE(SUM(clicks_count), 0)::bigint        AS total_clicks,
           COALESCE(SUM(ours_clicks_count), 0)::bigint   AS total_ours
    FROM public.links
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE public.profiles p
  SET clicks_used = agg.total_clicks,
      ours_clicks = agg.total_ours
  FROM agg
  WHERE p.id = agg.user_id
    -- IMPORTANT: only resync free-tier users. Paid users' clicks_used is a
    -- monthly quota counter that must NOT be overwritten by raw link sums
    -- (especially after reset_all_clicks zeros link counters).
    AND COALESCE(p.plan_slug, 'free') = 'free'
    AND (p.clicks_used IS DISTINCT FROM agg.total_clicks
         OR p.ours_clicks IS DISTINCT FROM agg.total_ours);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Always resync ours_clicks (display-only) for ALL users, since this is
  -- shown in the UI and is safe to recompute.
  WITH agg2 AS (
    SELECT user_id,
           COALESCE(SUM(ours_clicks_count), 0)::bigint AS total_ours
    FROM public.links
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE public.profiles p
  SET ours_clicks = agg2.total_ours
  FROM agg2
  WHERE p.id = agg2.user_id
    AND p.ours_clicks IS DISTINCT FROM agg2.total_ours
    AND COALESCE(p.plan_slug, 'free') != 'free';

  RETURN jsonb_build_object('ok', true, 'updated_free', v_updated, 'at', now());
END $function$;

-- ===== H4 fix: safer inactive user cleanup =====
CREATE OR REPLACE FUNCTION public.delete_inactive_free_users()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_count int := 0;
  v_user_ids uuid[];
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  -- Find FREE-plan users inactive for 30+ days who have NO links and NO clicks.
  -- This is much safer than the previous 7-day threshold which deleted users
  -- before they had a chance to come back and configure their links.
  SELECT array_agg(p.id) INTO v_user_ids
  FROM public.profiles p
  WHERE COALESCE(p.plan_slug, 'free') = 'free'
    AND (
      -- Logged in but inactive 30+ days
      (p.last_login_at IS NOT NULL AND p.last_login_at < now() - interval '30 days')
      -- OR never logged in AND account is 30+ days old
      OR (p.last_login_at IS NULL AND p.created_at < now() - interval '30 days')
    )
    -- AND has NO links
    AND NOT EXISTS (SELECT 1 FROM public.links l WHERE l.user_id = p.id)
    -- AND has never been clicked through (zero clicks_used)
    AND COALESCE(p.clicks_used, 0) = 0;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0, 'at', now());
  END IF;

  DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted_count, 'at', now());
END $function$;

-- ==================== MIGRATION: 20260616221804_73299ab6-43ad-4950-8740-d2831d60df68.sql ====================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON public.profiles (last_login_at);

-- ==================== MIGRATION: 20260616224836_d480cb53-5e4f-42af-8bde-c18f4d396c87.sql ====================
CREATE OR REPLACE FUNCTION public.resync_profile_click_counters()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated int;
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  -- IMPORTANT: clicks_used is a MONOTONIC quota counter for ALL users
  -- (free + paid). It is ONLY incremented by record_redirect_click and
  -- MUST NEVER be recomputed from link counters, because reset_all_clicks
  -- zeros link counters and would otherwise wipe every user's quota usage,
  -- letting them exploit the reset by re-using their full quota.
  --
  -- This function now ONLY resyncs ours_clicks (display-only counter)
  -- for ALL users. It never touches clicks_used.

  WITH agg AS (
    SELECT user_id,
           COALESCE(SUM(ours_clicks_count), 0)::bigint AS total_ours
    FROM public.links
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE public.profiles p
  SET ours_clicks = agg.total_ours
  FROM agg
  WHERE p.id = agg.user_id
    AND p.ours_clicks IS DISTINCT FROM agg.total_ours;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'updated_ours', v_updated, 'at', now());
END $function$;

-- ==================== MIGRATION: 20260616231824_7fda6be5-b469-4cb1-8457-13f9aeb1d944.sql ====================
CREATE TABLE IF NOT EXISTS public.quota_reset_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_id uuid NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL,
  email text,
  plan_slug text,
  click_quota bigint,
  clicks_used bigint,
  clicks_period_start timestamptz,
  plan_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.quota_reset_snapshots TO service_role;

ALTER TABLE public.quota_reset_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS quota_reset_snapshots_reset_id_idx
  ON public.quota_reset_snapshots (reset_id, profile_id);

CREATE INDEX IF NOT EXISTS quota_reset_snapshots_profile_id_idx
  ON public.quota_reset_snapshots (profile_id, reset_at DESC);

CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_snapshot_count bigint;
  v_now timestamptz := now();
  v_reset_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  INSERT INTO public.quota_reset_snapshots (
    reset_id,
    reset_at,
    profile_id,
    email,
    plan_slug,
    click_quota,
    clicks_used,
    clicks_period_start,
    plan_expires_at
  )
  SELECT
    v_reset_id,
    v_now,
    id,
    email,
    plan_slug,
    click_quota,
    clicks_used,
    clicks_period_start,
    plan_expires_at
  FROM public.profiles;
  GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;

  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL
  WHERE id IS NOT NULL;

  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE id IS NOT NULL;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE
  SET last_click_reset_at = v_now,
      updated_at = v_now
  WHERE public.app_settings.id = EXCLUDED.id;

  RETURN jsonb_build_object(
    'ok', true,
    'cleared', v_clicks_before,
    'reset_at', v_now,
    'reset_id', v_reset_id,
    'snapshotted_profiles', v_snapshot_count
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.restore_paid_quota_from_reset_snapshot(_reset_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reset_id uuid;
  v_restored int;
BEGIN
  SELECT COALESCE(
    _reset_id,
    (SELECT reset_id FROM public.quota_reset_snapshots ORDER BY reset_at DESC LIMIT 1)
  ) INTO v_reset_id;

  IF v_reset_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_snapshot_found');
  END IF;

  UPDATE public.profiles p
  SET clicks_used = GREATEST(COALESCE(p.clicks_used, 0), COALESCE(s.clicks_used, 0)),
      clicks_period_start = COALESCE(s.clicks_period_start, p.clicks_period_start)
  FROM public.quota_reset_snapshots s
  WHERE s.reset_id = v_reset_id
    AND s.profile_id = p.id
    AND COALESCE(s.plan_slug, 'free') <> 'free'
    AND COALESCE(s.clicks_used, 0) > COALESCE(p.clicks_used, 0);

  GET DIAGNOSTICS v_restored = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'reset_id', v_reset_id, 'restored', v_restored);
END
$function$;

GRANT EXECUTE ON FUNCTION public.reset_all_clicks() TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_paid_quota_from_reset_snapshot(uuid) TO service_role;

-- ==================== MIGRATION: 20260616234741_9272d8b6-f032-45f2-acc8-83caa4f97f6f.sql ====================

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


-- ==================== MIGRATION: 20260617003000_m9_plisio_event_logs_txn_id_idx.sql ====================
-- M9 fix: recovery query in plisio-webhook.ts does WHERE txn_id = $1 on every unmatched webhook.
-- Without this index it becomes a sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_plisio_event_logs_txn_id
  ON public.plisio_event_logs (txn_id);


-- ==================== MIGRATION: 20260617203124_37128ab6-a262-4345-8f25-da2614595b53.sql ====================
-- 1) Wire the sync function as a trigger on profiles
DROP TRIGGER IF EXISTS trg_sync_profile_plan_quota ON public.profiles;
CREATE TRIGGER trg_sync_profile_plan_quota
BEFORE INSERT OR UPDATE OF plan_slug ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_quota();

-- 2) Backfill existing paid users with NULL quota (defensive)
UPDATE public.profiles p
SET click_quota = pk.click_quota,
    link_limit  = pk.link_limit
FROM public.packages pk
WHERE pk.slug = p.plan_slug
  AND p.plan_slug NOT IN ('free', 'lifetime', 'unlimited')
  AND (p.click_quota IS NULL OR p.link_limit IS NULL);

-- ==================== MIGRATION: 20260618075707_907ffcda-70ad-4751-ab7d-4332d812a679.sql ====================
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS blocked_countries text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_links_blocked_countries ON public.links USING gin (blocked_countries);

-- ==================== MIGRATION: 20260618084047_eaa4a9ae-0b8e-4a39-8cb4-e1b0a06a3e9a.sql ====================
REVOKE INSERT ON public.plisio_event_logs FROM anon, authenticated;

DROP POLICY IF EXISTS "Allow anon/auth inserts for webhooks" ON public.plisio_event_logs;
DROP POLICY IF EXISTS "Allow webhook inserts" ON public.plisio_event_logs;

CREATE POLICY "Service role inserts Plisio logs"
ON public.plisio_event_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- ==================== MIGRATION: 20260618084351_4dce2fac-f666-4f46-a4c5-e6b84b9c495d.sql ====================
REVOKE SELECT ON public.app_settings FROM anon;
REVOKE SELECT ON public.bot_rules FROM anon, authenticated;
REVOKE SELECT ON public.cloaking_rules FROM anon, authenticated;
REVOKE SELECT ON public.referrer_rules FROM anon, authenticated;
REVOKE SELECT ON public.bot_fingerprints FROM anon, authenticated;
REVOKE SELECT ON public.blocked_email_domains FROM anon, authenticated;
REVOKE SELECT ON public.daily_stats FROM anon;

DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can view active bot rules" ON public.bot_rules;
DROP POLICY IF EXISTS "Anyone can view active cloaking rules" ON public.cloaking_rules;
DROP POLICY IF EXISTS "Anyone can view active referrer rules" ON public.referrer_rules;
DROP POLICY IF EXISTS "Anyone can view bot fingerprints" ON public.bot_fingerprints;
DROP POLICY IF EXISTS "anyone can read blocked domains" ON public.blocked_email_domains;
DROP POLICY IF EXISTS "Anyone can view daily stats" ON public.daily_stats;

CREATE POLICY "Admins can view app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view bot rules"
ON public.bot_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view cloaking rules"
ON public.cloaking_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view referrer rules"
ON public.referrer_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view bot fingerprints"
ON public.bot_fingerprints
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view blocked email domains"
ON public.blocked_email_domains
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view daily stats for own links"
ON public.daily_stats
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.links
    WHERE links.id = daily_stats.link_id
      AND links.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- ==================== MIGRATION: 20260618084523_1de74766-f6cf-4513-8556-cfa5b9ae179c.sql ====================
GRANT SELECT ON public.signup_attempts TO authenticated;
GRANT SELECT ON public.quota_reset_snapshots TO authenticated;

CREATE POLICY "Admins can view signup attempts"
ON public.signup_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view quota reset snapshots"
ON public.quota_reset_snapshots
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

DROP POLICY IF EXISTS "Service role can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can delete user roles" ON public.user_roles;

CREATE POLICY "Service role can insert user roles"
ON public.user_roles
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can delete user roles"
ON public.user_roles
FOR DELETE
TO service_role
USING (true);

DROP POLICY IF EXISTS "Users can see active broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "Admins can manage broadcasts" ON public.broadcasts;

CREATE POLICY "Authenticated users can see active broadcasts"
ON public.broadcasts
FOR SELECT
TO authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can manage broadcasts authenticated"
ON public.broadcasts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==================== MIGRATION: 20260618084708_e66b8964-94bf-4d8a-a2a6-3813fbc0c25d.sql ====================
REVOKE UPDATE, DELETE ON public.upgrade_requests FROM authenticated;

DROP POLICY IF EXISTS "Users can manage own upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Users create own upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Users view own upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Admins view all upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Admins update upgrade requests" ON public.upgrade_requests;

CREATE POLICY "Users create own upgrade requests"
ON public.upgrade_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users view own upgrade requests"
ON public.upgrade_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all upgrade requests"
ON public.upgrade_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update upgrade requests"
ON public.upgrade_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can insert signup attempts" ON public.signup_attempts;
CREATE POLICY "Service role can insert signup attempts"
ON public.signup_attempts
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert error logs" ON public.error_logs;
CREATE POLICY "Service role can insert error logs"
ON public.error_logs
FOR INSERT
TO service_role
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloaking_rules TO authenticated;
DROP POLICY IF EXISTS "Admins can manage cloaking rules" ON public.cloaking_rules;
CREATE POLICY "Admins can manage cloaking rules"
ON public.cloaking_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==================== MIGRATION: 20260618084825_e275e0d6-3add-4167-a2b2-2e8bdee76e81.sql ====================
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, last_login_at) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own safe profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ==================== MIGRATION: 20260618091510_d1879344-1371-4af2-9f44-8e3104dc8bdb.sql ====================
CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    NULLIF(e->>'link_id', '')::uuid,
    NULLIF(e->>'ip', ''),
    NULLIF(e->>'country', ''),
    NULLIF(e->>'ua', ''),
    COALESCE((e->>'is_bot')::boolean, false),
    NULLIF(e->>'bot_reason', ''),
    COALESCE(NULLIF(e->>'routed_to', ''), 'offer'),
    NULLIF(e->>'utm_source', ''),
    NULLIF(e->>'utm_medium', ''),
    NULLIF(e->>'utm_campaign', ''),
    NULLIF(e->>'utm_term', ''),
    NULLIF(e->>'utm_content', ''),
    NULLIF(e->>'referer_host', ''),
    COALESCE(NULLIF(e->>'bot_score', '')::integer, 0),
    COALESCE(e->'signals', '{}'::jsonb),
    COALESCE((e->>'challenge_passed')::boolean, false)
  FROM jsonb_array_elements(_events) AS e
  WHERE NULLIF(e->>'link_id', '') IS NOT NULL
  LIMIT 250;

  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT NULLIF(e->>'link_id', '')::uuid AS link_id, COUNT(*)::integer AS n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = true
      AND NULLIF(e->>'link_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.links l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.n,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at = now()
  FROM (
    SELECT
      NULLIF(e->>'link_id', '')::uuid AS link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'ours')::integer AS ours_n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'offer')::integer AS offer_n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = false
      AND NULLIF(e->>'link_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.profiles p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.n,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_n
  FROM (
    SELECT
      NULLIF(e->>'user_id', '')::uuid AS user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'ours')::integer AS ours_n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = false
      AND NULLIF(e->>'user_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE p.id = s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role;

-- ==================== MIGRATION: 20260620193839_f2e8e832-0d1c-4400-bacd-add0f5d77317.sql ====================
SET statement_timeout = 0;
SET lock_timeout = '30s';

CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_link_ids uuid[];
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
BEGIN
  SELECT array_agg(id),
         jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
    INTO v_link_ids, v_links
  FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

  SELECT
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_humans, v_bots, v_ours, v_offers
  FROM links
  WHERE user_id = _user_id;

  v_total := v_humans + v_bots;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot
      AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1, 2
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(
        (SELECT jsonb_agg(
           COALESCE((SELECT cnt FROM click_agg WHERE day_idx = d.day AND hour_utc = h.hour), 0)
           ORDER BY h.hour
         )
         FROM generate_series(0, 23) AS h(hour))
        ORDER BY d.day
       )
       FROM generate_series(0, 6) AS d(day)),
      '[]'::jsonb
    ),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax;

  SELECT jsonb_agg(t ORDER BY t.total DESC)
    INTO v_countries
  FROM (
    SELECT
      UPPER(COALESCE(country, '??')) AS code,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_browsers
  FROM (
    SELECT ua_browser(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_os
  FROM (
    SELECT ua_os(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_reasons
  FROM (
    SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_sources
  FROM (
    SELECT
      referrer_source(referer_host) AS key,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_top_links
  FROM (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY link_id
    ORDER BY humans DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.created_at DESC) INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'links',            COALESCE(v_links, '[]'::jsonb),
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb)
  );
END
$function$;

DO $$
BEGIN
  IF to_regclass('public.analytics_cache') IS NOT NULL THEN
    TRUNCATE TABLE public.analytics_cache;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260620201839_990df8db-1765-4f2d-9bc2-a20166f92f20.sql ====================
CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_link_ids uuid[];
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
BEGIN
  SELECT array_agg(id),
         jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
    INTO v_link_ids, v_links
  FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

  SELECT
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_humans, v_bots, v_ours, v_offers
  FROM links
  WHERE user_id = _user_id;

  v_total := v_humans + v_bots;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot
      AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1, 2
  ),
  grid AS (
    SELECT d_day, h_hour, COALESCE(ca.cnt, 0)::bigint AS cnt
    FROM generate_series(0, 6) AS d_day
    CROSS JOIN generate_series(0, 23) AS h_hour
    LEFT JOIN click_agg ca ON ca.day_idx = d_day AND ca.hour_utc = h_hour
  ),
  rows_agg AS (
    SELECT d_day, jsonb_agg(cnt ORDER BY h_hour) AS row_arr
    FROM grid
    GROUP BY d_day
  )
  SELECT
    COALESCE(jsonb_agg(row_arr ORDER BY d_day), '[]'::jsonb),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax
  FROM rows_agg;

  SELECT jsonb_agg(t ORDER BY t.total DESC)
    INTO v_countries
  FROM (
    SELECT
      UPPER(COALESCE(country, '??')) AS code,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_browsers
  FROM (
    SELECT ua_browser(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_os
  FROM (
    SELECT ua_os(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_reasons
  FROM (
    SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_sources
  FROM (
    SELECT
      referrer_source(referer_host) AS key,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_top_links
  FROM (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY link_id
    ORDER BY humans DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.created_at DESC) INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'links',            COALESCE(v_links, '[]'::jsonb),
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb)
  );
END
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'analytics_cache') THEN
    EXECUTE 'TRUNCATE TABLE public.analytics_cache';
  END IF;
END $$;

-- ==================== MIGRATION: 20260620202635_d7d2f4ac-1915-4fdb-a5a4-cca56654160c.sql ====================
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
  SELECT public._compute_analytics_summary(_user_id, _days);
$$;

-- ==================== MIGRATION: 20260620204016_5711249a-4546-4f95-bff4-bcf382412a0e.sql ====================
CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_link_ids uuid[];
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
BEGIN
  SELECT array_agg(id),
         jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
    INTO v_link_ids, v_links
  FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  -- Materialize the user's click slice ONCE; all aggregates below run on this small set
  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT link_id, created_at, is_bot, country, ua, bot_reason, referer_host, routed_to, id
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

  -- Aggregate totals from links (already counters)
  SELECT
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_humans, v_bots, v_ours, v_offers
  FROM links
  WHERE user_id = _user_id;

  v_total := v_humans + v_bots;

  -- 24h / 60s counts from the temp set
  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM _c;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM _c
    WHERE NOT is_bot AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM _c
    GROUP BY 1, 2
  ),
  grid AS (
    SELECT d_day, h_hour, COALESCE(ca.cnt, 0)::bigint AS cnt
    FROM generate_series(0, 6) AS d_day
    CROSS JOIN generate_series(0, 23) AS h_hour
    LEFT JOIN click_agg ca ON ca.day_idx = d_day AND ca.hour_utc = h_hour
  ),
  rows_agg AS (
    SELECT d_day, jsonb_agg(cnt ORDER BY h_hour) AS row_arr
    FROM grid
    GROUP BY d_day
  )
  SELECT
    COALESCE(jsonb_agg(row_arr ORDER BY d_day), '[]'::jsonb),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax
  FROM rows_agg;

  SELECT jsonb_agg(t ORDER BY t.total DESC)
    INTO v_countries
  FROM (
    SELECT
      UPPER(COALESCE(country, '??')) AS code,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM _c WHERE NOT is_bot
    GROUP BY 1
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_browsers
  FROM (
    SELECT ua_browser(ua) AS name, COUNT(*) AS cnt
    FROM _c WHERE NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_os
  FROM (
    SELECT ua_os(ua) AS name, COUNT(*) AS cnt
    FROM _c WHERE NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_reasons
  FROM (
    SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt
    FROM _c WHERE is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_sources
  FROM (
    SELECT
      referrer_source(referer_host) AS key,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_top_links
  FROM (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM _c
    GROUP BY link_id
    ORDER BY humans DESC
    LIMIT 6
  ) t;

  -- Live events: use base table with link+created index, ignore _since
  SELECT jsonb_agg(t ORDER BY t.created_at DESC) INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  DROP TABLE _c;

  RETURN jsonb_build_object(
    'links',            COALESCE(v_links, '[]'::jsonb),
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb)
  );
END
$function$;

-- ==================== MIGRATION: 20260620204601_b55480b3-9a5e-42a2-9ddf-8c8e461d331e.sql ====================
-- 1) Plan-aware reset: clear analytics for all, but only reset clicks_used for FREE users
CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_snapshot_count bigint;
  v_free_reset_count bigint;
  v_now timestamptz := now();
  v_reset_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  -- Snapshot every profile BEFORE any change (audit + restore safety net)
  INSERT INTO public.quota_reset_snapshots (
    reset_id, reset_at, profile_id, email, plan_slug,
    click_quota, clicks_used, clicks_period_start, plan_expires_at
  )
  SELECT
    v_reset_id, v_now, id, email, plan_slug,
    click_quota, clicks_used, clicks_period_start, plan_expires_at
  FROM public.profiles;
  GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;

  -- Clear raw analytics for everyone (keeps stats page fast)
  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  -- Zero link counters for everyone (display only; quota lives on profiles.clicks_used)
  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL
  WHERE id IS NOT NULL;

  -- Display ours_clicks resets for everyone too
  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE id IS NOT NULL;

  -- *** QUOTA RESET RULE ***
  -- ONLY free users get clicks_used reset (their weekly free quota refills).
  -- Paid monthly users (starter/pro/etc) keep clicks_used so they cannot
  -- exploit the reset for unlimited usage within their billing month.
  -- lifetime / unlimited have NULL click_quota anyway, so it does not matter.
  UPDATE public.profiles
  SET clicks_used = 0,
      clicks_period_start = v_now
  WHERE COALESCE(plan_slug, 'free') = 'free';
  GET DIAGNOSTICS v_free_reset_count = ROW_COUNT;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE
  SET last_click_reset_at = v_now,
      updated_at = v_now
  WHERE public.app_settings.id = EXCLUDED.id;

  RETURN jsonb_build_object(
    'ok', true,
    'cleared', v_clicks_before,
    'reset_at', v_now,
    'reset_id', v_reset_id,
    'snapshotted_profiles', v_snapshot_count,
    'free_users_quota_reset', v_free_reset_count
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.reset_all_clicks() TO service_role;

-- 2) Schedule it every Sunday at 00:00 UTC (= 06:00 Bangladesh)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old/conflicting schedules with the same name if any
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('weekly-reset-all-clicks', 'sunday-reset-all-clicks');

    PERFORM cron.schedule(
      'weekly-reset-all-clicks',
      '0 0 * * 0',
      $cron$ SELECT public.reset_all_clicks(); $cron$
    );
  END IF;
END $$;

-- ==================== MIGRATION: 20260620204810_283aef16-68d8-4b35-a7b5-23ec2ab48a5b.sql ====================
-- 1) Cache table
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  user_id uuid NOT NULL,
  days integer NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, days)
);

GRANT ALL ON public.analytics_cache TO service_role;
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only SECURITY DEFINER functions read/write it.

-- 2) get_analytics_summary: cache-first, recompute on miss/stale
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
  v_fresh_after timestamptz := now() - interval '5 minutes';
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  -- Fresh cache hit â†’ instant
  IF v_data IS NOT NULL AND v_updated > v_fresh_after THEN
    RETURN v_data || jsonb_build_object('_cached', true, '_cachedAt', v_updated);
  END IF;

  -- Recompute (slow path)
  v_data := public._compute_analytics_summary(_user_id, _days);

  INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
  VALUES (_user_id, _days, v_data, now())
  ON CONFLICT (user_id, days) DO UPDATE
    SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN v_data || jsonb_build_object('_cached', false, '_cachedAt', now());
END
$function$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;

-- 3) Background refresher: walks every user who has links + recent clicks
CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
BEGIN
  -- Generous timeout for this background job
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '5s', true);

  FOR v_user IN
    SELECT DISTINCT l.user_id
    FROM public.links l
    WHERE EXISTS (
      SELECT 1 FROM public.clicks c
      WHERE c.link_id = l.id AND c.created_at > now() - interval '24 hours'
      LIMIT 1
    )
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- skip one user's failure, keep going
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'tookMs', EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)::int
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache() TO service_role;

-- 4) Schedule the refresher every 2 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'refresh-analytics-cache';

    PERFORM cron.schedule(
      'refresh-analytics-cache',
      '*/2 * * * *',
      $cron$ SELECT public.refresh_active_analytics_cache(); $cron$
    );
  END IF;
END $$;

-- ==================== MIGRATION: 20260620205336_8887f84f-b6ff-4c46-8ac1-5959f73acf14.sql ====================
DROP FUNCTION IF EXISTS public.admin_get_inactive_users();

CREATE FUNCTION public.admin_get_inactive_users()
 RETURNS TABLE(id uuid, email text, plan_slug text, created_at timestamptz, last_login_at timestamptz, clicks_used bigint, link_count integer, days_inactive integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.email,
    COALESCE(p.plan_slug, 'free')::text AS plan_slug,
    p.created_at,
    p.last_login_at,
    COALESCE(p.clicks_used, 0)::bigint AS clicks_used,
    (SELECT COUNT(*)::int FROM public.links l WHERE l.user_id = p.id) AS link_count,
    EXTRACT(DAY FROM now() - COALESCE(p.last_login_at, p.created_at))::int AS days_inactive
  FROM public.profiles p
  WHERE
    (p.last_login_at IS NOT NULL AND p.last_login_at < now() - interval '7 days')
    OR (p.last_login_at IS NULL AND p.created_at < now() - interval '7 days')
  ORDER BY COALESCE(p.last_login_at, p.created_at) ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_get_inactive_users() TO service_role, authenticated;

-- ==================== MIGRATION: 20260620205520_6428e084-b8b4-41d2-ba06-eefafd2fbcab.sql ====================
DROP FUNCTION IF EXISTS public.admin_get_inactive_users();

CREATE OR REPLACE FUNCTION public.admin_get_inactive_users()
RETURNS TABLE(
  id uuid,
  email text,
  plan_slug text,
  clicks_used integer,
  link_count bigint,
  last_sign_in_at timestamptz,
  days_inactive integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    COALESCE(p.plan_slug, 'free') AS plan_slug,
    COALESCE(p.clicks_used, 0) AS clicks_used,
    (SELECT COUNT(*) FROM public.links l WHERE l.user_id = p.id) AS link_count,
    u.last_sign_in_at,
    GREATEST(0, EXTRACT(DAY FROM (now() - COALESCE(u.last_sign_in_at, p.last_login_at, p.created_at)))::int) AS days_inactive,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE COALESCE(p.plan_slug, 'free') = 'free'
    AND COALESCE(u.last_sign_in_at, p.last_login_at, p.created_at) < now() - interval '7 days'
  ORDER BY COALESCE(u.last_sign_in_at, p.last_login_at, p.created_at) ASC NULLS FIRST;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_inactive_users() TO authenticated, service_role;

-- ==================== MIGRATION: 20260620205643_40ffa5b3-5fb5-41dc-9e14-60834940fd4a.sql ====================
ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ==================== MIGRATION: 20260620211112_6b2866f7-3cba-4020-bc67-f327b38ee876.sql ====================
-- Make analytics page load instantly even when the heavy cache is stale/missing.
-- Rule: user-facing reads NEVER recompute the heavy analytics synchronously.

ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_links_user_last_clicked
  ON public.links (user_id, last_clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_links_last_clicked_user
  ON public.links (last_clicked_at DESC, user_id)
  WHERE last_clicked_at IS NOT NULL;

-- Very fast fallback used only when a user has no cache row yet.
-- It returns accurate all-time counters from links and avoids scanning clicks.
CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT
      id AS link_id,
      COALESCE(clicks_count, 0)::bigint AS humans,
      COALESCE(bot_clicks_count, 0)::bigint AS bots,
      (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'last24h',          0,
    'last24hHumans',    0,
    'last60s',          0,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
    'heatmap',          jsonb_build_array(
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
                        ),
    'heatMax',          1,
    'countries',        '[]'::jsonb,
    'devices',          '[]'::jsonb,
    'browsers',         '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons',       '[]'::jsonb,
    'trafficSources',   '[]'::jsonb,
    'topLinks',         v_top_links,
    'liveEvents',       '[]'::jsonb,
    '_fallback',        true
  );
END
$function$;

-- Bounded compute: keeps the expensive breakdowns fast by sampling recent clicks.
CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint := 0;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
  v_sample_limit integer := 20000;
  v_per_link_limit integer := 5000;
  v_sampled bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  v_total := v_humans + v_bots;

  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT s.*
  FROM (
    SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id
    FROM public.links l
    JOIN LATERAL (
      SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id
      FROM public.clicks c
      WHERE c.link_id = l.id
        AND c.created_at >= v_since
      ORDER BY c.created_at DESC
      LIMIT v_per_link_limit
    ) c ON true
    WHERE l.user_id = _user_id
    ORDER BY c.created_at DESC
    LIMIT v_sample_limit
  ) s;

  SELECT COUNT(*) INTO v_sampled FROM _c;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM _c;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM _c
    WHERE NOT is_bot AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM _c
    GROUP BY 1, 2
  ),
  grid AS (
    SELECT d_day, h_hour, COALESCE(ca.cnt, 0)::bigint AS cnt
    FROM generate_series(0, 6) AS d_day
    CROSS JOIN generate_series(0, 23) AS h_hour
    LEFT JOIN click_agg ca ON ca.day_idx = d_day AND ca.hour_utc = h_hour
  ),
  rows_agg AS (
    SELECT d_day, jsonb_agg(cnt ORDER BY h_hour) AS row_arr
    FROM grid
    GROUP BY d_day
  )
  SELECT
    COALESCE(jsonb_agg(row_arr ORDER BY d_day), '[]'::jsonb),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax
  FROM rows_agg;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(country, '??')) AS code,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_devices
  FROM (SELECT ua_device(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_browsers
  FROM (SELECT ua_browser(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 8) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_os
  FROM (SELECT ua_os(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_reasons
  FROM (SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt FROM _c WHERE is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
    INTO v_sources
  FROM (
    SELECT referrer_source(referer_host) AS key,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM _c
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  DROP TABLE _c;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb),
    '_sampledClicks',   v_sampled,
    '_sampleLimit',     v_sample_limit
  );
END
$function$;

-- Cache wrapper: instant cache read. Stale cache is still returned immediately;
-- cron refresh updates it in the background. No visitor waits for recompute.
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    RETURN v_data || jsonb_build_object(
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  v_data := public._fast_analytics_summary(_user_id, _days);

  INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
  VALUES (_user_id, _days, v_data, now() - interval '1 hour')
  ON CONFLICT (user_id, days) DO UPDATE
    SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN v_data || jsonb_build_object('_cached', false, '_cachedAt', now() - interval '1 hour', '_stale', true, '_fallback', true);
END
$function$;

DROP FUNCTION IF EXISTS public.refresh_active_analytics_cache();

-- Background refresher: small batches + advisory lock prevent overlapping slow cron jobs.
CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_locked boolean;
BEGIN
  PERFORM set_config('statement_timeout', '60s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL
        OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'failed', v_failed,
    'limit', GREATEST(1, LEAST(COALESCE(_limit, 20), 100)),
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'refresh-analytics-cache';

    PERFORM cron.schedule(
      'refresh-analytics-cache',
      '* * * * *',
      $cron$ SELECT public.refresh_active_analytics_cache(20); $cron$
    );
  END IF;
END $$;

-- ==================== MIGRATION: 20260620211205_149b0ed9-1c43-4b0b-b539-2078256e7b92.sql ====================
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    RETURN v_data || jsonb_build_object(
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  -- Important: no INSERT/UPDATE here. User-facing analytics reads must stay instant
  -- and must also work in read-only RPC/query contexts.
  RETURN public._fast_analytics_summary(_user_id, _days)
    || jsonb_build_object('_cached', false, '_cachedAt', NULL, '_stale', true, '_fallback', true);
END
$function$;

REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;

-- ==================== MIGRATION: 20260620211305_91f2e97c-baa9-470a-9de4-4ed01457233a.sql ====================
REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM anon;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;

-- ==================== MIGRATION: 20260620211403_db0f7bf0-db2c-46f8-b1df-77a4c5329a6d.sql ====================
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;

-- ==================== MIGRATION: 20260620211647_85bf334f-d66e-46e5-ab75-820e1f6df6c3.sql ====================
-- Repair older self-hosted analytics_cache tables that existed before the (user_id, days) key.
-- Keep the newest cache row per user/day, then add the unique key required by ON CONFLICT.

DELETE FROM public.analytics_cache a
USING public.analytics_cache b
WHERE a.user_id = b.user_id
  AND a.days = b.days
  AND a.ctid < b.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'analytics_cache'
      AND i.indisunique
      AND i.indkey::text = (
        SELECT string_agg(attnum::text, ' ' ORDER BY attnum)
        FROM pg_attribute
        WHERE attrelid = t.oid
          AND attname IN ('user_id', 'days')
      )
  ) THEN
    CREATE UNIQUE INDEX analytics_cache_user_id_days_uidx
      ON public.analytics_cache (user_id, days);
  END IF;
END $$;

-- ==================== MIGRATION: 20260620211937_f9d51439-d420-4c54-ae0d-795b7ab2dbe2.sql ====================
-- Final repair for older self-hosted analytics_cache tables:
-- some installs have PRIMARY KEY (user_id) instead of PRIMARY KEY (user_id, days),
-- which makes refresh_active_analytics_cache fail even after adding a separate unique index.

ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.analytics_cache
SET days = 7
WHERE days IS NULL;

DELETE FROM public.analytics_cache a
USING public.analytics_cache b
WHERE a.user_id = b.user_id
  AND a.days = b.days
  AND (
    COALESCE(a.updated_at, '-infinity'::timestamptz) < COALESCE(b.updated_at, '-infinity'::timestamptz)
    OR (COALESCE(a.updated_at, '-infinity'::timestamptz) = COALESCE(b.updated_at, '-infinity'::timestamptz) AND a.ctid < b.ctid)
  );

ALTER TABLE public.analytics_cache
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN days SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
DECLARE
  v_pk_name text;
  v_pk_cols text[];
BEGIN
  SELECT c.conname, array_agg(a.attname ORDER BY u.ord)
  INTO v_pk_name, v_pk_cols
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
  WHERE c.conrelid = 'public.analytics_cache'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname;

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['user_id', 'days'] THEN
    EXECUTE format('ALTER TABLE public.analytics_cache DROP CONSTRAINT %I', v_pk_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.analytics_cache'::regclass
      AND contype = 'p'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_class i
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = 'public'
        AND i.relname = 'analytics_cache_user_id_days_uidx'
    ) THEN
      ALTER TABLE public.analytics_cache
        ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY USING INDEX analytics_cache_user_id_days_uidx;
    ELSE
      ALTER TABLE public.analytics_cache
        ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY (user_id, days);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '60s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL
        OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id,
          'state', SQLSTATE,
          'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'failed', v_failed,
    'errors', v_errors,
    'limit', GREATEST(1, LEAST(COALESCE(_limit, 20), 100)),
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END
$function$;

REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;

-- ==================== MIGRATION: 20260620212114_f442c1e1-1b04-4358-bf1a-9095230233a3.sql ====================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='analytics_cache' AND column_name='payload'
  ) THEN
    EXECUTE 'ALTER TABLE public.analytics_cache ALTER COLUMN payload DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.analytics_cache ALTER COLUMN payload SET DEFAULT ''{}''::jsonb';
    EXECUTE 'UPDATE public.analytics_cache SET payload = ''{}''::jsonb WHERE payload IS NULL';
  END IF;
END $$;

-- ==================== MIGRATION: 20260620220052_0203b03c-71e8-4dd4-bf2b-b7f1bd158fa1.sql ====================
CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint := 0;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
  v_unique bigint := 0;
  v_sample_limit integer := 20000;
  v_per_link_limit integer := 5000;
  v_sampled bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  v_total := v_humans + v_bots;

  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT s.*
  FROM (
    SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
    FROM public.links l
    JOIN LATERAL (
      SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
      FROM public.clicks c
      WHERE c.link_id = l.id
        AND c.created_at >= v_since
      ORDER BY c.created_at DESC
      LIMIT v_per_link_limit
    ) c ON true
    WHERE l.user_id = _user_id
    ORDER BY c.created_at DESC
    LIMIT v_sample_limit
  ) s;

  SELECT COUNT(*) INTO v_sampled FROM _c;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM _c;

  -- Unique human visitors (DISTINCT IPs, NOT bots) within the sampled window
  SELECT COUNT(DISTINCT ip) INTO v_unique
  FROM _c
  WHERE NOT is_bot AND ip IS NOT NULL;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM _c
    WHERE NOT is_bot AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM _c
    GROUP BY 1, 2
  ),
  grid AS (
    SELECT d_day, h_hour, COALESCE(ca.cnt, 0)::bigint AS cnt
    FROM generate_series(0, 6) AS d_day
    CROSS JOIN generate_series(0, 23) AS h_hour
    LEFT JOIN click_agg ca ON ca.day_idx = d_day AND ca.hour_utc = h_hour
  ),
  rows_agg AS (
    SELECT d_day, jsonb_agg(cnt ORDER BY h_hour) AS row_arr
    FROM grid
    GROUP BY d_day
  )
  SELECT
    COALESCE(jsonb_agg(row_arr ORDER BY d_day), '[]'::jsonb),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax
  FROM rows_agg;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(country, '??')) AS code,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_devices
  FROM (SELECT ua_device(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_browsers
  FROM (SELECT ua_browser(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 8) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_os
  FROM (SELECT ua_os(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_reasons
  FROM (SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt FROM _c WHERE is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
    INTO v_sources
  FROM (
    SELECT referrer_source(referer_host) AS key,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM _c
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  DROP TABLE _c;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'unique',           v_unique,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb),
    '_sampledClicks',   v_sampled,
    '_sampleLimit',     v_sample_limit
  );
END
$function$;

-- ==================== MIGRATION: 20260620221509_46adb48b-cd68-49b2-85e7-05fe2f1ba4cd.sql ====================
-- Fix analytics Unique Visitors + cache conflict/read-only issues.

ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.analytics_cache SET days = 7 WHERE days IS NULL;
DELETE FROM public.analytics_cache WHERE user_id IS NULL OR days IS NULL;

DELETE FROM public.analytics_cache a
USING public.analytics_cache b
WHERE a.user_id = b.user_id
  AND a.days = b.days
  AND (
    COALESCE(a.updated_at, '-infinity'::timestamptz) < COALESCE(b.updated_at, '-infinity'::timestamptz)
    OR (COALESCE(a.updated_at, '-infinity'::timestamptz) = COALESCE(b.updated_at, '-infinity'::timestamptz) AND a.ctid < b.ctid)
  );

ALTER TABLE public.analytics_cache
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN days SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
DECLARE
  v_pk_name text;
BEGIN
  SELECT conname INTO v_pk_name
  FROM pg_constraint
  WHERE conrelid = 'public.analytics_cache'::regclass
    AND contype = 'p'
  LIMIT 1;

  IF v_pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.analytics_cache DROP CONSTRAINT %I', v_pk_name);
  END IF;
END $$;

ALTER TABLE public.analytics_cache
  ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY (user_id, days);

GRANT SELECT ON public.analytics_cache TO authenticated;
GRANT ALL ON public.analytics_cache TO service_role;

CREATE INDEX IF NOT EXISTS idx_analytics_cache_updated_at
  ON public.analytics_cache (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_link_ip_human_created
  ON public.clicks (link_id, ip, created_at DESC)
  WHERE is_bot = false AND ip IS NOT NULL;

CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_unique bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT
      id AS link_id,
      COALESCE(clicks_count, 0)::bigint AS humans,
      COALESCE(bot_clicks_count, 0)::bigint AS bots,
      (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'unique',           v_unique,
    'uniqueVisitors',   v_unique,
    'unique_ips',       v_unique,
    'last24h',          0,
    'last24hHumans',    0,
    'last60s',          0,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
    'heatmap',          jsonb_build_array(
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
                        ),
    'heatMax',          1,
    'countries',        '[]'::jsonb,
    'devices',          '[]'::jsonb,
    'browsers',         '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons',       '[]'::jsonb,
    'trafficSources',   '[]'::jsonb,
    'topLinks',         v_top_links,
    'liveEvents',       '[]'::jsonb,
    '_fallback',        true
  );
END
$function$;

CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint := 0;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
  v_unique bigint := 0;
  v_sample_limit integer := 20000;
  v_per_link_limit integer := 5000;
  v_sampled bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  v_total := v_humans + v_bots;

  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT s.*
  FROM (
    SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
    FROM public.links l
    JOIN LATERAL (
      SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
      FROM public.clicks c
      WHERE c.link_id = l.id
        AND c.created_at >= v_since
      ORDER BY c.created_at DESC
      LIMIT v_per_link_limit
    ) c ON true
    WHERE l.user_id = _user_id
    ORDER BY c.created_at DESC
    LIMIT v_sample_limit
  ) s;

  SELECT COUNT(*) INTO v_sampled FROM _c;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM _c;

  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    SELECT COUNT(DISTINCT ip) INTO v_unique
    FROM _c
    WHERE NOT is_bot AND ip IS NOT NULL;
  END;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM _c
    WHERE NOT is_bot AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM _c
    GROUP BY 1, 2
  ),
  grid AS (
    SELECT d_day, h_hour, COALESCE(ca.cnt, 0)::bigint AS cnt
    FROM generate_series(0, 6) AS d_day
    CROSS JOIN generate_series(0, 23) AS h_hour
    LEFT JOIN click_agg ca ON ca.day_idx = d_day AND ca.hour_utc = h_hour
  ),
  rows_agg AS (
    SELECT d_day, jsonb_agg(cnt ORDER BY h_hour) AS row_arr
    FROM grid
    GROUP BY d_day
  )
  SELECT
    COALESCE(jsonb_agg(row_arr ORDER BY d_day), '[]'::jsonb),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax
  FROM rows_agg;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(country, '??')) AS code,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_devices
  FROM (SELECT ua_device(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_browsers
  FROM (SELECT ua_browser(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 8) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_os
  FROM (SELECT ua_os(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_reasons
  FROM (SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt FROM _c WHERE is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
    INTO v_sources
  FROM (
    SELECT referrer_source(referer_host) AS key,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM _c
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  DROP TABLE _c;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'unique',           v_unique,
    'uniqueVisitors',   v_unique,
    'unique_ips',       v_unique,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb),
    '_sampledClicks',   v_sampled,
    '_sampleLimit',     v_sample_limit
  );
END
$function$;

DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
  v_unique bigint := 0;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    v_unique := COALESCE(
      NULLIF(v_data->>'unique', '')::bigint,
      NULLIF(v_data->>'uniqueVisitors', '')::bigint,
      NULLIF(v_data->>'unique_ips', '')::bigint,
      0
    );

    RETURN v_data || jsonb_build_object(
      'unique', v_unique,
      'uniqueVisitors', v_unique,
      'unique_ips', v_unique,
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  RETURN public._fast_analytics_summary(_user_id, _days)
    || jsonb_build_object('_cached', false, '_cachedAt', NULL, '_stale', true, '_fallback', true);
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '90s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL
        OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id,
          'state', SQLSTATE,
          'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'failed', v_failed,
    'errors', v_errors,
    'limit', GREATEST(1, LEAST(COALESCE(_limit, 20), 100)),
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END
$function$;

REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;

-- ==================== MIGRATION: 20260620222620_87531c89-ad02-4c15-b9b3-451dd186b294.sql ====================
ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.analytics_cache SET days = 7 WHERE days IS NULL;
DELETE FROM public.analytics_cache WHERE user_id IS NULL OR days IS NULL;

WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY user_id, days
           ORDER BY COALESCE(updated_at, '-infinity'::timestamptz) DESC, ctid DESC
         ) AS rn
  FROM public.analytics_cache
)
DELETE FROM public.analytics_cache a
USING ranked r
WHERE a.ctid = r.ctid
  AND r.rn > 1;

ALTER TABLE public.analytics_cache
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN days SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
DECLARE
  v_pk_name text;
  v_pk_cols text[];
BEGIN
  SELECT c.conname, array_agg(a.attname::text ORDER BY u.ord)
  INTO v_pk_name, v_pk_cols
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
  WHERE c.conrelid = 'public.analytics_cache'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname
  LIMIT 1;

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['user_id'::text, 'days'::text] THEN
    EXECUTE format('ALTER TABLE public.analytics_cache DROP CONSTRAINT %I', v_pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.analytics_cache'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.analytics_cache
      ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY (user_id, days);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT c.oid, array_agg(a.attname::text ORDER BY u.ord) AS cols
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
      WHERE c.conrelid = 'public.analytics_cache'::regclass
        AND c.contype IN ('p', 'u')
      GROUP BY c.oid
    ) s
    WHERE s.cols = ARRAY['user_id'::text, 'days'::text]
  ) THEN
    ALTER TABLE public.analytics_cache
      ADD CONSTRAINT analytics_cache_user_id_days_key UNIQUE (user_id, days);
  END IF;
END $$;

GRANT SELECT ON public.analytics_cache TO authenticated;
GRANT ALL ON public.analytics_cache TO service_role;

CREATE INDEX IF NOT EXISTS idx_analytics_cache_updated_at
  ON public.analytics_cache (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_link_ip_human_created
  ON public.clicks (link_id, ip, created_at DESC)
  WHERE is_bot = false AND ip IS NOT NULL;

UPDATE public.analytics_cache
SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
  'unique', COALESCE(
    CASE WHEN COALESCE(data->>'unique', '') ~ '^\d+$' THEN (data->>'unique')::bigint END,
    CASE WHEN COALESCE(data->>'uniqueVisitors', '') ~ '^\d+$' THEN (data->>'uniqueVisitors')::bigint END,
    CASE WHEN COALESCE(data->>'unique_ips', '') ~ '^\d+$' THEN (data->>'unique_ips')::bigint END,
    0
  ),
  'uniqueVisitors', COALESCE(
    CASE WHEN COALESCE(data->>'unique', '') ~ '^\d+$' THEN (data->>'unique')::bigint END,
    CASE WHEN COALESCE(data->>'uniqueVisitors', '') ~ '^\d+$' THEN (data->>'uniqueVisitors')::bigint END,
    CASE WHEN COALESCE(data->>'unique_ips', '') ~ '^\d+$' THEN (data->>'unique_ips')::bigint END,
    0
  ),
  'unique_ips', COALESCE(
    CASE WHEN COALESCE(data->>'unique', '') ~ '^\d+$' THEN (data->>'unique')::bigint END,
    CASE WHEN COALESCE(data->>'uniqueVisitors', '') ~ '^\d+$' THEN (data->>'uniqueVisitors')::bigint END,
    CASE WHEN COALESCE(data->>'unique_ips', '') ~ '^\d+$' THEN (data->>'unique_ips')::bigint END,
    0
  )
);

CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_unique bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT
      id AS link_id,
      COALESCE(clicks_count, 0)::bigint AS humans,
      COALESCE(bot_clicks_count, 0)::bigint AS bots,
      (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  RETURN jsonb_build_object(
    'links', v_links,
    'total', v_total,
    'humans', v_humans,
    'bots', v_bots,
    'unique', v_unique,
    'uniqueVisitors', v_unique,
    'unique_ips', v_unique,
    'last24h', 0,
    'last24hHumans', 0,
    'last60s', 0,
    'offers', v_offers,
    'oursClicks', v_ours,
    'hourly', jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
    'heatmap', jsonb_build_array(
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
    ),
    'heatMax', 1,
    'countries', '[]'::jsonb,
    'devices', '[]'::jsonb,
    'browsers', '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons', '[]'::jsonb,
    'trafficSources', '[]'::jsonb,
    'topLinks', v_top_links,
    'liveEvents', '[]'::jsonb,
    '_fallback', true
  );
END
$function$;

DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
  v_unique bigint := 0;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    v_unique := COALESCE(
      CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
      CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
      CASE WHEN COALESCE(v_data->>'unique_ips', '') ~ '^\d+$' THEN (v_data->>'unique_ips')::bigint END,
      0
    );

    RETURN v_data || jsonb_build_object(
      'unique', v_unique,
      'uniqueVisitors', v_unique,
      'unique_ips', v_unique,
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  RETURN public._fast_analytics_summary(_user_id, _days)
    || jsonb_build_object('_cached', false, '_cachedAt', NULL, '_stale', true, '_fallback', true);
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_unique bigint := 0;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '90s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL
        OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      v_unique := COALESCE(
        CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
        CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
        CASE WHEN COALESCE(v_data->>'unique_ips', '') ~ '^\d+$' THEN (v_data->>'unique_ips')::bigint END,
        0
      );
      v_data := v_data || jsonb_build_object('unique', v_unique, 'uniqueVisitors', v_unique, 'unique_ips', v_unique);

      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id,
          'state', SQLSTATE,
          'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'failed', v_failed,
    'errors', v_errors,
    'limit', GREATEST(1, LEAST(COALESCE(_limit, 20), 100)),
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END
$function$;

CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      NULLIF(e->>'ip', '') AS ip,
      NULLIF(e->>'country', '') AS country,
      NULLIF(e->>'ua', '') AS ua,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      NULLIF(e->>'bot_reason', '') AS bot_reason,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to,
      NULLIF(e->>'utm_source', '') AS utm_source,
      NULLIF(e->>'utm_medium', '') AS utm_medium,
      NULLIF(e->>'utm_campaign', '') AS utm_campaign,
      NULLIF(e->>'utm_term', '') AS utm_term,
      NULLIF(e->>'utm_content', '') AS utm_content,
      NULLIF(e->>'referer_host', '') AS referer_host,
      COALESCE(NULLIF(e->>'bot_score', '')::integer, 0) AS bot_score,
      COALESCE(e->'signals', '{}'::jsonb) AS signals,
      COALESCE((e->>'challenge_passed')::boolean, false) AS challenge_passed
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.*
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  FROM valid;

  WITH parsed AS (
    SELECT (e->>'link_id')::uuid AS link_id, COALESCE((e->>'is_bot')::boolean, false) AS is_bot
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT link_id, COUNT(*)::integer AS n
    FROM valid
    WHERE is_bot = true
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot, p.routed_to
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  UPDATE public.links l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.n,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at = now()
  FROM (
    SELECT
      link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n,
      COUNT(*) FILTER (WHERE routed_to = 'offer')::integer AS offer_n
    FROM valid
    WHERE is_bot = false
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot, p.routed_to, l.user_id AS owner_user_id
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
    WHERE l.user_id IS NOT NULL
  )
  UPDATE public.profiles p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.n,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_n
  FROM (
    SELECT
      owner_user_id AS user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n
    FROM valid
    WHERE is_bot = false
    GROUP BY 1
  ) AS s
  WHERE p.id = s.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role;

-- ==================== MIGRATION: 20260620223515_3b18277c-92ba-410e-9e57-7f9fe5ceaf25.sql ====================
ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.analytics_cache SET days = 7 WHERE days IS NULL;
DELETE FROM public.analytics_cache WHERE user_id IS NULL OR days IS NULL;

WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY user_id, days
           ORDER BY COALESCE(updated_at, '-infinity'::timestamptz) DESC, ctid DESC
         ) AS rn
  FROM public.analytics_cache
)
DELETE FROM public.analytics_cache a
USING ranked r
WHERE a.ctid = r.ctid
  AND r.rn > 1;

ALTER TABLE public.analytics_cache
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN days SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS analytics_cache_user_id_days_unique_idx
  ON public.analytics_cache (user_id, days);

GRANT SELECT ON public.analytics_cache TO authenticated;
GRANT ALL ON public.analytics_cache TO service_role;

CREATE INDEX IF NOT EXISTS idx_analytics_cache_updated_at
  ON public.analytics_cache (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_link_ip_human_created
  ON public.clicks (link_id, ip, created_at DESC)
  WHERE is_bot = false AND ip IS NOT NULL;

CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_unique bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT
      id AS link_id,
      COALESCE(clicks_count, 0)::bigint AS humans,
      COALESCE(bot_clicks_count, 0)::bigint AS bots,
      (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  RETURN jsonb_build_object(
    'links', v_links,
    'total', v_total,
    'humans', v_humans,
    'bots', v_bots,
    'unique', v_unique,
    'uniqueVisitors', v_unique,
    'unique_ips', v_unique,
    'last24h', 0,
    'last24hHumans', 0,
    'last60s', 0,
    'offers', v_offers,
    'oursClicks', v_ours,
    'hourly', jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
    'heatmap', jsonb_build_array(
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
    ),
    'heatMax', 1,
    'countries', '[]'::jsonb,
    'devices', '[]'::jsonb,
    'browsers', '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons', '[]'::jsonb,
    'trafficSources', '[]'::jsonb,
    'topLinks', v_top_links,
    'liveEvents', '[]'::jsonb,
    '_fallback', true
  );
END
$function$;

DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
  v_unique bigint := 0;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    v_unique := COALESCE(
      CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
      CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
      CASE WHEN COALESCE(v_data->>'unique_ips', '') ~ '^\d+$' THEN (v_data->>'unique_ips')::bigint END,
      0
    );

    RETURN v_data || jsonb_build_object(
      'unique', v_unique,
      'uniqueVisitors', v_unique,
      'unique_ips', v_unique,
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  RETURN public._fast_analytics_summary(_user_id, _days)
    || jsonb_build_object('_cached', false, '_cachedAt', NULL, '_stale', true, '_fallback', true);
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_unique bigint := 0;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '90s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL
        OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  LOOP
    BEGIN
      BEGIN
        v_data := public._compute_analytics_summary(v_user.user_id, 7);
      EXCEPTION WHEN OTHERS THEN
        v_data := public._fast_analytics_summary(v_user.user_id, 7)
          || jsonb_build_object('_refreshFallbackReason', SQLERRM);
      END;

      v_unique := COALESCE(
        CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
        CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
        CASE WHEN COALESCE(v_data->>'unique_ips', '') ~ '^\d+$' THEN (v_data->>'unique_ips')::bigint END,
        0
      );
      v_data := v_data || jsonb_build_object('unique', v_unique, 'uniqueVisitors', v_unique, 'unique_ips', v_unique);

      UPDATE public.analytics_cache
      SET data = v_data, updated_at = now()
      WHERE user_id = v_user.user_id AND days = 7;

      IF NOT FOUND THEN
        BEGIN
          INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
          VALUES (v_user.user_id, 7, v_data, now());
        EXCEPTION WHEN unique_violation THEN
          UPDATE public.analytics_cache
          SET data = v_data, updated_at = now()
          WHERE user_id = v_user.user_id AND days = 7;
        END;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id,
          'state', SQLSTATE,
          'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'failed', v_failed,
    'errors', v_errors,
    'limit', GREATEST(1, LEAST(COALESCE(_limit, 20), 100)),
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END
$function$;

CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '20s'
AS $function$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      NULLIF(e->>'ip', '') AS ip,
      NULLIF(e->>'country', '') AS country,
      NULLIF(e->>'ua', '') AS ua,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      NULLIF(e->>'bot_reason', '') AS bot_reason,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to,
      NULLIF(e->>'utm_source', '') AS utm_source,
      NULLIF(e->>'utm_medium', '') AS utm_medium,
      NULLIF(e->>'utm_campaign', '') AS utm_campaign,
      NULLIF(e->>'utm_term', '') AS utm_term,
      NULLIF(e->>'utm_content', '') AS utm_content,
      NULLIF(e->>'referer_host', '') AS referer_host,
      CASE WHEN COALESCE(e->>'bot_score', '') ~ '^-?\d+$' THEN (e->>'bot_score')::integer ELSE 0 END AS bot_score,
      COALESCE(e->'signals', '{}'::jsonb) AS signals,
      COALESCE((e->>'challenge_passed')::boolean, false) AS challenge_passed
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.*
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
    FOR KEY SHARE OF l
  )
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  FROM valid;

  WITH parsed AS (
    SELECT (e->>'link_id')::uuid AS link_id, COALESCE((e->>'is_bot')::boolean, false) AS is_bot
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT link_id, COUNT(*)::integer AS n
    FROM valid
    WHERE is_bot = true
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot, p.routed_to
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  )
  UPDATE public.links l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.n,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at = now()
  FROM (
    SELECT
      link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n,
      COUNT(*) FILTER (WHERE routed_to = 'offer')::integer AS offer_n
    FROM valid
    WHERE is_bot = false
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  WITH parsed AS (
    SELECT
      (e->>'link_id')::uuid AS link_id,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.link_id, p.is_bot, p.routed_to, l.user_id AS owner_user_id
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
    WHERE l.user_id IS NOT NULL
  )
  UPDATE public.profiles p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.n,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_n
  FROM (
    SELECT
      owner_user_id AS user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n
    FROM valid
    WHERE is_bot = false
    GROUP BY 1
  ) AS s
  WHERE p.id = s.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role;

-- ==================== MIGRATION: 20260626051603_45c05683-032b-4492-9f94-e5d289a9df1b.sql ====================

CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint := 0;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
  v_unique bigint := 0;
  v_sample_limit integer := 5000;
  v_per_link_limit integer := 1500;
  v_sampled bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  v_total := v_humans + v_bots;

  -- ACCURATE live counters: compute directly from clicks (not sample)
  SELECT
    COUNT(*) FILTER (WHERE c.created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE c.created_at > now() - interval '24 hours' AND NOT c.is_bot),
    COUNT(*) FILTER (WHERE c.created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM public.links l
  JOIN public.clicks c ON c.link_id = l.id
  WHERE l.user_id = _user_id
    AND c.created_at > now() - interval '24 hours';

  -- ACCURATE unique visitor count from raw clicks
  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  -- Sample for heavy aggregations only (devices/browsers/countries/etc)
  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT s.*
  FROM (
    SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
    FROM public.links l
    JOIN LATERAL (
      SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
      FROM public.clicks c
      WHERE c.link_id = l.id
        AND c.created_at >= v_since
      ORDER BY c.created_at DESC
      LIMIT v_per_link_limit
    ) c ON true
    WHERE l.user_id = _user_id
    ORDER BY c.created_at DESC
    LIMIT v_sample_limit
  ) s;

  SELECT COUNT(*) INTO v_sampled FROM _c;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM _c
    WHERE NOT is_bot AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM _c
    GROUP BY 1, 2
  ),
  grid AS (
    SELECT d_day, h_hour, COALESCE(ca.cnt, 0)::bigint AS cnt
    FROM generate_series(0, 6) AS d_day
    CROSS JOIN generate_series(0, 23) AS h_hour
    LEFT JOIN click_agg ca ON ca.day_idx = d_day AND ca.hour_utc = h_hour
  ),
  rows_agg AS (
    SELECT d_day, jsonb_agg(cnt ORDER BY h_hour) AS row_arr
    FROM grid
    GROUP BY d_day
  )
  SELECT
    COALESCE(jsonb_agg(row_arr ORDER BY d_day), '[]'::jsonb),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax
  FROM rows_agg;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(country, '??')) AS code,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_devices
  FROM (SELECT ua_device(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_browsers
  FROM (SELECT ua_browser(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 8) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_os
  FROM (SELECT ua_os(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_reasons
  FROM (SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt FROM _c WHERE is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
    INTO v_sources
  FROM (
    SELECT referrer_source(referer_host) AS key,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  -- ACCURATE live feed: latest 20 events directly from raw clicks
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_live
  FROM (
    SELECT c.id, c.link_id, c.country, c.ua, c.is_bot, c.routed_to, c.created_at
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at > now() - interval '2 hours'
    ORDER BY c.created_at DESC
    LIMIT 20
  ) t;

  DROP TABLE _c;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'unique',           v_unique,
    'uniqueVisitors',   v_unique,
    'unique_ips',       v_unique,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb),
    '_sampledClicks',   v_sampled,
    '_sampleLimit',     v_sample_limit
  );
END
$function$;

-- Reduce cron batch size from 20 â†’ 10 (smoother DB load)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-analytics-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(10); $$
);


-- ==================== MIGRATION: 20260715064304_9387f9d1-c811-4b07-9d6b-c9ae5ed705b0.sql ====================
-- Restore missing columns on bot_fingerprints (production drift)
ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_bot_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_human_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS auto_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS last_ip text;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS last_ua text;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS last_country text;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Speed up auto-block lookups
CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_auto_blocked
  ON public.bot_fingerprints (auto_blocked)
  WHERE auto_blocked = true;

CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_updated_at
  ON public.bot_fingerprints (updated_at DESC);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715064434_91ddb0e2-55d4-4256-acd9-efc6ae185361.sql ====================
ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_bot_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_human_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_fingerprints TO authenticated;
GRANT ALL ON public.bot_fingerprints TO service_role;

-- ==================== MIGRATION: 20260715064754_d1722bd5-9128-457a-93fe-51b700353fb2.sql ====================
ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_bot_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_human_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_auto_blocked
  ON public.bot_fingerprints (auto_blocked)
  WHERE auto_blocked = true;

CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_bot_human_counts
  ON public.bot_fingerprints (is_bot_count DESC, is_human_count DESC);

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715065331_54b99d2f-e081-48b8-a31b-3e6cce0a985d.sql ====================
CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  v_link_ids uuid[];
  v_links jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_last60s bigint := 0;
  v_last5m bigint := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  SELECT array_agg(id),
         COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title)), '[]'::jsonb)
  INTO v_link_ids, v_links
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'last60s', 0,
      'cps5m', 0,
      'humans1h', 0,
      'bots1h', 0,
      'last24h', 0,
      'last24hHumans', 0,
      'last24hBots', 0,
      'links', '[]'::jsonb,
      'events', '[]'::jsonb,
      'countries', '[]'::jsonb,
      'cohorts', '[]'::jsonb
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '60 seconds'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '5 minutes'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = false),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last60s, v_last5m, v_humans1h, v_bots1h, v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= v_now - interval '24 hours';

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      c.id,
      c.link_id,
      l.short_code,
      l.title,
      c.country,
      c.ua,
      c.is_bot,
      c.routed_to,
      c.referer_host,
      c.bot_reason,
      c.created_at
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
      AND c.created_at >= v_now - interval '24 hours'
    ORDER BY c.created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(NULLIF(country, ''), '??')) AS code,
           COUNT(*)::bigint AS count,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= v_now - interval '24 hours'
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_cohorts
  FROM (
    SELECT source,
           COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM (
      SELECT is_bot,
        CASE
          WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
          WHEN lower(referer_host) LIKE '%facebook%' OR lower(referer_host) LIKE '%fb.%' THEN 'facebook'
          WHEN lower(referer_host) LIKE '%instagram%' THEN 'instagram'
          WHEN lower(referer_host) LIKE '%tiktok%' THEN 'tiktok'
          WHEN lower(referer_host) LIKE '%twitter%' OR lower(referer_host) LIKE '%x.com%' THEN 'twitter'
          WHEN lower(referer_host) LIKE '%youtube%' THEN 'youtube'
          WHEN lower(referer_host) LIKE '%google%' THEN 'google'
          WHEN lower(referer_host) LIKE '%bing%' THEN 'bing'
          WHEN lower(referer_host) LIKE '%reddit%' THEN 'reddit'
          WHEN lower(referer_host) LIKE '%telegram%' OR lower(referer_host) LIKE '%t.me%' THEN 'telegram'
          WHEN lower(referer_host) LIKE '%whatsapp%' THEN 'whatsapp'
          ELSE 'other'
        END AS source
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
        AND created_at >= v_now - interval '24 hours'
    ) s
    GROUP BY source
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', COALESCE(v_last60s, 0),
    'cps5m', COALESCE(v_last5m, 0),
    'humans1h', COALESCE(v_humans1h, 0),
    'bots1h', COALESCE(v_bots1h, 0),
    'last24h', COALESCE(v_last24h, 0),
    'last24hHumans', COALESCE(v_last24h_humans, 0),
    'last24hBots', COALESCE(v_last24h_bots, 0),
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_clicks_link_created_human_bot
  ON public.clicks (link_id, created_at DESC, is_bot);

CREATE INDEX IF NOT EXISTS idx_clicks_link_created_country
  ON public.clicks (link_id, created_at DESC, country);

CREATE INDEX IF NOT EXISTS idx_clicks_link_created_referer
  ON public.clicks (link_id, created_at DESC, referer_host);

-- ==================== MIGRATION: 20260715065443_134bebd0-68de-4074-99a4-cb100cb30266.sql ====================
CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  v_link_ids uuid[];
  v_links jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_last60s bigint := 0;
  v_last5m bigint := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id),
         COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title)), '[]'::jsonb)
  INTO v_link_ids, v_links
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'last60s', 0,
      'cps5m', 0,
      'humans1h', 0,
      'bots1h', 0,
      'last24h', 0,
      'last24hHumans', 0,
      'last24hBots', 0,
      'links', '[]'::jsonb,
      'events', '[]'::jsonb,
      'countries', '[]'::jsonb,
      'cohorts', '[]'::jsonb
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '60 seconds'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '5 minutes'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = false),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last60s, v_last5m, v_humans1h, v_bots1h, v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= v_now - interval '24 hours';

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      c.id,
      c.link_id,
      l.short_code,
      l.title,
      c.country,
      c.ua,
      c.is_bot,
      c.routed_to,
      c.referer_host,
      c.bot_reason,
      c.created_at
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
      AND c.created_at >= v_now - interval '24 hours'
    ORDER BY c.created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(NULLIF(country, ''), '??')) AS code,
           COUNT(*)::bigint AS count,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= v_now - interval '24 hours'
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_cohorts
  FROM (
    SELECT source,
           COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM (
      SELECT is_bot,
        CASE
          WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
          WHEN lower(referer_host) LIKE '%facebook%' OR lower(referer_host) LIKE '%fb.%' THEN 'facebook'
          WHEN lower(referer_host) LIKE '%instagram%' THEN 'instagram'
          WHEN lower(referer_host) LIKE '%tiktok%' THEN 'tiktok'
          WHEN lower(referer_host) LIKE '%twitter%' OR lower(referer_host) LIKE '%x.com%' THEN 'twitter'
          WHEN lower(referer_host) LIKE '%youtube%' THEN 'youtube'
          WHEN lower(referer_host) LIKE '%google%' THEN 'google'
          WHEN lower(referer_host) LIKE '%bing%' THEN 'bing'
          WHEN lower(referer_host) LIKE '%reddit%' THEN 'reddit'
          WHEN lower(referer_host) LIKE '%telegram%' OR lower(referer_host) LIKE '%t.me%' THEN 'telegram'
          WHEN lower(referer_host) LIKE '%whatsapp%' THEN 'whatsapp'
          ELSE 'other'
        END AS source
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
        AND created_at >= v_now - interval '24 hours'
    ) s
    GROUP BY source
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', COALESCE(v_last60s, 0),
    'cps5m', COALESCE(v_last5m, 0),
    'humans1h', COALESCE(v_humans1h, 0),
    'bots1h', COALESCE(v_bots1h, 0),
    'last24h', COALESCE(v_last24h, 0),
    'last24hHumans', COALESCE(v_last24h_humans, 0),
    'last24hBots', COALESCE(v_last24h_bots, 0),
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;

-- ==================== MIGRATION: 20260715065559_1959648f-5d5e-4d9e-8526-ea6c8831c9d6.sql ====================
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO service_role;

-- ==================== MIGRATION: 20260715070515_f7a7bf2d-f5d3-4d6b-a7a3-8dc257b7e37d.sql ====================
CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '5s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_links jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_last60s bigint := 0;
  v_last5m bigint := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id),
         COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title)), '[]'::jsonb)
  INTO v_link_ids, v_links
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'last60s', 0, 'cps5m', 0, 'humans1h', 0, 'bots1h', 0,
      'last24h', 0, 'last24hHumans', 0, 'last24hBots', 0,
      'links', '[]'::jsonb, 'events', '[]'::jsonb,
      'countries', '[]'::jsonb, 'cohorts', '[]'::jsonb
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '60 seconds'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '5 minutes'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = false),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last60s, v_last5m, v_humans1h, v_bots1h, v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= v_now - interval '24 hours';

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
      AND c.created_at >= v_now - interval '24 hours'
    ORDER BY c.created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(NULLIF(country, ''), '??')) AS code,
           COUNT(*)::bigint AS count,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= v_now - interval '24 hours'
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_cohorts
  FROM (
    SELECT source,
           COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM (
      SELECT is_bot,
        CASE
          WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
          WHEN lower(referer_host) LIKE '%facebook%' OR lower(referer_host) LIKE '%fb.%' THEN 'facebook'
          WHEN lower(referer_host) LIKE '%instagram%' THEN 'instagram'
          WHEN lower(referer_host) LIKE '%tiktok%' THEN 'tiktok'
          WHEN lower(referer_host) LIKE '%twitter%' OR lower(referer_host) LIKE '%x.com%' THEN 'twitter'
          WHEN lower(referer_host) LIKE '%youtube%' THEN 'youtube'
          WHEN lower(referer_host) LIKE '%google%' THEN 'google'
          WHEN lower(referer_host) LIKE '%bing%' THEN 'bing'
          WHEN lower(referer_host) LIKE '%reddit%' THEN 'reddit'
          WHEN lower(referer_host) LIKE '%telegram%' OR lower(referer_host) LIKE '%t.me%' THEN 'telegram'
          WHEN lower(referer_host) LIKE '%whatsapp%' THEN 'whatsapp'
          ELSE 'other'
        END AS source
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
        AND created_at >= v_now - interval '24 hours'
    ) s
    GROUP BY source
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', COALESCE(v_last60s, 0),
    'cps5m', COALESCE(v_last5m, 0),
    'humans1h', COALESCE(v_humans1h, 0),
    'bots1h', COALESCE(v_bots1h, 0),
    'last24h', COALESCE(v_last24h, 0),
    'last24hHumans', COALESCE(v_last24h_humans, 0),
    'last24hBots', COALESCE(v_last24h_bots, 0),
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715070628_c82f884a-a597-472a-836b-29401c7a1f21.sql ====================
NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715070917_e475a5ba-8e23-42f3-86f4-29b9e1d62e62.sql ====================
CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '5s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_links jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_last60s bigint := 0;
  v_last5m bigint := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id),
         COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title)), '[]'::jsonb)
  INTO v_link_ids, v_links
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'last60s', 0, 'cps5m', 0, 'humans1h', 0, 'bots1h', 0,
      'last24h', 0, 'last24hHumans', 0, 'last24hBots', 0,
      'links', '[]'::jsonb, 'events', '[]'::jsonb,
      'countries', '[]'::jsonb, 'cohorts', '[]'::jsonb
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '60 seconds'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '5 minutes'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = false),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last60s, v_last5m, v_humans1h, v_bots1h, v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= v_now - interval '24 hours';

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
      AND c.created_at >= v_now - interval '24 hours'
    ORDER BY c.created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(NULLIF(country, ''), '??')) AS code,
           COUNT(*)::bigint AS count,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= v_now - interval '24 hours'
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_cohorts
  FROM (
    SELECT source,
           COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM (
      SELECT is_bot,
        CASE
          WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
          WHEN lower(referer_host) LIKE '%facebook%' OR lower(referer_host) LIKE '%fb.%' THEN 'facebook'
          WHEN lower(referer_host) LIKE '%instagram%' THEN 'instagram'
          WHEN lower(referer_host) LIKE '%tiktok%' THEN 'tiktok'
          WHEN lower(referer_host) LIKE '%twitter%' OR lower(referer_host) LIKE '%x.com%' THEN 'twitter'
          WHEN lower(referer_host) LIKE '%youtube%' THEN 'youtube'
          WHEN lower(referer_host) LIKE '%google%' THEN 'google'
          WHEN lower(referer_host) LIKE '%bing%' THEN 'bing'
          WHEN lower(referer_host) LIKE '%reddit%' THEN 'reddit'
          WHEN lower(referer_host) LIKE '%telegram%' OR lower(referer_host) LIKE '%t.me%' THEN 'telegram'
          WHEN lower(referer_host) LIKE '%whatsapp%' THEN 'whatsapp'
          ELSE 'other'
        END AS source
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
        AND created_at >= v_now - interval '24 hours'
    ) s
    GROUP BY source
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', COALESCE(v_last60s, 0),
    'cps5m', COALESCE(v_last5m, 0),
    'humans1h', COALESCE(v_humans1h, 0),
    'bots1h', COALESCE(v_bots1h, 0),
    'last24h', COALESCE(v_last24h, 0),
    'last24hHumans', COALESCE(v_last24h_humans, 0),
    'last24hBots', COALESCE(v_last24h_bots, 0),
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_clicks_link_created_bot ON public.clicks (link_id, created_at DESC, is_bot);
CREATE INDEX IF NOT EXISTS idx_clicks_link_created_country ON public.clicks (link_id, created_at DESC, country);
CREATE INDEX IF NOT EXISTS idx_clicks_link_created_referer ON public.clicks (link_id, created_at DESC, referer_host);

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715071116_b526fbc3-49ec-447f-ad7e-16cefbef947d.sql ====================
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO sandbox_exec;
NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715071204_acc8293b-d3eb-4a52-a5a9-c43125f395b1.sql ====================
REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715072229_0b312d8d-60d2-4e66-9403-d2055b1b4f4c.sql ====================
-- Aggressive PostgREST schema cache bust for get_live_analytics_summary
-- DROP + CREATE forces PostgREST to fully re-discover the function

DROP FUNCTION IF EXISTS public.get_live_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '5s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_links jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_last60s bigint := 0;
  v_last5m bigint := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id),
         COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title)), '[]'::jsonb)
  INTO v_link_ids, v_links
  FROM public.links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('last60s',0,'cps5m',0,'humans1h',0,'bots1h',0,'last24h',0,'last24hHumans',0,'last24hBots',0,'links','[]'::jsonb,'events','[]'::jsonb,'countries','[]'::jsonb,'cohorts','[]'::jsonb);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '60 seconds'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '5 minutes'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = false),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last60s, v_last5m, v_humans1h, v_bots1h, v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_now - interval '24 hours';

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids) AND c.created_at >= v_now - interval '24 hours'
    ORDER BY c.created_at DESC LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(NULLIF(country, ''), '??')) AS code,
           COUNT(*)::bigint AS count,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_now - interval '24 hours'
    GROUP BY 1 ORDER BY count DESC LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_cohorts
  FROM (
    SELECT source, COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM (
      SELECT is_bot,
        CASE
          WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
          WHEN lower(referer_host) LIKE '%facebook%' OR lower(referer_host) LIKE '%fb.%' THEN 'facebook'
          WHEN lower(referer_host) LIKE '%instagram%' THEN 'instagram'
          WHEN lower(referer_host) LIKE '%tiktok%' THEN 'tiktok'
          WHEN lower(referer_host) LIKE '%twitter%' OR lower(referer_host) LIKE '%x.com%' THEN 'twitter'
          WHEN lower(referer_host) LIKE '%youtube%' THEN 'youtube'
          WHEN lower(referer_host) LIKE '%google%' THEN 'google'
          WHEN lower(referer_host) LIKE '%bing%' THEN 'bing'
          WHEN lower(referer_host) LIKE '%reddit%' THEN 'reddit'
          WHEN lower(referer_host) LIKE '%telegram%' OR lower(referer_host) LIKE '%t.me%' THEN 'telegram'
          WHEN lower(referer_host) LIKE '%whatsapp%' THEN 'whatsapp'
          ELSE 'other'
        END AS source
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids) AND created_at >= v_now - interval '24 hours'
    ) s GROUP BY source ORDER BY total DESC LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', COALESCE(v_last60s, 0),
    'cps5m', COALESCE(v_last5m, 0),
    'humans1h', COALESCE(v_humans1h, 0),
    'bots1h', COALESCE(v_bots1h, 0),
    'last24h', COALESCE(v_last24h, 0),
    'last24hHumans', COALESCE(v_last24h_humans, 0),
    'last24hBots', COALESCE(v_last24h_bots, 0),
    'links', v_links, 'events', v_events,
    'countries', v_countries, 'cohorts', v_cohorts
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM anon, public;

COMMENT ON FUNCTION public.get_live_analytics_summary(uuid) IS 'Live analytics summary v2 - schema cache bust';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ==================== MIGRATION: 20260715073457_69b12ea6-ab46-4ebf-a902-f13076750450.sql ====================
-- Drop ALL variants (any parameter shape) to clear stale cache entries
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_live_analytics_summary'
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- Recreate with clean signature
CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_last60s bigint := 0;
  v_cps5m numeric := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_links jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  SELECT array_agg(id) INTO v_link_ids FROM public.links WHERE user_id = _user_id;

  IF v_link_ids IS NULL THEN
    RETURN jsonb_build_object(
      'last60s',0,'cps5m',0,'humans1h',0,'bots1h',0,
      'last24h',0,'last24hHumans',0,'last24hBots',0,
      'links','[]'::jsonb,'events','[]'::jsonb,
      'countries','[]'::jsonb,'cohorts','[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'short_code',short_code,'title',title)),'[]'::jsonb)
    INTO v_links
  FROM (SELECT id, short_code, title FROM public.links WHERE user_id=_user_id ORDER BY created_at DESC LIMIT 200) l;

  SELECT COUNT(*) INTO v_last60s FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= now() - interval '60 seconds';

  SELECT COUNT(*)::numeric / 300.0 INTO v_cps5m FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= now() - interval '5 minutes';

  SELECT
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_humans1h, v_bots1h
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= now() - interval '1 hour';

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= now() - interval '24 hours';

  SELECT COALESCE(jsonb_agg(row_to_json(e)),'[]'::jsonb) INTO v_events FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c
    LEFT JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
    ORDER BY c.created_at DESC
    LIMIT 50
  ) e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', COALESCE(country,'??'),
    'count', cnt,
    'humans', humans,
    'bots', bots
  ) ORDER BY cnt DESC),'[]'::jsonb) INTO v_countries
  FROM (
    SELECT country,
           COUNT(*) AS cnt,
           COUNT(*) FILTER (WHERE is_bot=false) AS humans,
           COUNT(*) FILTER (WHERE is_bot=true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= now() - interval '24 hours'
    GROUP BY country
    ORDER BY cnt DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', src,
    'total', total,
    'humans', humans,
    'bots', bots
  ) ORDER BY total DESC),'[]'::jsonb) INTO v_cohorts
  FROM (
    SELECT
      CASE
        WHEN referer_host IS NULL OR referer_host='' THEN 'direct'
        WHEN referer_host ILIKE '%facebook%' OR referer_host ILIKE '%fb.%' THEN 'facebook'
        WHEN referer_host ILIKE '%instagram%' THEN 'instagram'
        WHEN referer_host ILIKE '%tiktok%' THEN 'tiktok'
        WHEN referer_host ILIKE '%google%' THEN 'google'
        WHEN referer_host ILIKE '%youtube%' THEN 'youtube'
        WHEN referer_host ILIKE '%twitter%' OR referer_host ILIKE '%x.com%' THEN 'twitter'
        ELSE 'other'
      END AS src,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_bot=false) AS humans,
      COUNT(*) FILTER (WHERE is_bot=true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= now() - interval '24 hours'
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', v_last60s,
    'cps5m', v_cps5m,
    'humans1h', v_humans1h,
    'bots1h', v_bots1h,
    'last24h', v_last24h,
    'last24hHumans', v_last24h_humans,
    'last24hBots', v_last24h_bots,
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END $function$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;

-- Double reload to force PostgREST cache refresh
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';


-- ==================== MIGRATION: 20260715074112_e876620d-b6f0-4dd0-94c6-9159938015d6.sql ====================
DROP FUNCTION IF EXISTS public.get_live_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
DECLARE
  v_link_ids uuid[];
  v_last60s bigint := 0;
  v_cps5m numeric := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_links jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  SELECT array_agg(id) INTO v_link_ids
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'last60s', 0,
      'cps5m', 0,
      'humans1h', 0,
      'bots1h', 0,
      'last24h', 0,
      'last24hHumans', 0,
      'last24hBots', 0,
      'links', '[]'::jsonb,
      'events', '[]'::jsonb,
      'countries', '[]'::jsonb,
      'cohorts', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_links
  FROM (
    SELECT id, short_code, title, created_at
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY created_at DESC
    LIMIT 200
  ) l;

  SELECT COUNT(*) INTO v_last60s
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '60 seconds';

  SELECT COUNT(*)::numeric / 300.0 INTO v_cps5m
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '5 minutes';

  SELECT
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_humans1h, v_bots1h
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '1 hour';

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '24 hours';

  SELECT COALESCE(jsonb_agg(row_to_json(e) ORDER BY e.created_at DESC), '[]'::jsonb)
    INTO v_events
  FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c
    LEFT JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
    ORDER BY c.created_at DESC
    LIMIT 50
  ) e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', COALESCE(country, '??'),
    'count', cnt,
    'humans', humans,
    'bots', bots
  ) ORDER BY cnt DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT country,
           COUNT(*) AS cnt,
           COUNT(*) FILTER (WHERE is_bot = false) AS humans,
           COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= now() - interval '24 hours'
    GROUP BY country
    ORDER BY cnt DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', src,
    'total', total,
    'humans', humans,
    'bots', bots
  ) ORDER BY total DESC), '[]'::jsonb)
    INTO v_cohorts
  FROM (
    SELECT
      CASE
        WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
        WHEN referer_host ILIKE '%facebook%' OR referer_host ILIKE '%fb.%' THEN 'facebook'
        WHEN referer_host ILIKE '%instagram%' THEN 'instagram'
        WHEN referer_host ILIKE '%tiktok%' THEN 'tiktok'
        WHEN referer_host ILIKE '%google%' THEN 'google'
        WHEN referer_host ILIKE '%youtube%' THEN 'youtube'
        WHEN referer_host ILIKE '%twitter%' OR referer_host ILIKE '%x.com%' THEN 'twitter'
        ELSE 'other'
      END AS src,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_bot = false) AS humans,
      COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= now() - interval '24 hours'
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', v_last60s,
    'cps5m', v_cps5m,
    'humans1h', v_humans1h,
    'bots1h', v_bots1h,
    'last24h', v_last24h,
    'last24hHumans', v_last24h_humans,
    'last24hBots', v_last24h_bots,
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END;
$$;

ALTER FUNCTION public.get_live_analytics_summary(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO sandbox_exec;

COMMENT ON FUNCTION public.get_live_analytics_summary(uuid) IS 'Fast live analytics summary for dashboard and live feed';

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- ==================== MIGRATION: 20260715074220_03887241-9d24-4b98-85f7-1b935c0d93be.sql ====================
REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO sandbox_exec;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- ==================== MIGRATION: 20260715075213_89166972-69b8-4581-aeaa-d796a32ffd38.sql ====================
-- Force API schema visibility for live analytics RPC and add a robust JSON fallback overload.

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_last60s bigint := 0;
  v_cps5m numeric := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_links jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  SELECT array_agg(id) INTO v_link_ids
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'last60s', 0,
      'cps5m', 0,
      'humans1h', 0,
      'bots1h', 0,
      'last24h', 0,
      'last24hHumans', 0,
      'last24hBots', 0,
      'links', '[]'::jsonb,
      'events', '[]'::jsonb,
      'countries', '[]'::jsonb,
      'cohorts', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_links
  FROM (
    SELECT id, short_code, title, created_at
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY created_at DESC
    LIMIT 200
  ) l;

  SELECT COUNT(*) INTO v_last60s
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '60 seconds';

  SELECT COUNT(*)::numeric / 300.0 INTO v_cps5m
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '5 minutes';

  SELECT
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_humans1h, v_bots1h
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '1 hour';

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '24 hours';

  SELECT COALESCE(jsonb_agg(row_to_json(e) ORDER BY e.created_at DESC), '[]'::jsonb)
    INTO v_events
  FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c
    LEFT JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
    ORDER BY c.created_at DESC
    LIMIT 50
  ) e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', COALESCE(country, '??'),
    'count', cnt,
    'humans', humans,
    'bots', bots
  ) ORDER BY cnt DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT country,
           COUNT(*) AS cnt,
           COUNT(*) FILTER (WHERE is_bot = false) AS humans,
           COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= now() - interval '24 hours'
    GROUP BY country
    ORDER BY cnt DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', src,
    'total', total,
    'humans', humans,
    'bots', bots
  ) ORDER BY total DESC), '[]'::jsonb)
    INTO v_cohorts
  FROM (
    SELECT
      CASE
        WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
        WHEN referer_host ILIKE '%facebook%' OR referer_host ILIKE '%fb.%' THEN 'facebook'
        WHEN referer_host ILIKE '%instagram%' THEN 'instagram'
        WHEN referer_host ILIKE '%tiktok%' THEN 'tiktok'
        WHEN referer_host ILIKE '%google%' THEN 'google'
        WHEN referer_host ILIKE '%youtube%' THEN 'youtube'
        WHEN referer_host ILIKE '%twitter%' OR referer_host ILIKE '%x.com%' THEN 'twitter'
        ELSE 'other'
      END AS src,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_bot = false) AS humans,
      COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= now() - interval '24 hours'
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', v_last60s,
    'cps5m', v_cps5m,
    'humans1h', v_humans1h,
    'bots1h', v_bots1h,
    'last24h', v_last24h,
    'last24hHumans', v_last24h_humans,
    'last24hBots', v_last24h_bots,
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_payload jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
  SELECT public.get_live_analytics_summary((_payload->>'_user_id')::uuid);
$function$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_live_analytics_summary(uuid) IS 'Live analytics summary RPC; refreshed 2026-07-15 to force API schema cache reload.';
COMMENT ON FUNCTION public.get_live_analytics_summary(jsonb) IS 'Fallback JSON overload for API schema parameter matching.';

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715075306_9cb6a72b-a825-4832-999e-4d1cc6ff48d3.sql ====================
-- Replace named jsonb fallback with an unnamed jsonb fallback so PostgREST can match the existing VPS body directly.

DROP FUNCTION IF EXISTS public.get_live_analytics_summary(_payload jsonb);
DROP FUNCTION IF EXISTS public.get_live_analytics_summary(jsonb);

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
  SELECT public.get_live_analytics_summary(($1->>'_user_id')::uuid);
$function$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_live_analytics_summary(jsonb) IS 'Unnamed JSON fallback for API schema-cache body matching.';

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260715142238_f35ceb02-be30-443b-8629-5f0de0589ecd.sql ====================

-- 1) Bump analytics cache refresh throughput: 10 -> 60 users/minute
SELECT cron.unschedule('refresh-analytics-cache');
SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(60); $$
);

-- 2) Improve _fast_analytics_summary: include real live counts (last24h, last60s, hourly, liveEvents)
-- so cache-miss users no longer see zeros for Live Traffic Snapshot.
CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '6s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_unique bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_hourly jsonb;
  v_live jsonb;
BEGIN
  SELECT
    COALESCE(array_agg(id), ARRAY[]::uuid[]),
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_link_ids, v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  -- Real live counts (indexed, fast)
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
      COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
    INTO v_last24, v_last24_humans, v_last60s
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at > now() - interval '24 hours';
  EXCEPTION WHEN OTHERS THEN
    v_last24 := 0; v_last24_humans := 0; v_last60s := 0;
  END;

  -- 24h hourly series (human clicks)
  BEGIN
    WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
    counts AS (
      SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
             COUNT(*) AS cnt
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
        AND NOT is_bot
        AND created_at > now() - interval '24 hours'
      GROUP BY 1
    )
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
      INTO v_hourly
    FROM buckets b
    LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);
  EXCEPTION WHEN OTHERS THEN
    v_hourly := NULL;
  END;

  -- Live events: latest 20
  BEGIN
    SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
      INTO v_live
    FROM (
      SELECT id, link_id, country, ua, is_bot, routed_to, created_at
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
      ORDER BY created_at DESC
      LIMIT 20
    ) t;
  EXCEPTION WHEN OTHERS THEN
    v_live := '[]'::jsonb;
  END;

  BEGIN
    SELECT COUNT(DISTINCT ip) INTO v_unique
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= (now() - (_days || ' days')::interval)
      AND is_bot = false
      AND ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  RETURN jsonb_build_object(
    'links', v_links,
    'total', v_total,
    'humans', v_humans,
    'bots', v_bots,
    'unique', v_unique,
    'uniqueVisitors', v_unique,
    'unique_ips', v_unique,
    'last24h', v_last24,
    'last24hHumans', v_last24_humans,
    'last60s', v_last60s,
    'offers', v_offers,
    'oursClicks', v_ours,
    'hourly', COALESCE(v_hourly, jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)),
    'heatmap', jsonb_build_array(
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
    ),
    'heatMax', 1,
    'countries', '[]'::jsonb,
    'devices', '[]'::jsonb,
    'browsers', '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons', '[]'::jsonb,
    'trafficSources', '[]'::jsonb,
    'topLinks', v_top_links,
    'liveEvents', COALESCE(v_live, '[]'::jsonb),
    '_fallback', true
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';


-- ==================== MIGRATION: 20260715143525_e4bea00f-78f2-4911-a267-6097c7ef5679.sql ====================
-- Raise refresh cap + make fast fallback truly fast (drop expensive COUNT DISTINCT ip)
-- and bump pg_cron batch to 200/min so all active users stay hot.

CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_hourly jsonb;
  v_live jsonb;
BEGIN
  SELECT
    COALESCE(array_agg(id), ARRAY[]::uuid[]),
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_link_ids, v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb) INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC LIMIT 6
  ) t;

  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
      COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
    INTO v_last24, v_last24_humans, v_last60s
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at > now() - interval '24 hours';
  EXCEPTION WHEN OTHERS THEN
    v_last24 := 0; v_last24_humans := 0; v_last60s := 0;
  END;

  BEGIN
    WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
    counts AS (
      SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago, COUNT(*) AS cnt
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at > now() - interval '24 hours'
      GROUP BY 1
    )
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket) INTO v_hourly
    FROM buckets b LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);
  EXCEPTION WHEN OTHERS THEN v_hourly := NULL; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_live
    FROM (
      SELECT id, link_id, country, ua, is_bot, routed_to, created_at
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
      ORDER BY created_at DESC LIMIT 20
    ) t;
  EXCEPTION WHEN OTHERS THEN v_live := '[]'::jsonb; END;

  RETURN jsonb_build_object(
    'links', v_links, 'total', v_total, 'humans', v_humans, 'bots', v_bots,
    'unique', 0, 'uniqueVisitors', 0, 'unique_ips', 0,
    'last24h', v_last24, 'last24hHumans', v_last24_humans, 'last60s', v_last60s,
    'offers', v_offers, 'oursClicks', v_ours,
    'hourly', COALESCE(v_hourly, jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)),
    'heatmap', jsonb_build_array(
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
    ),
    'heatMax', 1,
    'countries', '[]'::jsonb, 'devices', '[]'::jsonb, 'browsers', '[]'::jsonb,
    'operatingSystems', '[]'::jsonb, 'botReasons', '[]'::jsonb, 'trafficSources', '[]'::jsonb,
    'topLinks', v_top_links, 'liveEvents', COALESCE(v_live, '[]'::jsonb),
    '_fallback', true
  );
END $function$;

-- Raise refresh cap from 100 -> 500 per invocation
CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_unique bigint := 0;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
  v_cap int := GREATEST(1, LEAST(COALESCE(_limit, 20), 500));
BEGIN
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT v_cap
  LOOP
    BEGIN
      BEGIN
        v_data := public._compute_analytics_summary(v_user.user_id, 7);
      EXCEPTION WHEN OTHERS THEN
        v_data := public._fast_analytics_summary(v_user.user_id, 7)
          || jsonb_build_object('_refreshFallbackReason', SQLERRM);
      END;

      v_unique := COALESCE(
        CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
        CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
        0
      );
      v_data := v_data || jsonb_build_object('unique', v_unique, 'uniqueVisitors', v_unique, 'unique_ips', v_unique);

      UPDATE public.analytics_cache SET data = v_data, updated_at = now()
      WHERE user_id = v_user.user_id AND days = 7;

      IF NOT FOUND THEN
        BEGIN
          INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
          VALUES (v_user.user_id, 7, v_data, now());
        EXCEPTION WHEN unique_violation THEN
          UPDATE public.analytics_cache SET data = v_data, updated_at = now()
          WHERE user_id = v_user.user_id AND days = 7;
        END;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id, 'state', SQLSTATE, 'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true, 'refreshed', v_count, 'failed', v_failed,
    'errors', v_errors, 'limit', v_cap,
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END $function$;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO authenticated, service_role;

-- Bump pg_cron analytics refresh to 200 users/min
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'refresh-analytics-cache';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(200); $$
);

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260719061057_9dd782da-c9d3-48fe-8d9b-75e7c906f20d.sql ====================
-- 1) Lower staleness threshold from 2 min to 45s in refresher
CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_unique bigint := 0;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
  v_cap int := GREATEST(1, LEAST(COALESCE(_limit, 20), 800));
BEGIN
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL OR MIN(ac.updated_at) < now() - interval '45 seconds'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT v_cap
  LOOP
    BEGIN
      BEGIN
        v_data := public._compute_analytics_summary(v_user.user_id, 7);
      EXCEPTION WHEN OTHERS THEN
        v_data := public._fast_analytics_summary(v_user.user_id, 7)
          || jsonb_build_object('_refreshFallbackReason', SQLERRM);
      END;

      v_unique := COALESCE(
        CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
        CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
        0
      );
      v_data := v_data || jsonb_build_object('unique', v_unique, 'uniqueVisitors', v_unique, 'unique_ips', v_unique);

      UPDATE public.analytics_cache SET data = v_data, updated_at = now()
      WHERE user_id = v_user.user_id AND days = 7;

      IF NOT FOUND THEN
        BEGIN
          INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
          VALUES (v_user.user_id, 7, v_data, now());
        EXCEPTION WHEN unique_violation THEN
          UPDATE public.analytics_cache SET data = v_data, updated_at = now()
          WHERE user_id = v_user.user_id AND days = 7;
        END;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id, 'state', SQLSTATE, 'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true, 'refreshed', v_count, 'failed', v_failed,
    'errors', v_errors, 'limit', v_cap,
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END $function$;

-- 2) Bump cron job to process 500 users per minute (covers ~all active users each pass)
SELECT cron.unschedule('refresh-analytics-cache');
SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(500); $$
);

-- ==================== MIGRATION: 20260720181402_92fcfc6f-220a-45c1-bdd2-f3f705a63e41.sql ====================
-- ============================================================
-- Performance fix: dashboard + analytics cache load
-- 1) Cut refresh batch: 800 â†’ 150 (stops DB overload)
-- 2) Rewrite get_dashboard_stats to use daily_stats + sampled clicks
-- ============================================================

-- 1) LOWER CACHE REFRESH BATCH CAP (from 800 to 150)
CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_unique bigint := 0;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
  v_cap int := GREATEST(1, LEAST(COALESCE(_limit, 20), 150));  -- HARD CAP 150
  v_budget_ms int := 45000;  -- stop after 45s to leave headroom for next cron
BEGIN
  PERFORM set_config('statement_timeout', '60s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
      AND l.last_clicked_at > now() - interval '2 hours'  -- ONLY refresh recently-active users
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL OR MIN(ac.updated_at) < now() - interval '60 seconds'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT v_cap
  LOOP
    -- Time budget guard: stop if we've spent too long
    EXIT WHEN EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000 > v_budget_ms;

    BEGIN
      BEGIN
        v_data := public._compute_analytics_summary(v_user.user_id, 7);
      EXCEPTION WHEN OTHERS THEN
        v_data := public._fast_analytics_summary(v_user.user_id, 7)
          || jsonb_build_object('_refreshFallbackReason', SQLERRM);
      END;

      v_unique := COALESCE(
        CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
        CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
        0
      );
      v_data := v_data || jsonb_build_object('unique', v_unique, 'uniqueVisitors', v_unique, 'unique_ips', v_unique);

      UPDATE public.analytics_cache SET data = v_data, updated_at = now()
      WHERE user_id = v_user.user_id AND days = 7;

      IF NOT FOUND THEN
        BEGIN
          INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
          VALUES (v_user.user_id, 7, v_data, now());
        EXCEPTION WHEN unique_violation THEN
          UPDATE public.analytics_cache SET data = v_data, updated_at = now()
          WHERE user_id = v_user.user_id AND days = 7;
        END;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id, 'state', SQLSTATE, 'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true, 'refreshed', v_count, 'failed', v_failed,
    'errors', v_errors, 'limit', v_cap,
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END $function$;

-- 2) FAST DASHBOARD STATS
-- Old version scans 30 days of raw clicks + COUNT DISTINCT ip = 30M+ rows/call.
-- New version: aggregate from daily_stats (pre-aggregated) + sample for mobile%.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_since30 timestamptz := now() - interval '30 days';
  v_since7  timestamptz := now() - interval '7 days';
  v_clicks_by_day jsonb;
  v_country_stats jsonb;
  v_mobile_pct int := 0;
  v_unique_visitors bigint := 0;
  v_per_link_daily jsonb;
  v_mobile_total bigint;
  v_mobile_count bigint;
BEGIN
  SELECT array_agg(id) INTO v_link_ids FROM public.links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'clicksByDay', '{}'::jsonb,
      'countryStats', '{}'::jsonb,
      'mobilePct', 0,
      'uniqueVisitors', 0,
      'perLinkDaily', '{}'::jsonb
    );
  END IF;

  -- 30-day daily series: use daily_stats for old days + clicks only for TODAY
  WITH days AS (
    SELECT (now()::date - i) AS d FROM generate_series(0, 29) i
  ),
  today_clicks AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*)::bigint AS cnt
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot
      AND created_at >= (now()::date)::timestamptz
    GROUP BY 1
  ),
  ds_agg AS (
    SELECT day AS d, SUM(human_clicks)::bigint AS cnt
    FROM public.daily_stats
    WHERE link_id = ANY(v_link_ids)
      AND day >= v_since30::date AND day < now()::date
    GROUP BY 1
  ),
  combined AS (
    SELECT d, cnt FROM today_clicks
    UNION ALL
    SELECT d, cnt FROM ds_agg
  )
  SELECT jsonb_object_agg(to_char(d.d, 'YYYY-MM-DD'), COALESCE(a.cnt, 0))
    INTO v_clicks_by_day
  FROM days d LEFT JOIN (SELECT d, SUM(cnt) AS cnt FROM combined GROUP BY 1) a ON a.d = d.d;

  -- Country counts: use daily_stats only (skip today for speed)
  WITH ds_cty AS (
    SELECT key AS country, SUM(value::int)::bigint AS cnt
    FROM public.daily_stats, jsonb_each_text(country_breakdown)
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
    GROUP BY 1
  )
  SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt)
    INTO v_country_stats
  FROM ds_cty;

  -- Mobile percentage: 24h SAMPLED clicks (max 5000 rows)
  WITH sample AS (
    SELECT ua FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot
      AND created_at >= now() - interval '24 hours'
    LIMIT 5000
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile')
    INTO v_mobile_total, v_mobile_count
  FROM sample;

  IF v_mobile_total > 0 THEN
    v_mobile_pct := ROUND((v_mobile_count::numeric / v_mobile_total::numeric) * 100)::int;
  END IF;

  -- Unique visitors: LAST 7 DAYS ONLY (not 30d), skip COUNT DISTINCT ip scan
  BEGIN
    SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot AND ip IS NOT NULL
      AND created_at >= v_since7;
  EXCEPTION WHEN OTHERS THEN
    v_unique_visitors := 0;
  END;

  -- Per-link 7-day sparkline
  WITH days AS (
    SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i
  ),
  agg AS (
    SELECT link_id, (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*)::bigint AS cnt
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot
      AND created_at >= v_since7
    GROUP BY 1, 2
  ),
  per_link AS (
    SELECT l_id, jsonb_agg(COALESCE(a.cnt, 0) ORDER BY d.idx) AS arr
    FROM unnest(v_link_ids) l_id
    CROSS JOIN days d
    LEFT JOIN agg a ON a.link_id = l_id AND a.d = d.d
    GROUP BY l_id
  )
  SELECT jsonb_object_agg(l_id::text, arr) INTO v_per_link_daily FROM per_link;

  RETURN jsonb_build_object(
    'clicksByDay',    COALESCE(v_clicks_by_day, '{}'::jsonb),
    'countryStats',   COALESCE(v_country_stats, '{}'::jsonb),
    'mobilePct',      v_mobile_pct,
    'uniqueVisitors', v_unique_visitors,
    'perLinkDaily',   COALESCE(v_per_link_daily, '{}'::jsonb)
  );
END $function$;

-- ==================== MIGRATION: 20260720182107_7967f689-acd9-44c3-ac6e-14dda3828581.sql ====================

CREATE TABLE IF NOT EXISTS public.dashboard_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dashboard_cache TO authenticated;
GRANT ALL ON public.dashboard_cache TO service_role;

ALTER TABLE public.dashboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dashboard cache"
  ON public.dashboard_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_updated_at
  ON public.dashboard_cache(updated_at);


-- ==================== MIGRATION: 20260723173849_bffa8de8-726a-4404-a5ff-5acbb11e6d4c.sql ====================
CREATE INDEX IF NOT EXISTS idx_clicks_created_at_brin
  ON public.clicks USING brin (created_at);

CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '8s'
AS $function$
DECLARE
  v_since timestamptz := now() - interval '24 hours';
  v_today timestamptz := CURRENT_DATE;
  v_24h_total bigint := 0;
  v_24h_bots bigint := 0;
  v_24h_ours bigint := 0;
  v_24h_offer bigint := 0;
  v_today_clicks bigint := 0;
  v_total_links bigint := 0;
  v_active_links bigint := 0;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true),
    COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours'),
    COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer'),
    COUNT(*) FILTER (WHERE is_bot = false AND created_at >= v_today)
  INTO v_24h_total, v_24h_bots, v_24h_ours, v_24h_offer, v_today_clicks
  FROM public.clicks
  WHERE created_at >= v_since;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active = true)
  INTO v_total_links, v_active_links
  FROM public.links;

  RETURN jsonb_build_object(
    'total_clicks', v_24h_total,
    'total_bots',   v_24h_bots,
    'total_ours',   v_24h_ours,
    'total_offer',  v_24h_offer,
    'today_clicks', v_today_clicks,
    'total_links',  v_total_links,
    'active_links', v_active_links,
    'window',       '24h'
  );
END;
$function$;

-- ==================== MIGRATION: 20260723174333_977d611a-9fbf-4cd5-855b-35d145f6135c.sql ====================
CREATE INDEX IF NOT EXISTS idx_clicks_recent_cover
  ON public.clicks (created_at DESC)
  INCLUDE (is_bot, routed_to, country, bot_reason);

CREATE INDEX IF NOT EXISTS idx_clicks_bot_reason_created
  ON public.clicks (created_at DESC, bot_reason)
  WHERE is_bot = true;

CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  WITH traffic AS MATERIALIZED (
    SELECT
      COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
      COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours')::bigint AS ours,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer')::bigint AS offer,
      COUNT(*) FILTER (WHERE is_bot = false AND created_at >= CURRENT_DATE)::bigint AS today
    FROM public.clicks
    WHERE created_at >= now() - interval '24 hours'
  ), link_totals AS MATERIALIZED (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE is_active = true)::bigint AS active
    FROM public.links
  )
  SELECT jsonb_build_object(
    'total_clicks', traffic.humans,
    'total_bots', traffic.bots,
    'total_ours', traffic.ours,
    'total_offer', traffic.offer,
    'today_clicks', traffic.today,
    'total_links', link_totals.total,
    'active_links', link_totals.active,
    'window', '24h'
  )
  FROM traffic CROSS JOIN link_totals;
$function$;

CREATE OR REPLACE FUNCTION public.admin_bot_reasons(_hours integer DEFAULT 24, _limit integer DEFAULT 6)
RETURNS TABLE(key text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS key,
         COUNT(*)::bigint AS count
  FROM public.clicks
  WHERE is_bot = true
    AND created_at >= now() - make_interval(hours => GREATEST(1, LEAST(COALESCE(_hours, 24), 168)))
  GROUP BY 1
  ORDER BY count DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 6), 50));
$function$;

CREATE OR REPLACE FUNCTION public.admin_fb_blocked_count(_hours integer DEFAULT 24)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT COUNT(*)::bigint
  FROM public.clicks
  WHERE is_bot = true
    AND created_at >= now() - make_interval(hours => GREATEST(1, LEAST(COALESCE(_hours, 24), 168)))
    AND COALESCE(bot_reason, '') LIKE 'fb-%';
$function$;

CREATE OR REPLACE FUNCTION public.admin_top_countries(_days integer DEFAULT 7, _limit integer DEFAULT 12)
RETURNS TABLE(country text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT COALESCE(NULLIF(country, ''), '??') AS country,
         COUNT(*)::bigint AS count
  FROM public.clicks
  WHERE created_at >= now() - make_interval(days => GREATEST(1, LEAST(COALESCE(_days, 7), 31)))
  GROUP BY 1
  ORDER BY count DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 12), 50));
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_bot_reasons(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_fb_blocked_count(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_countries(integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260723174423_07adef5e-085b-43b4-9001-497fae670889.sql ====================
REVOKE ALL ON FUNCTION public.get_admin_overview_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_bot_reasons(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_fb_blocked_count(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_top_countries(integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_bot_reasons(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_fb_blocked_count(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_countries(integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ==================== MIGRATION: 20260723183052_003aae32-dfc8-4118-a65b-e1561c47a829.sql ====================

-- 1) Hourly stats cache (single-row) â€” replaces expensive 9s query
CREATE TABLE IF NOT EXISTS public.hourly_stats_cache (
  id boolean PRIMARY KEY DEFAULT true,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hourly_stats_singleton CHECK (id = true)
);
GRANT SELECT ON public.hourly_stats_cache TO authenticated, anon;
GRANT ALL ON public.hourly_stats_cache TO service_role;
ALTER TABLE public.hourly_stats_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hourly_stats_read" ON public.hourly_stats_cache;
CREATE POLICY "hourly_stats_read" ON public.hourly_stats_cache FOR SELECT USING (true);

-- 2) Refresher (writes cache); heavy scan runs in background only
CREATE OR REPLACE FUNCTION public.refresh_hourly_stats_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.hourly_stats_cache (id, stats, updated_at)
  VALUES (
    true,
    (SELECT jsonb_build_object(
      'total', COUNT(*),
      'humans', COUNT(*) FILTER (WHERE is_bot = false),
      'bots', COUNT(*) FILTER (WHERE is_bot = true),
      'offer', COUNT(*) FILTER (WHERE routed_to = 'offer'),
      'fb_article', COUNT(*) FILTER (WHERE routed_to = 'fb-article'),
      'safe', COUNT(*) FILTER (WHERE routed_to = 'safe'),
      'ours', COUNT(*) FILTER (WHERE routed_to = 'ours'),
      'fb', COUNT(*) FILTER (WHERE routed_to = 'fb')
     ) FROM public.clicks WHERE created_at >= now() - interval '1 hour'),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET stats = EXCLUDED.stats, updated_at = EXCLUDED.updated_at;
END;
$$;

-- 3) Rewrite hot function to read cache (0.5ms instead of 9s). Refresh cache lazily if >60s stale.
CREATE OR REPLACE FUNCTION public.get_last_hour_click_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT stats, updated_at INTO r FROM public.hourly_stats_cache WHERE id = true;
  IF r.stats IS NULL THEN
    RETURN jsonb_build_object('total',0,'humans',0,'bots',0,'offer',0,'fb_article',0,'safe',0,'ours',0,'fb',0,'stale',true);
  END IF;
  RETURN r.stats || jsonb_build_object('cache_age_sec', EXTRACT(EPOCH FROM (now() - r.updated_at))::int);
END;
$$;

-- 4) Cron: refresh hourly stats every 30s + dashboard_cache every 2 min (previous job broke)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-hourly-stats');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-dashboard-cache-all');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('refresh-hourly-stats', '30 seconds', $$SELECT public.refresh_hourly_stats_cache();$$);

-- 5) Kick once now so cache is fresh immediately
SELECT public.refresh_hourly_stats_cache();


-- ==================== MIGRATION: 20260724050551_dda26a13-fb15-45a9-a984-8f53b2f26d33.sql ====================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_domains TO authenticated; GRANT ALL ON public.custom_domains TO service_role;

-- ==================== MIGRATION: 20260727073022_1b155331-d796-4f00-8cad-1755b847221e.sql ====================
CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '20s'
AS $function$
DECLARE
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  WITH parsed AS (
    SELECT
      CASE
        WHEN COALESCE(e->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (e->>'id')::uuid
        ELSE gen_random_uuid()
      END AS event_id,
      (e->>'link_id')::uuid AS link_id,
      NULLIF(e->>'ip', '') AS ip,
      NULLIF(e->>'country', '') AS country,
      NULLIF(e->>'ua', '') AS ua,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      NULLIF(e->>'bot_reason', '') AS bot_reason,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to,
      NULLIF(e->>'utm_source', '') AS utm_source,
      NULLIF(e->>'utm_medium', '') AS utm_medium,
      NULLIF(e->>'utm_campaign', '') AS utm_campaign,
      NULLIF(e->>'utm_term', '') AS utm_term,
      NULLIF(e->>'utm_content', '') AS utm_content,
      NULLIF(e->>'referer_host', '') AS referer_host,
      CASE WHEN COALESCE(e->>'bot_score', '') ~ '^-?\d+$' THEN (e->>'bot_score')::integer ELSE 0 END AS bot_score,
      COALESCE(e->'signals', '{}'::jsonb) AS signals,
      COALESCE((e->>'challenge_passed')::boolean, false) AS challenge_passed
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.*
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  ), inserted AS (
    INSERT INTO public.clicks (
      id, link_id, ip, country, ua, is_bot, bot_reason, routed_to,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referer_host, bot_score, signals, challenge_passed
    )
    SELECT
      event_id, link_id, ip, country, ua, is_bot, bot_reason, routed_to,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referer_host, bot_score, signals, challenge_passed
    FROM valid
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_inserted_ids
  FROM inserted;

  IF COALESCE(cardinality(v_inserted_ids), 0) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT link_id, COUNT(*)::integer AS n
    FROM public.clicks
    WHERE id = ANY(v_inserted_ids) AND is_bot = true
    GROUP BY link_id
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.links l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.n,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at = now()
  FROM (
    SELECT
      link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n,
      COUNT(*) FILTER (WHERE routed_to = 'offer')::integer AS offer_n
    FROM public.clicks
    WHERE id = ANY(v_inserted_ids) AND is_bot = false
    GROUP BY link_id
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.profiles p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.n,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_n
  FROM (
    SELECT
      l.user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE c.routed_to = 'ours')::integer AS ours_n
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE c.id = ANY(v_inserted_ids)
      AND c.is_bot = false
      AND l.user_id IS NOT NULL
    GROUP BY l.user_id
  ) AS s
  WHERE p.id = s.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role;

-- ==================== MIGRATION: 20260728173100_7cd27c4f-366d-457f-bd40-c54a22ac8f19.sql ====================
CREATE OR REPLACE FUNCTION public.aggregate_daily_stats(_days integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := (now()::date - GREATEST(0, LEAST(COALESCE(_days, 3), 30)));
  v_rows int := 0;
  v_locked boolean;
BEGIN
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);

  v_locked := pg_try_advisory_lock(hashtext('aggregate_daily_stats'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  WITH src AS (
    SELECT
      c.link_id,
      (c.created_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*) FILTER (WHERE NOT c.is_bot) AS humans,
      COUNT(*) FILTER (WHERE c.is_bot) AS bots
    FROM public.clicks c
    WHERE c.created_at >= v_from::timestamptz
    GROUP BY 1, 2
  ),
  cty AS (
    SELECT
      c.link_id,
      (c.created_at AT TIME ZONE 'UTC')::date AS day,
      jsonb_object_agg(c.country, n) AS breakdown
    FROM (
      SELECT link_id, created_at, country, COUNT(*) AS n
      FROM public.clicks
      WHERE created_at >= v_from::timestamptz
        AND country IS NOT NULL AND country <> ''
      GROUP BY link_id, created_at, country
    ) c
    GROUP BY 1, 2
  ),
  merged AS (
    SELECT s.link_id, s.day, s.humans, s.bots,
           COALESCE(x.breakdown, '{}'::jsonb) AS breakdown
    FROM src s
    LEFT JOIN (
      SELECT link_id, day,
             (SELECT jsonb_object_agg(k, v) FROM (
                SELECT key AS k, SUM(value::bigint) AS v
                FROM jsonb_each_text(jsonb_agg_strip.b)
                GROUP BY key
             ) z) AS breakdown
      FROM (
        SELECT link_id, day, jsonb_object_agg(country, n) AS b
        FROM (
          SELECT link_id,
                 (created_at AT TIME ZONE 'UTC')::date AS day,
                 country,
                 COUNT(*) AS n
          FROM public.clicks
          WHERE created_at >= v_from::timestamptz
            AND country IS NOT NULL AND country <> ''
          GROUP BY 1, 2, 3
        ) q
        GROUP BY link_id, day
      ) jsonb_agg_strip
    ) x ON x.link_id = s.link_id AND x.day = s.day
  ),
  ups AS (
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks, country_breakdown, device_breakdown)
    SELECT link_id, day, humans, bots, breakdown, '{}'::jsonb
    FROM merged
    ON CONFLICT (link_id, day) DO UPDATE SET
      human_clicks = EXCLUDED.human_clicks,
      bot_clicks = EXCLUDED.bot_clicks,
      country_breakdown = EXCLUDED.country_breakdown
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rows FROM ups;

  PERFORM pg_advisory_unlock(hashtext('aggregate_daily_stats'));

  RETURN jsonb_build_object('ok', true, 'rows', v_rows, 'from', v_from, 'at', now());
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('aggregate_daily_stats'));
  END IF;
  RAISE;
END
$function$;

GRANT EXECUTE ON FUNCTION public.aggregate_daily_stats(integer) TO service_role;

SELECT cron.unschedule('daily-click-aggregate')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-click-aggregate');

SELECT cron.schedule(
  'daily-click-aggregate',
  '7 * * * *',
  $$SELECT public.aggregate_daily_stats(3);$$
);

SELECT public.aggregate_daily_stats(7);

NOTIFY pgrst, 'reload schema';

-- ==================== SCHEMA REPAIR & DOMAIN SEED ====================
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS destination_url text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_url text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_direct_link text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS safe_url text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS short_code text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS custom_domain text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS domain_id uuid;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS clicks_count integer DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS human_clicks_count integer DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS bot_clicks_count integer DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS blocked_countries text[] DEFAULT '{US}';

CREATE TABLE IF NOT EXISTS public.shared_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.shared_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active shared domains" ON public.shared_domains;
CREATE POLICY "Public can view active shared domains" ON public.shared_domains FOR SELECT USING (true);

INSERT INTO public.shared_domains (domain, is_active, is_default)
VALUES
  ('adswapx.com', true, true),
  ('linkfly.link', true, false),
  ('pxclick.me', true, false),
  ('urlshift.co', true, false)
ON CONFLICT (domain) DO UPDATE SET is_active = true;

NOTIFY pgrst, 'reload schema';

-- Seed platform adsterra rotation settings (900 user / 100 platform)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true,
  our_adsterra_url text,
  fallback_url text,
  injection_threshold integer DEFAULT 900,
  injection_count integer DEFAULT 100,
  traffic_split_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.app_settings (id, our_adsterra_url, fallback_url, injection_threshold, injection_count, traffic_split_enabled)
VALUES (true, 'https://holylocusturtle.com/qcun05ba52?key=627eae6ba72f008dc083888e50aa1c5f', 'https://holylocusturtle.com/qcun05ba52?key=627eae6ba72f008dc083888e50aa1c5f', 900, 100, true)
ON CONFLICT (id) DO UPDATE SET
  our_adsterra_url = 'https://holylocusturtle.com/qcun05ba52?key=627eae6ba72f008dc083888e50aa1c5f',
  fallback_url = 'https://holylocusturtle.com/qcun05ba52?key=627eae6ba72f008dc083888e50aa1c5f',
  injection_threshold = 900,
  injection_count = 100,
  traffic_split_enabled = true;

NOTIFY pgrst, 'reload schema';

-- ==================== FULL CORE TABLES INTEGRITY PATCH ====================

-- 1. Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  network text NOT NULL,
  address text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own wallets" ON public.wallets;
CREATE POLICY "Users view own wallets" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own wallets" ON public.wallets;
CREATE POLICY "Users insert own wallets" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own wallets" ON public.wallets;
CREATE POLICY "Users delete own wallets" ON public.wallets FOR DELETE USING (auth.uid() = user_id);

-- 2. Withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  network text NOT NULL,
  address text NOT NULL,
  amount numeric(12,2) NOT NULL,
  visits_consumed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users request withdrawals" ON public.withdrawals;
CREATE POLICY "Users request withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all withdrawals" ON public.withdrawals;
CREATE POLICY "Admins view all withdrawals" ON public.withdrawals FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Support Tickets & Messages
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own tickets" ON public.support_tickets;
CREATE POLICY "Users view own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own tickets" ON public.support_tickets;
CREATE POLICY "Users insert own tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins manage all tickets" ON public.support_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_admin boolean DEFAULT false,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own ticket messages" ON public.support_messages;
CREATE POLICY "Users view own ticket messages" ON public.support_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_tickets WHERE id = support_messages.ticket_id AND user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users insert own ticket messages" ON public.support_messages;
CREATE POLICY "Users insert own ticket messages" ON public.support_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);
DROP POLICY IF EXISTS "Admins manage all messages" ON public.support_messages;
CREATE POLICY "Admins manage all messages" ON public.support_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Broadcasts & Read state
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  icon text DEFAULT 'sparkles',
  tone text DEFAULT 'premium',
  is_active boolean DEFAULT true,
  show_as_popup boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active broadcasts" ON public.broadcasts;
CREATE POLICY "Public can view active broadcasts" ON public.broadcasts FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage broadcasts" ON public.broadcasts;
CREATE POLICY "Admins manage broadcasts" ON public.broadcasts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid REFERENCES public.broadcasts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(broadcast_id, user_id)
);
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own broadcast reads" ON public.broadcast_reads;
CREATE POLICY "Users view own broadcast reads" ON public.broadcast_reads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users mark broadcast read" ON public.broadcast_reads;
CREATE POLICY "Users mark broadcast read" ON public.broadcast_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

-- Fix NOT NULL constraint on links columns
ALTER TABLE public.links ALTER COLUMN adsterra_url DROP NOT NULL;
ALTER TABLE public.links ALTER COLUMN destination_url DROP NOT NULL;
ALTER TABLE public.links ALTER COLUMN adsterra_direct_link DROP NOT NULL;
ALTER TABLE public.links ALTER COLUMN status DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Bulletproof handle_new_user trigger that never blocks auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS 
DECLARE
  v_email text;
  v_name text;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1));
  IF v_name IS NULL OR v_name = '' THEN
    v_name := 'User';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, plan_slug, is_banned)
  VALUES (NEW.id, v_email, v_name, 'free', false)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user non-blocking exception for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure profiles and user_roles have open permissive RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

NOTIFY pgrst, 'reload schema';

-- Fix foreign key constraints on profiles and user_roles to prevent aborting transactions
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

NOTIFY pgrst, 'reload schema';

-- ==================== FIX INFINITE RECURSION & PERMISSIONS ====================

-- 1. Security Definer helper for role checks (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS \$\$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = role_name
  );
\$\$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, service_role;

-- 2. user_roles RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role manages roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. app_settings RLS & grants
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;

CREATE POLICY "Public can view app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage app_settings" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 4. withdrawals RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users request withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Admins view all withdrawals" ON public.withdrawals;

CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users request withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all withdrawals" ON public.withdrawals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 5. support_tickets RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users insert own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets;

CREATE POLICY "Users view own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all tickets" ON public.support_tickets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 6. broadcasts RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "Admins manage broadcasts" ON public.broadcasts;

CREATE POLICY "Public can view active broadcasts" ON public.broadcasts FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage broadcasts" ON public.broadcasts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 7. Grant schema privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT SELECT ON public.shared_domains, public.app_settings, public.broadcasts, public.profiles TO anon;

NOTIFY pgrst, 'reload schema';
