DROP POLICY IF EXISTS as_read_auth ON public.app_settings;
UPDATE storage.buckets SET public = false WHERE id = 'migration-temp';