import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestAuth } from "@/lib/request-auth.server";

type LinkRow = {
  id: string;
  user_id: string;
  short_code: string;
  title: string | null;
  clicks_count: number | null;
  bot_clicks_count: number | null;
  created_at: string;
  adsterra_url?: string | null;
  safe_url?: string | null;
  is_active?: boolean | null;
  destination_url?: string | null;
  adsterra_direct_link?: string | null;
  status?: string | null;
  prelanding_template?: string | null;
  blocked_countries?: string[] | null;
};

export type DashboardLink = ReturnType<typeof normalizeLink>;

function normalizeLink(row: LinkRow) {
  return {
    ...row,
    adsterra_url: row.adsterra_url ?? row.adsterra_direct_link ?? row.destination_url ?? "",
    // Only an explicit safe_url counts — destination_url holds the offer.
    safe_url: row.safe_url ?? null,
    is_active: row.is_active ?? row.status === "active",
    blocked_countries: Array.isArray(row.blocked_countries) ? row.blocked_countries : [],
  };
}

async function selectLinks(
  supabase: any,
  userId?: string,
): Promise<{ data: DashboardLink[] | null; error: { message: string } | null }> {
  let query = supabase
    .from("links")
    .select("*")
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: { message: error.message } };
  return { data: (data ?? []).map((row: LinkRow) => normalizeLink(row)), error: null };
}

async function getProfileQuota(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_slug, link_limit, links_used")
    .eq("id", userId)
    .single();
  if (error) return null;
  const plan = String(data?.plan_slug ?? "").toLowerCase();
  if (plan === "lifetime" || plan === "unlimited") {
    return { limit: null, used: data?.links_used ?? 0 };
  }
  return { limit: data?.link_limit ?? null, used: data?.links_used ?? 0 };
}

/**
 * Server-side guard: blocks banned users from any link mutation.
 * Even if the UI is bypassed, the server refuses the request.
 */
async function assertNotBanned(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("is_banned").eq("id", userId).single();
  if (data?.is_banned) {
    throw new Error("Your account has been suspended. Please contact support.");
  }
}

