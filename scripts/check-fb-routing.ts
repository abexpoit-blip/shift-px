/**
 * Automated consistency check: every FB-class crawler hit (UA contains
 * facebookexternalhit/facebot/meta-external*, or bot_reason starts with fb-)
 * MUST have routed_to='fb-article'. Anything else = a logging/serving mismatch
 * that risks ad rejection. Exits non-zero on any mismatch so it can be wired
 * into cron/CI.
 */
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  "https://supabase.sleepox.com",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8",
);

const WINDOW_HOURS = Number(process.env.CHECK_WINDOW_HOURS || 1);
const since = new Date(Date.now() - WINDOW_HOURS * 3600e3).toISOString();

const FB_UA_RE = /facebookexternalhit|facebot|facebookcatalog|facebookplatform|meta-external|meta-webindexer|metainspector|instagram-fbexternalhit/i;

const { data, error } = await s
  .from('clicks')
  .select('id, created_at, routed_to, is_bot, bot_reason, ua, ip')
  .gte('created_at', since)
  .or('bot_reason.ilike.fb-%,ua.ilike.%facebookexternalhit%,ua.ilike.%meta-external%,ua.ilike.%facebot%')
  .order('created_at', { ascending: false })
  .limit(5000);

if (error) {
  console.error('[check-fb-routing] query failed:', error.message);
  process.exit(2);
}

const rows = (data || []).filter((r: any) => {
  const ua = r.ua || '';
  const reason = r.bot_reason || '';
  return FB_UA_RE.test(ua) || /^fb-/i.test(reason);
});

let mismatches: any[] = [];
let ok = 0;
for (const r of rows) {
  if (r.routed_to === 'fb-article') ok++;
  else mismatches.push(r);
}

console.log(`Window: last ${WINDOW_HOURS}h | FB-class hits: ${rows.length} | correct: ${ok} | mismatches: ${mismatches.length}`);

if (mismatches.length > 0) {
  console.log('\n=== MISMATCHES (routed_to != fb-article on FB crawler) ===');
  mismatches.slice(0, 30).forEach((r: any) => {
    console.log(`${r.created_at} | route=${r.routed_to} | reason=${r.bot_reason} | ip=${r.ip} | ua=${(r.ua || '').slice(0, 90)}`);
  });

  // Record mismatches into error_logs so they show up in admin alerts.
  try {
    await s.from('error_logs').insert({
      source: 'check-fb-routing',
      message: `FB crawler routing mismatch: ${mismatches.length} hits in last ${WINDOW_HOURS}h served as ${[...new Set(mismatches.map((m: any) => m.routed_to))].join(',')} instead of fb-article`,
      context: { sample: mismatches.slice(0, 10), total: mismatches.length, window_hours: WINDOW_HOURS },
    } as any);
  } catch (e) {
    console.warn('error_logs insert failed:', (e as Error).message);
  }

  process.exit(1);
}

console.log('✅ All FB-class crawler hits correctly served fb-article.');
process.exit(0);
