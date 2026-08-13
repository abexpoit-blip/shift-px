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