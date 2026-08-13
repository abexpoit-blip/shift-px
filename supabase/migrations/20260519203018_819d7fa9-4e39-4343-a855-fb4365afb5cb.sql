-- Delete the old admin user (clicktaka@mailum.com) completely.
-- New admin admin@sleepox.com remains intact.
DELETE FROM public.user_roles WHERE user_id = '0cde9c89-dedf-4a09-88e8-178552f75872';
DELETE FROM public.profiles WHERE id = '0cde9c89-dedf-4a09-88e8-178552f75872';
DELETE FROM auth.users WHERE id = '0cde9c89-dedf-4a09-88e8-178552f75872';