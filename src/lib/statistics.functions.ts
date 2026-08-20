import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { browserBucket, bucketLabel, deviceBucket, sourceBucket } from "@/lib/ua-parse";

/**
 * Free statistics for every user: 30-day traffic series, country split and
 * traffic sources.
 *
 * HYBRID STORAGE (migration 35):
 *   * last 2 days  → raw `clicks` rows (live, second-accurate)
 *   * older days   → `click_dim_daily` archive (kept forever, tiny)
 * Raw rows are purged after 7 days, the archive never is, so the 30-day view
 * stays complete no matter how much traffic the box takes.
 */

export type StatsPayload = {
  totalClicks: number;
  humanClicks: number;
  botClicks: number;
  countriesSeen: number;
  series: Array<{ day: string; humans: number; bots: number }>;
  countries: Array<{ code: string; humans: number; bots: number; total: number }>;
  sources: Array<{ name: string; value: number }>;
  devices: Array<{ name: string; value: number }>;
  browsers: Array<{ name: string; value: number }>;
  topLinks: Array<{ id: string; short_code: string; title: string | null; clicks: number }>;
};

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as any;
}

/** Day (UTC) from which raw click rows are preferred over the archive. */
function hotCutoff() {
  const d = new Date(Date.now() - 2 * 864e5);
  return d.toISOString().slice(0, 10);
}

/**
 * Hard cap on every stats query. A slow/locked table must never hang a PM2
 * worker (nginx read timeout is 60s) — we return a degraded panel instead.
 */
const STATS_TIMEOUT_MS = 8000;

function guard<T>(p: PromiseLike<T>, label: string, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      console.warn(`[stats][TIMEOUT] ${label} > ${STATS_TIMEOUT_MS}ms — degraded`);
      resolve(fallback);
    }, STATS_TIMEOUT_MS);
    Promise.resolve(p).then(
      (v) => {
        if (!done) {
          done = true;
          clearTimeout(t);
          resolve(v);
        }
      },
      (e) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        console.error(`[stats][ERR] ${label}: ${(e as Error)?.message ?? e}`);
        resolve(fallback);
      },
    );
  });
}

const EMPTY_RES = { data: [] as any[] };

