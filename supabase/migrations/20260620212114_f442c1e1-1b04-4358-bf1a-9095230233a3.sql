DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='analytics_cache' AND column_name='payload'
  ) THEN
    EXECUTE 'ALTER TABLE public.analytics_cache ALTER COLUMN payload DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.analytics_cache ALTER COLUMN payload SET DEFAULT ''{}''::jsonb';
    EXECUTE 'UPDATE public.analytics_cache SET payload = ''{}''::jsonb WHERE payload IS NULL';
  END IF;
END $$;