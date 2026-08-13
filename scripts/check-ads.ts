import { createClient } from '@supabase/supabase-js';
const s = createClient("https://supabase.sleepox.com","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8");

console.log("=== Clicks last 6h by route ===");
const { data: r1 } = await s.rpc('exec', {}).select().limit(0); // ignore
const { data: clicks } = await s.from('clicks').select('routed_to,is_bot,bot_reason').gte('created_at', new Date(Date.now()-6*3600e3).toISOString()).limit(5000);
const agg: Record<string, number> = {};
(clicks||[]).forEach((c:any)=>{ const k = `${c.routed_to}|bot=${c.is_bot}|${c.bot_reason||'-'}`; agg[k]=(agg[k]||0)+1; });
Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log(v, k));

console.log("\n=== Recent FB-flagged clicks (last 50) ===");
const { data: fb } = await s.from('clicks').select('created_at,routed_to,bot_reason,country,ua').ilike('bot_reason','%fb%').order('created_at',{ascending:false}).limit(20);
(fb||[]).forEach((r:any)=>console.log(r.created_at, '|', r.routed_to, '|', r.bot_reason, '|', r.country, '|', (r.ua||'').slice(0,80)));

console.log("\n=== Recent error_logs (redirect/server) ===");
const { data: errs } = await s.from('error_logs').select('created_at,source,message,context').order('created_at',{ascending:false}).limit(15);
(errs||[]).forEach((e:any)=>console.log(e.created_at,'|',e.source,'|',e.message?.slice(0,120)));

console.log("\n=== Recently created links (last 10) ===");
const { data: links } = await s.from('links').select('short_code,created_at,clicks_count,bot_clicks_count,is_active,prelanding_template').order('created_at',{ascending:false}).limit(10);
(links||[]).forEach((l:any)=>console.log(l.created_at,'|',l.short_code,'|', 'clicks=',l.clicks_count,'bot=',l.bot_clicks_count,'active=',l.is_active));
