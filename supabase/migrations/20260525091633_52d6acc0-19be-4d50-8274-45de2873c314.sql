
CREATE OR REPLACE FUNCTION public.shortener_domains_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
