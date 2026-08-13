
ALTER VIEW public.cohort_stats SET (security_invoker = on);
ALTER VIEW public.country_stats_24h SET (security_invoker = on);

-- Restrict access to these views to admins only (they aggregate across all users)
REVOKE ALL ON public.cohort_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.country_stats_24h FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cohort_stats TO authenticated;
GRANT SELECT ON public.country_stats_24h TO authenticated;