function bump(map: Map<string, number>, key: string, by: number) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topEntries(map: Map<string, number>, n: number) {
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
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

    const { data: linkRows } = await guard(
      db.from("links").select("id, short_code, title, clicks_count").eq("user_id", userId),
      "links",
      EMPTY_RES,
    );
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
        devices: [],
        browsers: [],
        topLinks: [],
      };
    }

    const hotDay = hotCutoff();
    const hotTs = new Date(`${hotDay}T00:00:00Z`).toISOString();

    const [statsRes, archiveRes, clicksRes] = await Promise.all([
      guard(
        db
          .from("daily_stats")
          .select("day, human_clicks, bot_clicks")
          .in("link_id", linkIds)
          .gte("day", since),
        "daily_stats",
        EMPTY_RES,
      ),
      // COLD: pre-aggregated dimensions, survives the weekly raw purge
      guard(
        db
          .from("click_dim_daily")
          .select("country, device, browser, source, is_bot, clicks")
          .eq("user_id", userId)
          .gte("day", since)
          .lt("day", hotDay)
          .limit(50000),
        "click_dim_daily",
        EMPTY_RES,
      ),
      // HOT: last 2 days straight from the raw table
      guard(
        db
          .from("clicks")
          .select("country, referer_host, is_bot, ua, created_at")
          .in("link_id", linkIds)
          .gte("created_at", hotTs)
          .order("created_at", { ascending: false })
          .limit(20000),
        "clicks",
        EMPTY_RES,
      ),
    ]);

    const byDay = new Map(days.map((d) => [d, { day: d, humans: 0, bots: 0 }]));
    for (const row of (statsRes.data ?? []) as any[]) {
      const key = String(row.day).slice(0, 10);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      bucket.humans += Number(row.human_clicks ?? 0);
      bucket.bots += Number(row.bot_clicks ?? 0);
    }

    const countryMap = new Map<
      string,
      { code: string; humans: number; bots: number; total: number }
    >();
    const sourceMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();

    const addRow = (
      country: string,
      isBot: boolean,
      n: number,
      dims: { device: string; browser: string; source: string },
    ) => {
      const code = country.toLowerCase();
      if (code && code !== "--") {
        const c = countryMap.get(code) ?? { code, humans: 0, bots: 0, total: 0 };
        if (isBot) c.bots += n;
        else c.humans += n;
        c.total += n;
        countryMap.set(code, c);
      }
      if (isBot) return;
      bump(sourceMap, bucketLabel(dims.source), n);
      bump(deviceMap, bucketLabel(dims.device), n);
      bump(browserMap, bucketLabel(dims.browser), n);
    };

    for (const row of (archiveRes.data ?? []) as any[]) {
      addRow(String(row.country ?? ""), !!row.is_bot, Number(row.clicks ?? 0), {
        device: String(row.device ?? "other"),
        browser: String(row.browser ?? "other"),
        source: String(row.source ?? "direct"),
      });
    }

    for (const row of (clicksRes.data ?? []) as any[]) {
      addRow(String(row.country ?? ""), !!row.is_bot, 1, {
        device: deviceBucket(row.ua),
        browser: browserBucket(row.ua),
        source: sourceBucket(row.referer_host),
      });
      const dayKey = String(row.created_at || "").slice(0, 10);
      const bucket = byDay.get(dayKey);
      if (bucket) {
        if (row.is_bot) bucket.bots += 1;
        else bucket.humans += 1;
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
      devices: topEntries(deviceMap, 5),
      browsers: topEntries(browserMap, 6),
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

export type LinkStatsPayload = {
  linkId: string;
  shortCode: string;
  title: string | null;
  series: Array<{ day: string; humans: number; bots: number }>;
  countries: Array<{ code: string; total: number }>;
  devices: Array<{ name: string; value: number }>;
  totals: { humans: number; bots: number };
};

export const getLinkStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }): Promise<LinkStatsPayload> => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;
    const days = lastNDays(30);
    const since = days[0];
    const hotDay = hotCutoff();
    const hotTs = new Date(`${hotDay}T00:00:00Z`).toISOString();

    const { data: link } = await db
      .from("links")
      .select("id, short_code, title, user_id")
      .eq("id", data.linkId)
      .maybeSingle();
    if (!link || link.user_id !== userId) throw new Error("Link not found");

    const [statsRes, archiveRes, clicksRes] = await Promise.all([
      guard(
        db
          .from("daily_stats")
          .select("day, human_clicks, bot_clicks")
          .eq("link_id", link.id)
          .gte("day", since),
        "link.daily_stats",
        EMPTY_RES,
      ),
      guard(
        db
          .from("click_dim_daily")
          .select("country, device, is_bot, clicks")
          .eq("link_id", link.id)
          .gte("day", since)
          .lt("day", hotDay)
          .limit(20000),
        "link.click_dim_daily",
        EMPTY_RES,
      ),
      guard(
        db
          .from("clicks")
          .select("country, ua, is_bot")
          .eq("link_id", link.id)
          .gte("created_at", hotTs)
          .order("created_at", { ascending: false })
          .limit(20000),
        "link.clicks",
        EMPTY_RES,
      ),
    ]);

    const byDay = new Map(days.map((d) => [d, { day: d, humans: 0, bots: 0 }]));
    for (const row of (statsRes.data ?? []) as any[]) {
      const b = byDay.get(String(row.day).slice(0, 10));
      if (!b) continue;
      b.humans += Number(row.human_clicks ?? 0);
      b.bots += Number(row.bot_clicks ?? 0);
    }

    const countryMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const addRow = (country: string, isBot: boolean, n: number, device: string) => {
      const code = country.toLowerCase();
      if (code && code !== "--") bump(countryMap, code, n);
      if (!isBot) bump(deviceMap, bucketLabel(device), n);
    };
    for (const row of (archiveRes.data ?? []) as any[]) {
      addRow(
        String(row.country ?? ""),
        !!row.is_bot,
        Number(row.clicks ?? 0),
        String(row.device ?? "other"),
      );
    }
    for (const row of (clicksRes.data ?? []) as any[]) {
      addRow(String(row.country ?? ""), !!row.is_bot, 1, deviceBucket(row.ua));
    }

    const series = days.map((d) => byDay.get(d)!);
    return {
      linkId: link.id,
      shortCode: link.short_code,
      title: link.title,
      series,
      countries: [...countryMap.entries()]
        .map(([code, total]) => ({ code, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
      devices: topEntries(deviceMap, 5),
      totals: {
        humans: series.reduce((s2, r) => s2 + r.humans, 0),
        bots: series.reduce((s2, r) => s2 + r.bots, 0),
      },
    };
  });
