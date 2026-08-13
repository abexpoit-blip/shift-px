-- Backfill admin role for admin@adspx.com (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email = 'admin@adspx.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Upgrade their profile to unlimited
UPDATE public.profiles
   SET plan_slug = 'unlimited',
       click_quota = NULL,
       link_limit = 100
 WHERE email = 'admin@adspx.com';