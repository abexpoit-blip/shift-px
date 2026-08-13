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