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