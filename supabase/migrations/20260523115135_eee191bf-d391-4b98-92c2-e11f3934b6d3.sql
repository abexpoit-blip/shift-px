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
  IF NEW.email = 'admin@sleepox.com' THEN v_role := 'admin'; END IF;
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