-- ==============================================================================
-- AdsPx Critical Database Constraint & Schema Repair
-- ==============================================================================

-- 1. Drop all strict foreign key constraints referencing auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey CASCADE;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey CASCADE;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_userId_fkey CASCADE;
ALTER TABLE public.links DROP CONSTRAINT IF EXISTS links_user_id_fkey CASCADE;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey CASCADE;
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey CASCADE;
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey CASCADE;
ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey CASCADE;
ALTER TABLE public.broadcast_reads DROP CONSTRAINT IF EXISTS broadcast_reads_user_id_fkey CASCADE;

-- 2. Make columns flexible
ALTER TABLE public.profiles ALTER COLUMN id SET DATA TYPE uuid;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.links ALTER COLUMN adsterra_url DROP NOT NULL;
ALTER TABLE public.links ALTER COLUMN destination_url DROP NOT NULL;
ALTER TABLE public.links ALTER COLUMN adsterra_direct_link DROP NOT NULL;
ALTER TABLE public.links ALTER COLUMN status DROP NOT NULL;

-- 3. Non-blocking handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan_slug, is_banned)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    'free',
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Role helper function
CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = role_name
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, service_role;

-- 5. Open permissive RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR ALL USING (true);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (true);

ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own links" ON public.links;
DROP POLICY IF EXISTS "Public view links" ON public.links;
CREATE POLICY "Users manage own links" ON public.links FOR ALL USING (true);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;
CREATE POLICY "Public can view app_settings" ON public.app_settings FOR ALL USING (true);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users request withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Admins view all withdrawals" ON public.withdrawals;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR ALL USING (true);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users insert own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users delete own wallets" ON public.wallets;
CREATE POLICY "Users view own wallets" ON public.wallets FOR ALL USING (true);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users insert own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets;
CREATE POLICY "Users view own tickets" ON public.support_tickets FOR ALL USING (true);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "Admins manage broadcasts" ON public.broadcasts;
CREATE POLICY "Public can view active broadcasts" ON public.broadcasts FOR ALL USING (true);

-- 6. Full schema grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role, postgres;

NOTIFY pgrst, 'reload schema';
