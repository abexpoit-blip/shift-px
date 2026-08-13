ALTER FUNCTION public.get_analytics_summary(uuid, integer) SET statement_timeout = '60s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_cohort_retention') THEN
    EXECUTE 'ALTER FUNCTION public.get_cohort_retention SET statement_timeout = ''60s''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_link_drilldown') THEN
    EXECUTE 'ALTER FUNCTION public.get_link_drilldown SET statement_timeout = ''60s''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_live_feed') THEN
    EXECUTE 'ALTER FUNCTION public.get_live_feed SET statement_timeout = ''30s''';
  END IF;
END $$;