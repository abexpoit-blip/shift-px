ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.daily_stats TO anon, authenticated, service_role;
CREATE POLICY "Anyone can view daily stats" ON public.daily_stats FOR SELECT USING (true);