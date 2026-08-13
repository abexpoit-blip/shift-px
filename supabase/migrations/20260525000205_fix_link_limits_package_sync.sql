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
  IF NEW.email = 'admin@sleepox.com' THEN
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
