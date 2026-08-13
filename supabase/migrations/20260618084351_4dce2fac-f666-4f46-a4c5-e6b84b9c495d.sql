REVOKE SELECT ON public.app_settings FROM anon;
REVOKE SELECT ON public.bot_rules FROM anon, authenticated;
REVOKE SELECT ON public.cloaking_rules FROM anon, authenticated;
REVOKE SELECT ON public.referrer_rules FROM anon, authenticated;
REVOKE SELECT ON public.bot_fingerprints FROM anon, authenticated;
REVOKE SELECT ON public.blocked_email_domains FROM anon, authenticated;
REVOKE SELECT ON public.daily_stats FROM anon;

DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can view active bot rules" ON public.bot_rules;
DROP POLICY IF EXISTS "Anyone can view active cloaking rules" ON public.cloaking_rules;
DROP POLICY IF EXISTS "Anyone can view active referrer rules" ON public.referrer_rules;
DROP POLICY IF EXISTS "Anyone can view bot fingerprints" ON public.bot_fingerprints;
DROP POLICY IF EXISTS "anyone can read blocked domains" ON public.blocked_email_domains;
DROP POLICY IF EXISTS "Anyone can view daily stats" ON public.daily_stats;

CREATE POLICY "Admins can view app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view bot rules"
ON public.bot_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view cloaking rules"
ON public.cloaking_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view referrer rules"
ON public.referrer_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view bot fingerprints"
ON public.bot_fingerprints
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view blocked email domains"
ON public.blocked_email_domains
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view daily stats for own links"
ON public.daily_stats
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.links
    WHERE links.id = daily_stats.link_id
      AND links.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);