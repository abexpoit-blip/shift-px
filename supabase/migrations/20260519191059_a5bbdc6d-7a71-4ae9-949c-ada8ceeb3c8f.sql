
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
