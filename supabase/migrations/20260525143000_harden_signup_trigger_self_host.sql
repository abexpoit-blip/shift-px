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
  IF v_email = 'admin@sleepox.com' THEN
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