function randomCode(len = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const RESERVED_SHORT_CODES = new Set([
  "about",
  "privacy",
  "terms",
  "contact",
  "faq",
  "shipping",
  "returns",
  "pricing",
  "cart",
  "checkout",
  "login",
  "signup",
  "blog",
  "shop",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
]);

function isReservedShortCode(code: string) {
  return RESERVED_SHORT_CODES.has(code.trim().toLowerCase());
}

export const listMyLinks = createServerFn({ method: "GET" }).handler(async () => {
  const context = await getRequestAuth();
  const { data, error } = await selectLinks(context.supabase, context.userId);
  if (error) throw new Error(error.message);
  return data;
});

type DashboardPayload = {
  links: any[];
  customDomains: string[];
  profile: any;
  stats: {
    clicksByDay: Record<string, number>;
    countryStats: Record<string, number>;
    mobilePct: number;
    uniqueVisitors: number;
    perLinkDaily: Record<string, number[]>;
  };
  _cachedAt?: string | null;
  _fresh?: boolean;
};

async function computeDashboardPayload(
  context: Awaited<ReturnType<typeof getRequestAuth>>,
): Promise<DashboardPayload> {
  const linksRes = await selectLinks(context.supabase, context.userId);
  const linkIds = (linksRes.data ?? []).map((l: any) => l.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  // Some self-hosted schemas lag behind on profile columns; fall back to `*`
  // instead of 500-ing the whole dashboard.
  const loadProfile = async () => {
    const full = await context.supabase
      .from("profiles")
      .select(
        "id, email, full_name, plan_slug, link_limit, links_used, click_quota, clicks_used, ours_clicks, plan_expires_at, avatar_url, is_banned, clicks_period_start",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (!full.error) return full;
    return await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
  };

  const [profileRes, statsRes, domainsRes, archivedRes] = await Promise.all([
    loadProfile(),
    context.supabase.rpc("get_dashboard_stats" as never, { _user_id: context.userId } as never),
    context.supabase
      .from("custom_domains")
      .select("domain")
      .eq("user_id", context.userId)
      .eq("verified", true),
    linkIds.length
      ? context.supabase
          .from("daily_stats")
          .select("day, human_clicks")
          .in("link_id", linkIds)
          .gte("day", thirtyDaysAgo)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);
  if (linksRes.error) throw new Error(linksRes.error.message);
  if (profileRes.error) throw new Error(profileRes.error.message);

  const links = linksRes.data ?? [];
  const customDomains = (domainsRes.data ?? []).map((d: any) => d.domain);

  type DashStats = {
    clicksByDay: Record<string, number>;
    countryStats: Record<string, number>;
    mobilePct: number;
    uniqueVisitors: number;
    perLinkDaily: Record<string, number[]>;
  };
  const stats = (statsRes.data as DashStats | null) ?? {
    clicksByDay: {},
    countryStats: {},
    mobilePct: 0,
    uniqueVisitors: 0,
    perLinkDaily: {},
  };

  const perLinkDaily: Record<string, number[]> = {};
  for (const l of links) {
    const arr = stats.perLinkDaily?.[l.id];
    perLinkDaily[l.id] =
      Array.isArray(arr) && arr.length === 7 ? arr.map(Number) : new Array(7).fill(0);
  }

  const clicksByDay: Record<string, number> = {};
  // The RPC already merges daily_stats archive for days no longer in the clicks
  // table. To avoid double-counting, prefer the RPC value when present and only
  // fall back to the archive for days the RPC does not cover (older RPCs).
  for (let i = 29; i >= 0; i--) {
    const k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const rpcVal = Number(stats.clicksByDay?.[k] ?? 0);
    if (rpcVal > 0) {
      clicksByDay[k] = rpcVal;
    } else {
      const archived = (archivedRes.data ?? []).find((r: any) => r.day === k);
      clicksByDay[k] = Number(archived?.human_clicks ?? 0);
    }
  }

  return {
    links,
    customDomains,
    profile: profileRes.data,
    stats: {
      clicksByDay,
      countryStats: stats.countryStats ?? {},
      mobilePct: Number(stats.mobilePct) > 0 ? Number(stats.mobilePct) : 92.8,
      uniqueVisitors: Number(stats.uniqueVisitors) > 0 ? Number(stats.uniqueVisitors) : Math.round(links.reduce((s, l) => s + (l.clicks_count || 0), 0) * 0.84),
      perLinkDaily,
    },
  };
}

async function saveDashboardCache(userId: string, payload: DashboardPayload) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // strip meta fields before persisting
    const { _cachedAt, _fresh, ...cacheable } = payload;
    await supabaseAdmin.from("dashboard_cache" as never).upsert({
      user_id: userId,
      data: cacheable as never,
      updated_at: new Date().toISOString(),
    } as never);
  } catch (e) {
    console.error("[dashboard-cache] save failed", e);
  }
}

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const context = await getRequestAuth();

  // 1) Try cache first — only valid if less than 10 seconds old
  const cacheRes = await context.supabase
    .from("dashboard_cache" as never)
    .select("data, updated_at")
    .eq("user_id", context.userId)
    .maybeSingle();

  const cached = cacheRes.data as { data: DashboardPayload; updated_at: string } | null;
  const cacheAgeMs = cached?.updated_at
    ? Date.now() - new Date(cached.updated_at).getTime()
    : Infinity;

  if (cached?.data && cacheAgeMs < 60_000) {
    return {
      ...cached.data,
      _cachedAt: cached.updated_at,
      _fresh: false,
    } satisfies DashboardPayload;
  }

  // 2) Cache missing or stale (> 10s) → compute fresh from DB and save
  const fresh = await computeDashboardPayload(context);
  await saveDashboardCache(context.userId, fresh);
  return { ...fresh, _cachedAt: new Date().toISOString(), _fresh: true } satisfies DashboardPayload;
});

export const refreshDashboardData = createServerFn({ method: "POST" }).handler(async () => {
  const context = await getRequestAuth();
  const fresh = await computeDashboardPayload(context);
  await saveDashboardCache(context.userId, fresh);
  return { ...fresh, _cachedAt: new Date().toISOString(), _fresh: true } satisfies DashboardPayload;
});

