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