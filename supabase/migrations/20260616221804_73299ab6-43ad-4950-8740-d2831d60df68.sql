ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON public.profiles (last_login_at);