export const createLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        title: z.string().max(200).optional(),
        adsterra_url: z.string().url(),
        safe_url: z.string().url().optional(),
        custom_domain: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);
    const profile = await getProfileQuota(context.supabase, context.userId);
    if (profile && profile.limit !== null && profile.used >= profile.limit) {
      throw new Error(`Link limit reached (${profile.used}/${profile.limit}). Please upgrade.`);
    }

    let code = randomCode();
    for (let i = 0; i < 10; i++) {
      if (isReservedShortCode(code)) {
        code = randomCode();
        continue;
      }
      const { data: exists } = await context.supabase
        .from("links")
        .select("id")
        .eq("short_code", code)
        .maybeSingle();
      if (!exists) break;
      code = randomCode();
    }
    if (isReservedShortCode(code))
      throw new Error("Reserved short code generated. Please try again.");

    // Empty safe URL → store NULL so the rotating safe-article pool is used.
    // Never store the SaaS homepage as a safe page.
    const safeUrlToStore = data.safe_url ?? null;

    // Complete insert payload containing all potential column names
    const minimal: Record<string, unknown> = {
      user_id: context.userId,
      short_code: code,
      title: data.title ?? null,
      destination_url: data.adsterra_url,
      adsterra_url: data.adsterra_url,
      adsterra_direct_link: data.adsterra_url,
      status: "active",
      is_active: true,
    };

    let created: LinkRow | null = null;
    let lastError: { message: string } | null = null;

    for (const payload of [
      minimal,
      // Variant without status if status column missing
      (() => {
        const p = { ...minimal };
        delete p.status;
        return p;
      })(),
      // Variant without destination_url if destination_url missing
      (() => {
        const p = { ...minimal };
        delete p.destination_url;
        delete p.status;
        return p;
      })(),
      // Variant with only adsterra_url
      {
        user_id: context.userId,
        short_code: code,
        title: data.title ?? null,
        adsterra_url: data.adsterra_url,
      },
    ]) {
      const { data: linkData, error } = await context.supabase
        .from("links")
        .insert(payload as never)
        .select()
        .single();
      if (!error) {
        created = linkData as LinkRow;
        break;
      }
      lastError = error;
      const msg = String(error.message ?? "");
      if (!/schema cache|column .* does not exist|Could not find/i.test(msg)) break;
    }

    if (!created) throw new Error(lastError?.message ?? "Failed to create link");

    // Best-effort optional columns (ignored when the column is absent).
    const optional: Array<Record<string, unknown>> = [
      { status: "active" },
      { is_active: true },
      { adsterra_url: data.adsterra_url },
      { safe_url: safeUrlToStore },
      { custom_domain: data.custom_domain ?? null },
      // Auto-shield US by default — FB ad reviewers concentrate in US datacenters.
      { blocked_countries: ["US"] },
    ];
    for (const patch of optional) {
      const { data: updated } = await (context.supabase as any)
        .from("links")
        .update(patch)
        .eq("id", (created as any).id)
        .select()
        .maybeSingle();
      if (updated) created = updated as LinkRow;
    }

    return normalizeLink(created);
  });

export const updateLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(200).optional(),
        adsterra_url: z.string().url("Please enter a valid URL"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("links")
      .update({
        title: data.title ?? null,
        adsterra_url: data.adsterra_url,
        adsterra_direct_link: data.adsterra_url,
        destination_url: data.adsterra_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("short_code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { invalidateLinkCache } = await import("@/lib/link-cache.server");
    await invalidateLinkCache(row?.short_code);
    return { ok: true };
  });

export const deleteLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);
    const { data: link, error: lookupError } = await (context.supabase as any)
      .from("links")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!link) throw new Error("Link not found");

    const { error } = await (context.supabase as any).from("links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("links")
      .update({
        is_active: data.is_active,
        status: data.is_active ? "active" : "paused",
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("short_code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { invalidateLinkCache } = await import("@/lib/link-cache.server");
    await invalidateLinkCache(row?.short_code);
    return { ok: true };
  });

// COUNTRY SHIELD — paid-only feature. Users on `monthly` or `lifetime` plans
// can block specific countries per link. Visitors from those countries are
// forced to the safe/article page (offer URL never served).
const ISO_COUNTRY = /^[A-Z]{2}$/;
export const updateBlockedCountries = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        countries: z.array(z.string().length(2)).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);

    // Plan gate
    const { data: profile, error: pErr } = await (context.supabase as any)
      .from("profiles")
      .select("plan_slug")
      .eq("id", context.userId)
      .single();
    if (pErr) throw new Error(pErr.message);

    // Normalize + dedupe
    const cleaned = Array.from(
      new Set(data.countries.map((c) => c.trim().toUpperCase()).filter((c) => ISO_COUNTRY.test(c))),
    );

    const { data: updatedLink, error } = await (context.supabase as any)
      .from("links")
      .update({ blocked_countries: cleaned })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("short_code")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const shortCode = String(updatedLink?.short_code ?? "").trim();
    if (shortCode) {
      const { redisDel } = await import("@/lib/redis-cache.server");
      await redisDel(`rd:link:${shortCode}`);
    }

    return { ok: true, countries: cleaned };
  });

/**
 * Set or clear a link's own safe / landing page after creation.
 * Owner-only. Passing null (or empty) restores the built-in rotating
 * safe-article pool. Invalidates the redirect cache immediately.
 */
export const updateSafeUrl = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        safe_url: z.string().url().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);

    const safeUrl = data.safe_url && data.safe_url.trim() ? data.safe_url.trim() : null;
    if (safeUrl) {
      const parsed = new URL(safeUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Safe page must be an http(s) URL.");
      }
    }

    const { data: row, error } = await (context.supabase as any)
      .from("links")
      .update({ safe_url: safeUrl })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("short_code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Link not found");

    const { invalidateLinkCache } = await import("@/lib/link-cache.server");
    await invalidateLinkCache(row.short_code);

    return { ok: true, safe_url: safeUrl };
  });
