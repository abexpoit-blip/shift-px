-- 1. Search for Nasim or 19OTC in links
SELECT id, title, short_code, original_url, clicks_count, human_clicks_count, bot_clicks_count, created_at 
FROM links 
WHERE title ILIKE '%Nasim%' OR title ILIKE '%19OTC%' OR short_code ILIKE '%Nasim%' OR short_code ILIKE '%19OTC%';

-- 2. Search for Nasim or 19OTC in google_links
SELECT id, title, google_url, short_url, target_url, clicks_count, human_clicks_count, created_at 
FROM google_links 
WHERE title ILIKE '%Nasim%' OR title ILIKE '%19OTC%' OR google_url ILIKE '%Nasim%' OR google_url ILIKE '%19OTC%';

-- 3. Top 10 most clicked links in links table
SELECT id, title, short_code, clicks_count, human_clicks_count, bot_clicks_count, created_at, updated_at 
FROM links 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Check record_redirect_clicks_batch function definition
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'record_redirect_clicks_batch';

-- 5. Total counts
SELECT count(*) as total_links FROM links;
SELECT count(*) as total_clicks_rows FROM clicks;
SELECT count(*) as total_google_links FROM google_links;
