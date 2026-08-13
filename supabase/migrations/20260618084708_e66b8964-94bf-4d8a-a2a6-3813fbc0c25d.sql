REVOKE UPDATE, DELETE ON public.upgrade_requests FROM authenticated;

DROP POLICY IF EXISTS "Users can manage own upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Users create own upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Users view own upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Admins view all upgrade requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Admins update upgrade requests" ON public.upgrade_requests;

CREATE POLICY "Users create own upgrade requests"
ON public.upgrade_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users view own upgrade requests"
ON public.upgrade_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all upgrade requests"
ON public.upgrade_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update upgrade requests"
ON public.upgrade_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can insert signup attempts" ON public.signup_attempts;
CREATE POLICY "Service role can insert signup attempts"
ON public.signup_attempts
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert error logs" ON public.error_logs;
CREATE POLICY "Service role can insert error logs"
ON public.error_logs
FOR INSERT
TO service_role
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloaking_rules TO authenticated;
DROP POLICY IF EXISTS "Admins can manage cloaking rules" ON public.cloaking_rules;
CREATE POLICY "Admins can manage cloaking rules"
ON public.cloaking_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));