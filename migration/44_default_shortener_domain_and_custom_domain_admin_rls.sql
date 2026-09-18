-- Migration 44: Set dovtv.com as primary default shortener domain and add Admin RLS policies for custom_domains

-- 1. Ensure dovtv.com exists and is primary in shortener_domains table
INSERT INTO public.shortener_domains (domain, is_primary, is_active)
VALUES ('dovtv.com', true, true)
ON CONFLICT (domain) DO UPDATE SET is_primary = true, is_active = true;

-- 2. Ensure adswapx.com is secondary active domain
INSERT INTO public.shortener_domains (domain, is_primary, is_active)
VALUES ('adswapx.com', false, true)
ON CONFLICT (domain) DO UPDATE SET is_primary = false, is_active = true;

-- 3. Ensure all other domains are not primary
UPDATE public.shortener_domains
SET is_primary = false
WHERE domain != 'dovtv.com';

-- 4. Admin RLS policies on custom_domains so admins can view/manage all user custom domains
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'custom_domains' AND policyname = 'Admins can view all custom domains'
  ) THEN
    CREATE POLICY "Admins can view all custom domains" ON public.custom_domains
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'custom_domains' AND policyname = 'Admins can delete any custom domain'
  ) THEN
    CREATE POLICY "Admins can delete any custom domain" ON public.custom_domains
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'custom_domains' AND policyname = 'Admins can update any custom domain'
  ) THEN
    CREATE POLICY "Admins can update any custom domain" ON public.custom_domains
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
      );
  END IF;
END $$;
