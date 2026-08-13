-- Repair older self-hosted analytics_cache tables that existed before the (user_id, days) key.
-- Keep the newest cache row per user/day, then add the unique key required by ON CONFLICT.

DELETE FROM public.analytics_cache a
USING public.analytics_cache b
WHERE a.user_id = b.user_id
  AND a.days = b.days
  AND a.ctid < b.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'analytics_cache'
      AND i.indisunique
      AND i.indkey::text = (
        SELECT string_agg(attnum::text, ' ' ORDER BY attnum)
        FROM pg_attribute
        WHERE attrelid = t.oid
          AND attname IN ('user_id', 'days')
      )
  ) THEN
    CREATE UNIQUE INDEX analytics_cache_user_id_days_uidx
      ON public.analytics_cache (user_id, days);
  END IF;
END $$;