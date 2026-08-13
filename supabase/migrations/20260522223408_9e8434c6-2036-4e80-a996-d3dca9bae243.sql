-- Speed up analytics breakdowns (clicks_breakdown, clicks_daily)
CREATE INDEX IF NOT EXISTS idx_clicks_link_id_created_at 
  ON public.clicks (link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_created_at 
  ON public.clicks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_link_id_is_bot 
  ON public.clicks (link_id, is_bot);

-- Speed up redirect lookups (most critical - hit on every /r/:code request)
CREATE INDEX IF NOT EXISTS idx_links_short_code 
  ON public.links (short_code);

CREATE INDEX IF NOT EXISTS idx_links_user_id 
  ON public.links (user_id);

-- Speed up duplicate click protection
CREATE INDEX IF NOT EXISTS idx_duplicate_clicks_link_ip 
  ON public.duplicate_clicks (link_id, ip);

-- Speed up RLS policy checks (link ownership)
CREATE INDEX IF NOT EXISTS idx_link_destinations_link_id 
  ON public.link_destinations (link_id);

CREATE INDEX IF NOT EXISTS idx_link_geo_rules_link_id 
  ON public.link_geo_rules (link_id);

CREATE INDEX IF NOT EXISTS idx_link_device_rules_link_id 
  ON public.link_device_rules (link_id);

-- Analyze tables to update planner stats
ANALYZE public.clicks;
ANALYZE public.links;
ANALYZE public.duplicate_clicks;