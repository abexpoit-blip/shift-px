-- Owner-safe Sleepox self-host auth repair.
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
  v_role public.app_role := CASE WHEN lower(COALESCE(NEW.email, ''))='admin@sleepox.com' THEN 'admin'::public.app_role ELSE 'user'::public.app_role END;
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
  RAISE LOG 'Sleepox signup trigger failed id=% email=% error=% state=%', NEW.id, v_email, SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name, plan_slug, click_quota, link_limit)
SELECT u.id, lower(u.email), COALESCE(u.raw_user_meta_data->>'full_name', split_part(lower(u.email),'@',1)),
       CASE WHEN lower(u.email)='admin@sleepox.com' THEN 'lifetime' ELSE 'free' END,
       CASE WHEN lower(u.email)='admin@sleepox.com' THEN NULL ELSE 10000 END,
       CASE WHEN lower(u.email)='admin@sleepox.com' THEN NULL ELSE 1 END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, CASE WHEN lower(u.email)='admin@sleepox.com' THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='telegram') AS telegram_column_ok,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created') AS trigger_ok,
  (SELECT COUNT(*) FROM auth.users) AS users,
  (SELECT COUNT(*) FROM public.profiles) AS profiles,
  (SELECT COUNT(*) FROM public.user_roles) AS roles;
