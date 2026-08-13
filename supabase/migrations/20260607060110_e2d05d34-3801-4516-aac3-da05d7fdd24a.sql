GRANT ALL ON public.app_settings TO service_role;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;

-- Drop existing update policy if it somehow exists but is broken
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );