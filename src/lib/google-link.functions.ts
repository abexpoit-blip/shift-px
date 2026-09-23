import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestAuth } from "@/lib/request-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface GoogleShortItem {
  id: string;
  link_id: string;
  short_code: string;
  domain: string;
  destination_url: string;
  google_url: string;
  share_google_url?: string | null;
  title: string | null;
  created_at: string;
  clicks_count: number;
  bot_clicks_count: number;
  total_clicks: number;
  human_rate: number;
  is_active: boolean;
}

export interface StoredGoogleLink {
  id: string;
  original_url: string;
  google_url: string;
  intermediate_url?: string;
  mode: "inhouse_share" | "inhouse_script" | "tracer";
  status: "active" | "error" | "tested";
  created_at: string;
  hops_count: number;
  last_tested_at?: string;
  latency_ms?: number;
  notes?: string;
}

export interface HopDetail {
  hop: number;
  url: string;
  status: number;
  statusText?: string;
  server?: string;
  location?: string | null;
  latencyMs: number;
  contentType?: string | null;
  error?: string;
}

export interface TraceResult {
  initialUrl: string;
  finalUrl: string;
  totalLatencyMs: number;
  hops: HopDetail[];
  isGoogleDomain: boolean;
  metaPostSafe: boolean;
  verdict: string;
}

export function extractGoogleToken(input: string): { token?: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return {};

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.includes("google.com") && parsed.pathname.includes("share.google")) {
        const q = parsed.searchParams.get("q");
        if (q) return { token: q.trim() };
      } else if (parsed.hostname.includes("share.google")) {
        const code = parsed.pathname.replace(/^\/+/, "").split("/")[0];
        if (code) return { token: code.trim() };
      } else {
        return {
          error: "Invalid Google Share token format.",
        };
      }
    } catch {
      return { error: "Invalid URL format." };
    }
  }

  if (/^[a-zA-Z0-9_-]{4,64}$/.test(trimmed)) {
    return { token: trimmed };
  }

  return {
    error: "Invalid Google Share token format.",
  };
}

export async function verifyGoogleTokenLive(
  tokenOrUrl: string
): Promise<{ valid: boolean; destination?: string; error?: string }> {
  try {
    let url = tokenOrUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://www.google.com/share.google?q=${encodeURIComponent(tokenOrUrl.trim())}`;
    }

    if (url.includes("share.google") && url.includes("link=")) {
      try {
        const parsed = new URL(url);
        const dest = parsed.searchParams.get("link");
        if (dest && (dest.startsWith("http://") || dest.startsWith("https://"))) {
          return { valid: true, destination: dest };
        }
      } catch {
        // fall through
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    const location = res.headers.get("location") || "";
    if (location.includes("share.google/error")) {
      return {
        valid: false,
        error: "Google returned https://share.google/error: Unregistered token.",
      };
    }

    if (res.status >= 300 && res.status < 400 && location) {
      return { valid: true, destination: location };
    }

    const body = await res.text();
    if (body.includes("share.google/error")) {
      return {
        valid: false,
        error: "Google returned https://share.google/error: Unregistered token.",
      };
    }

    const match = body.match(/<A HREF="([^"]+)">here<\/A>/i);
    if (match && match[1]) {
      if (match[1].includes("share.google/error")) {
        return {
          valid: false,
          error: "Google returned https://share.google/error: Unregistered token.",
        };
      }
      return { valid: true, destination: match[1] };
    }

    const metaMatch = body.match(/content=["'][0-9]+;url=([^"']+)["']/i);
    if (metaMatch && metaMatch[1]) {
      const metaDest = metaMatch[1].replace(/&amp;/g, "&");
      if (!metaDest.includes("share.google/error")) {
        return { valid: true, destination: metaDest };
      }
    }

    return {
      valid: false,
      error: "Google did not return a valid 301 redirect for this URL.",
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.name === "AbortError" ? "Google verification timed out (>6s)" : err.message,
    };
  }
}

/**
 * Public/User & Admin 1-Click Generator for Google Short links
 */
export const generateGoogleShort = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        offerUrl: z.string().min(1, "Destination or Offer URL is required"),
        googleShareCode: z.string().optional(),
        domain: z.string().optional().default("adswapx.com"),
        notes: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    const userId = context.userId;

    let cleanOffer = data.offerUrl.trim();
    if (!/^https?:\/\//i.test(cleanOffer)) {
      cleanOffer = "https://" + cleanOffer;
    }

    let destinationShortUrl = "";
    let shortCode = "";
    let linkId = "";

    const selectedDomain = (data.domain || "adswapx.com")
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    // Check if input is already an AdsPx short URL on adswapx.com or custom domain
    const isExistingShortener =
      cleanOffer.includes("adswapx.com/") ||
      cleanOffer.includes("dovtv.com/") ||
      cleanOffer.includes("localhost:");

    if (isExistingShortener) {
      destinationShortUrl = cleanOffer;
      try {
        const parsed = new URL(cleanOffer);
        shortCode = parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
        const { data: existingLink } = await supabaseAdmin
          .from("links")
          .select("id")
          .eq("short_code", shortCode)
          .maybeSingle();
        if (existingLink) linkId = existingLink.id;
      } catch {}
    } else {
      // Auto-create cloaked AdsPx link
      const chars = "abcdefghijkmnpqrstuvwxyz23456789";
      let code = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        code = "";
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        const { data: existing } = await supabaseAdmin
          .from("links")
          .select("id")
          .eq("short_code", code)
          .maybeSingle();
        if (!existing) break;
      }
      shortCode = code;

      const { data: insertedLink, error: insertErr } = await (supabaseAdmin as any)
        .from("links")
        .insert({
          user_id: userId,
          short_code: code,
          title: data.notes || "Google Short Campaign",
          destination_url: cleanOffer,
          adsterra_url: cleanOffer,
          adsterra_direct_link: cleanOffer,
          custom_domain: selectedDomain,
          status: "active",
          is_active: true,
          is_google_short: true,
        })
        .select("id")
        .single();

      if (insertErr || !insertedLink) {
        console.error("[google-link] Failed to create short link:", insertErr);
        throw new Error("Failed to create cloaked link: " + (insertErr?.message || "Unknown error"));
      }

      linkId = insertedLink.id;
      destinationShortUrl = `https://${selectedDomain}/${code}`;
    }

    // Generate Google short URLs
    const rawGoogleInput = (data.googleShareCode || "").trim();
    let officialGoogleUrl = "";
    let shareGoogleAltUrl = "";

    if (rawGoogleInput) {
      const parsedToken = extractGoogleToken(rawGoogleInput);
      if (parsedToken.error || !parsedToken.token) {
        throw new Error(parsedToken.error || "Invalid Google Share token or URL");
      }
      const token = parsedToken.token;
      officialGoogleUrl = `https://www.google.com/share.google?q=${encodeURIComponent(token)}`;
      shareGoogleAltUrl = `https://share.google/${encodeURIComponent(token)}`;
    } else {
      officialGoogleUrl = `https://www.google.com/share.google?link=${encodeURIComponent(destinationShortUrl)}`;
      shareGoogleAltUrl = `https://share.google/?link=${encodeURIComponent(destinationShortUrl)}`;
    }

    // Record in public.google_shorts table
    if (linkId) {
      try {
        await (supabaseAdmin as any).from("google_shorts").insert({
          user_id: userId,
          link_id: linkId,
          short_code: shortCode,
          domain: selectedDomain,
          destination_url: cleanOffer,
          google_url: officialGoogleUrl,
          share_google_url: shareGoogleAltUrl,
          title: data.notes || "Google Short Campaign",
        });
      } catch (gsErr) {
        console.warn("[google-link] google_shorts table insert note:", gsErr);
      }
    }

    return {
      success: true,
      paired: true,
      googleUrl: officialGoogleUrl,
      shareGoogleUrl: shareGoogleAltUrl,
      destinationShortUrl,
      shortCode,
      adsterraOfferUrl: cleanOffer,
    };
  });

export const adminGenerateAutoGoogleShort = generateGoogleShort;

/**
 * Public/User & Admin query for Google Short Links with real-time click metrics
 */
export const getGoogleShortsList = createServerFn({ method: "GET" }).handler(async () => {
  const context = await getRequestAuth();
  const userId = context.userId;

  // Check if user is admin
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = roleRow?.role === "admin";

  // Query google_shorts table
  let gsQuery = (supabaseAdmin as any)
    .from("google_shorts")
    .select("id, link_id, short_code, domain, destination_url, google_url, share_google_url, title, created_at, user_id")
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    gsQuery = gsQuery.eq("user_id", userId);
  }

  const { data: gsRows, error: gsError } = await gsQuery;

  // Fallback: If google_shorts table is empty or just migrated, also check links with is_google_short or matching
  const gsList = Array.isArray(gsRows) ? gsRows : [];
  const linkIds = Array.from(new Set(gsList.map((r: any) => r.link_id).filter(Boolean)));

  // If no records in google_shorts yet, also check links table for user's links
  if (gsList.length === 0) {
    let linksQuery = (supabaseAdmin as any)
      .from("links")
      .select("id, short_code, custom_domain, destination_url, adsterra_url, title, created_at, clicks_count, bot_clicks_count, is_active, user_id")
      .eq("is_google_short", true)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      linksQuery = linksQuery.eq("user_id", userId);
    }

    const { data: legacyLinks } = await linksQuery;
    if (legacyLinks && legacyLinks.length > 0) {
      const items: GoogleShortItem[] = legacyLinks.map((l: any) => {
        const dom = l.custom_domain || "adswapx.com";
        const cloaked = `https://${dom}/${l.short_code}`;
        const gUrl = `https://www.google.com/share.google?link=${encodeURIComponent(cloaked)}`;
        const shareUrl = `https://share.google/?link=${encodeURIComponent(cloaked)}`;
        const clicks = Number(l.clicks_count || 0);
        const botClicks = Number(l.bot_clicks_count || 0);
        const total = clicks + botClicks;
        return {
          id: l.id,
          link_id: l.id,
          short_code: l.short_code,
          domain: dom,
          destination_url: l.destination_url || l.adsterra_url || "",
          google_url: gUrl,
          share_google_url: shareUrl,
          title: l.title || "Google Short",
          created_at: l.created_at,
          clicks_count: clicks,
          bot_clicks_count: botClicks,
          total_clicks: total,
          human_rate: total > 0 ? Math.round((clicks / total) * 100) : 100,
          is_active: l.is_active !== false,
        };
      });
      return { links: items };
    }
  }

  // Fetch live link counters from links table for accurate stats
  let linksMap = new Map<string, any>();
  if (linkIds.length > 0) {
    const { data: linkRows } = await supabaseAdmin
      .from("links")
      .select("id, clicks_count, bot_clicks_count, is_active, status")
      .in("id", linkIds);

    for (const l of linkRows || []) {
      linksMap.set(l.id, l);
    }
  }

  const items: GoogleShortItem[] = gsList.map((gs: any) => {
    const link = linksMap.get(gs.link_id);
    const clicks = Number(link?.clicks_count || 0);
    const botClicks = Number(link?.bot_clicks_count || 0);
    const total = clicks + botClicks;
    const isActive = link ? link.is_active !== false && link.status !== "inactive" : true;

    return {
      id: gs.id,
      link_id: gs.link_id,
      short_code: gs.short_code,
      domain: gs.domain || "adswapx.com",
      destination_url: gs.destination_url,
      google_url: gs.google_url,
      share_google_url: gs.share_google_url,
      title: gs.title || "Google Short",
      created_at: gs.created_at,
      clicks_count: clicks,
      bot_clicks_count: botClicks,
      total_clicks: total,
      human_rate: total > 0 ? Math.round((clicks / total) * 100) : 100,
      is_active: isActive,
    };
  });

  return { links: items };
});

export const adminGetGoogleLinksState = getGoogleShortsList;

/**
 * Public/User & Admin delete function for Google Shorts
 */
export const deleteGoogleShort = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    const userId = context.userId;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = roleRow?.role === "admin";

    // Find in google_shorts
    const { data: gsRecord } = await (supabaseAdmin as any)
      .from("google_shorts")
      .select("id, user_id, link_id")
      .eq("id", data.id)
      .maybeSingle();

    if (gsRecord) {
      if (!isAdmin && gsRecord.user_id !== userId) {
        throw new Error("Unauthorized to delete this link");
      }
      await (supabaseAdmin as any).from("google_shorts").delete().eq("id", data.id);
      if (gsRecord.link_id) {
        await supabaseAdmin.from("clicks").delete().eq("link_id", gsRecord.link_id);
        await supabaseAdmin.from("links").delete().eq("id", gsRecord.link_id);
      }
      return { success: true };
    }

    // Fallback: Check links table directly
    const { data: linkRecord } = await supabaseAdmin
      .from("links")
      .select("id, user_id")
      .eq("id", data.id)
      .maybeSingle();

    if (linkRecord) {
      if (!isAdmin && linkRecord.user_id !== userId) {
        throw new Error("Unauthorized to delete this link");
      }
      await supabaseAdmin.from("clicks").delete().eq("link_id", linkRecord.id);
      await (supabaseAdmin as any).from("google_shorts").delete().eq("link_id", linkRecord.id);
      await supabaseAdmin.from("links").delete().eq("id", linkRecord.id);
      return { success: true };
    }

    return { success: true };
  });

export const adminDeleteGoogleLink = deleteGoogleShort;

export const adminRegisterInhouseGoogleLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        googleUrl: z.string().min(3),
        destinationUrl: z.string().url(),
        mode: z.enum(["inhouse_share", "inhouse_script"]).default("inhouse_share"),
        notes: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return generateGoogleShort({
      data: {
        offerUrl: data.destinationUrl,
        notes: data.notes,
      },
    });
  });

export const adminVerifyAndPairGoogleToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        shortCode: z.string().min(1),
        googleInput: z.string().min(1),
        notes: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return generateGoogleShort({
      data: {
        offerUrl: `https://adswapx.com/${data.shortCode}`,
        googleShareCode: data.googleInput,
        notes: data.notes,
      },
    });
  });

export const adminTraceRedirect = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        url: z.string().min(1),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    let targetUrl = data.url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    const hops: HopDetail[] = [];
    let cur = targetUrl;
    let totalLatency = 0;
    const maxHops = 6;

    for (let i = 0; i < maxHops; i++) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(cur, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          },
        });
        clearTimeout(timeout);

        const latency = Date.now() - start;
        totalLatency += latency;
        const loc = res.headers.get("location");
        const server = res.headers.get("server") || undefined;
        const contentType = res.headers.get("content-type") || undefined;

        hops.push({
          hop: i + 1,
          url: cur,
          status: res.status,
          statusText: res.statusText,
          server,
          location: loc,
          contentType,
          latencyMs: latency,
        });

        if (res.status >= 300 && res.status < 400 && loc) {
          cur = new URL(loc, cur).toString();
        } else {
          break;
        }
      } catch (err: any) {
        const latency = Date.now() - start;
        totalLatency += latency;
        hops.push({
          hop: i + 1,
          url: cur,
          status: 0,
          error: err.name === "AbortError" ? "Request timed out (>7s)" : err.message,
          latencyMs: latency,
        });
        break;
      }
    }

    const firstHop = hops[0]?.url || targetUrl;
    const lastHop = hops[hops.length - 1]?.url || targetUrl;

    const isGoogleDomain =
      firstHop.includes("google.com") ||
      firstHop.includes("share.google") ||
      firstHop.includes("goo.gl");

    return {
      initialUrl: targetUrl,
      finalUrl: lastHop,
      totalLatencyMs: totalLatency,
      hops,
      isGoogleDomain,
      metaPostSafe: isGoogleDomain,
      verdict: isGoogleDomain
        ? "Verified Official Google Domain: Post scanners whitelist this link (DA 100)."
        : "External domain.",
    };
  });
