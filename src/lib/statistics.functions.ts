import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Free statistics for every user: 30-day traffic series, country split and
 * traffic sources. Built on the existing clicks / daily_stats pipeline.
 */

export type StatsPayload = {
  totalClicks: number;
  humanClicks: number;
  botClicks: number;
  countriesSeen: number;
  series: Array<{ day: string; humans: number; bots: number }>;
  countries: Array<{ code: string; humans: number; bots: number; total: number }>;
  sources: Array<{ name: string; value: number }>;
  topLinks: Array<{ id: string; short_code: string; title: string | null; clicks: number }>;
};

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as any;
}

const SOURCE_MAP: Array<[RegExp, string]> = [
  [/facebook|fb\./i, "Facebook"],
  [/instagram/i, "Instagram"],
  [/t\.me|telegram/i, "Telegram"],
  [/youtube|youtu\.be/i, "YouTube"],
  [/whatsapp|wa\.me/i, "WhatsApp"],
  [/twitter|x\.com|t\.co/i, "X (Twitter)"],
  [/tiktok/i, "TikTok"],
  [/google/i, "Google"],
];

function bucketSource(host: string | null): string {
  if (!host) return "Direct";
  for (const [re, name] of SOURCE_MAP) if (re.test(host)) return name;
  return "Other";
}

function lastNDays(n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  }
  return out;
}

export const getStatistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatsPayload> => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;
    const days = lastNDays(30);
    const since = days[0];
    const sinceTs = new Date(`${since}T00:00:00Z`).toISOString();

    const { data: linkRows } = await db
      .from("links")
      .select("id, short_code, title, clicks_count")
      .eq("user_id", userId);
    const links = (linkRows ?? []) as any[];
    const linkIds = links.map((l) => l.id);

    if (linkIds.length === 0) {
      return {
        totalClicks: 0,
        humanClicks: 0,
        botClicks: 0,
        countriesSeen: 0,
        series: days.map((day) => ({ day, humans: 0, bots: 0 })),
        countries: [],
        sources: [],
        topLinks: [],
      };
    }

    const [statsRes, clicksRes] = await Promise.all([
      db
        .from("daily_stats")
        .select("day, human_clicks, bot_clicks")
        .in("link_id", linkIds)
        .gte("day", since),
      db
        .from("clicks")
        .select("country, referer_host, is_bot")
        .in("link_id", linkIds)
        .gte("created_at", sinceTs)
        .order("created_at", { ascending: false })
        .limit(20000),
    ]);

    const byDay = new Map(days.map((d) => [d, { day: d, humans: 0, bots: 0 }]));
    for (const row of (statsRes.data ?? []) as any[]) {
      const key = String(row.day).slice(0, 10);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      bucket.humans += Number(row.human_clicks ?? 0);
      bucket.bots += Number(row.bot_clicks ?? 0);
    }

    const countryMap = new Map<string, { code: string; humans: number; bots: number; total: number }>();
    const sourceMap = new Map<string, number>();
    for (const row of (clicksRes.data ?? []) as any[]) {
      const code = String(row.country ?? "").toLowerCase();
      if (code) {
        const c = countryMap.get(code) ?? { code, humans: 0, bots: 0, total: 0 };
        if (row.is_bot) c.bots += 1;
        else c.humans += 1;
        c.total += 1;
        countryMap.set(code, c);
      }
      if (!row.is_bot) {
        const src = bucketSource(row.referer_host ?? null);
        sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
      }
    }

    const series = days.map((d) => byDay.get(d)!);
    const humanClicks = series.reduce((s, r) => s + r.humans, 0);
    const botClicks = series.reduce((s, r) => s + r.bots, 0);

    return {
      totalClicks: humanClicks + botClicks,
      humanClicks,
      botClicks,
      countriesSeen: countryMap.size,
      series,
      countries: [...countryMap.values()].sort((a, b) => b.total - a.total).slice(0, 20),
      sources: [...sourceMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
      topLinks: links
        .sort((a, b) => Number(b.clicks_count ?? 0) - Number(a.clicks_count ?? 0))
        .slice(0, 8)
        .map((l) => ({
          id: l.id,
          short_code: l.short_code,
          title: l.title,
          clicks: Number(l.clicks_count ?? 0),
        })),
    };
  });
