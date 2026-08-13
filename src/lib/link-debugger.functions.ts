import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestAuth } from "@/lib/request-auth.server";

export type BotKey = "facebook" | "twitter" | "linkedin" | "whatsapp" | "google" | "browser";

const BOT_UA: Record<BotKey, string> = {
  facebook:
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  twitter: "Twitterbot/1.0",
  linkedin:
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  whatsapp: "WhatsApp/2.23.20.0 A",
  google:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  browser:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

const PAID_PLANS = new Set(["monthly", "lifetime", "unlimited", "yearly", "pro"]);

function isPaidPlan(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return PAID_PLANS.has(slug.toLowerCase());
}

type MetaTag = { kind: "name" | "property" | "title" | "link"; key: string; value: string };

function parseHtmlMeta(html: string): { title: string | null; tags: MetaTag[] } {
  // Limit HTML size we scan (some pages are huge)
  const head = html.slice(0, 250_000);
  const tags: MetaTag[] = [];

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()).slice(0, 300) : null;
  if (title) tags.push({ kind: "title", key: "title", value: title });

  // <meta name|property="..." content="...">
  const metaRe = /<meta\b[^>]*?>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(head))) {
    const tag = m[0];
    const nameMatch = tag.match(/\s(name|property)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\scontent\s*=\s*["']([^"']*)["']/i);
    if (!nameMatch || !contentMatch) continue;
    tags.push({
      kind: nameMatch[1].toLowerCase() === "property" ? "property" : "name",
      key: nameMatch[2].trim(),
      value: decodeEntities(contentMatch[1]).slice(0, 800),
    });
  }

  // canonical
  const linkRe = /<link\b[^>]*?>/gi;
  while ((m = linkRe.exec(head))) {
    const tag = m[0];
    const rel = tag.match(/\srel\s*=\s*["']([^"']+)["']/i);
    const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i);
    if (!rel || !href) continue;
    const r = rel[1].toLowerCase();
    if (r === "canonical" || r === "alternate") {
      tags.push({ kind: "link", key: `rel=${r}`, value: decodeEntities(href[1]).slice(0, 800) });
    }
  }

  return { title, tags };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function pick(tags: MetaTag[], key: string): string | null {
  const t = tags.find((x) => x.key.toLowerCase() === key.toLowerCase());
  return t ? t.value : null;
}

function buildWarnings(opts: {
  status: number;
  contentType: string;
  title: string | null;
  tags: MetaTag[];
  finalUrl: string;
}): { level: "error" | "warn" | "info"; msg: string }[] {
  const out: { level: "error" | "warn" | "info"; msg: string }[] = [];
  const { status, contentType, title, tags, finalUrl } = opts;

  if (status >= 400) out.push({ level: "error", msg: `HTTP ${status} — crawler may drop preview` });
  if (status >= 300 && status < 400) out.push({ level: "warn", msg: `HTTP ${status} redirect` });
  if (!contentType.includes("text/html")) {
    out.push({ level: "warn", msg: `Content-Type "${contentType}" is not HTML — no preview can be built` });
    return out;
  }

  const ogTitle = pick(tags, "og:title");
  const ogDesc = pick(tags, "og:description");
  const ogImage = pick(tags, "og:image");
  const ogUrl = pick(tags, "og:url");
  const ogType = pick(tags, "og:type");
  const twCard = pick(tags, "twitter:card");
  const desc = pick(tags, "description");

  if (!title) out.push({ level: "error", msg: "Missing <title> tag" });
  else if (title.length > 70) out.push({ level: "warn", msg: `Title is ${title.length} chars (recommended ≤ 60)` });

  if (!ogTitle) out.push({ level: "error", msg: "Missing og:title — Facebook/LinkedIn need this" });
  if (!ogDesc && !desc) out.push({ level: "warn", msg: "Missing og:description and meta description" });
  if (!ogImage) out.push({ level: "error", msg: "Missing og:image — preview card will have no image" });
  else if (!/^https?:\/\//i.test(ogImage)) out.push({ level: "error", msg: `og:image is not an absolute URL (${ogImage.slice(0, 80)})` });

  if (!ogUrl) out.push({ level: "info", msg: "Missing og:url (recommended)" });
  if (!ogType) out.push({ level: "info", msg: "Missing og:type (recommended: website / article)" });
  if (!twCard) out.push({ level: "info", msg: "Missing twitter:card (recommended: summary_large_image)" });

  if (ogUrl && finalUrl) {
    try {
      const a = new URL(ogUrl);
      const b = new URL(finalUrl);
      if (a.host !== b.host || a.pathname.replace(/\/$/, "") !== b.pathname.replace(/\/$/, "")) {
        out.push({
          level: "warn",
          msg: `og:url (${a.host}${a.pathname}) does not match fetched URL — crawler may attribute to the og:url page instead`,
        });
      }
    } catch {
      out.push({ level: "warn", msg: "og:url is not a valid absolute URL" });
    }
  }

  return out;
}

async function fetchAsBot(url: string, ua: string) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "";
    const elapsed = Date.now() - started;
    const text = contentType.includes("text") || contentType.includes("xml") || contentType.includes("json")
      ? new TextDecoder("utf-8", { fatal: false }).decode(buf)
      : "";
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      contentType,
      sizeBytes: buf.byteLength,
      elapsedMs: elapsed,
      body: text,
      headers: {
        "content-type": contentType,
        "content-length": String(buf.byteLength),
        server: res.headers.get("server") ?? "",
        "cache-control": res.headers.get("cache-control") ?? "",
        "x-robots-tag": res.headers.get("x-robots-tag") ?? "",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export const getMyPlan = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await getRequestAuth();
  const { data } = await ctx.supabase
    .from("profiles")
    .select("plan_slug")
    .eq("id", ctx.userId)
    .maybeSingle();
  const plan = (data as { plan_slug?: string | null } | null)?.plan_slug ?? "free";
  return { plan_slug: plan, is_paid: isPaidPlan(plan) };
});

export const debugLinkPreview = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        url: z.string().url().max(2048),
        bot: z.enum(["facebook", "twitter", "linkedin", "whatsapp", "google"]),
        compareBrowser: z.boolean().optional().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await getRequestAuth();

    // Plan gate — paid users only
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("plan_slug")
      .eq("id", ctx.userId)
      .maybeSingle();
    const plan = (profile as { plan_slug?: string | null } | null)?.plan_slug ?? "free";
    if (!isPaidPlan(plan)) {
      return { locked: true as const, plan };
    }

    // Block private/internal hosts
    let u: URL;
    try {
      u = new URL(data.url);
    } catch {
      throw new Error("Invalid URL");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Only http(s) URLs are supported");
    }
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new Error("Private / loopback hosts are not allowed");
    }

    const botRes = await fetchAsBot(data.url, BOT_UA[data.bot]).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg } as const;
    });

    if ("error" in botRes) {
      return { locked: false as const, error: botRes.error, bot: data.bot };
    }

    const parsed = parseHtmlMeta(botRes.body);
    const warnings = buildWarnings({
      status: botRes.status,
      contentType: botRes.contentType,
      title: parsed.title,
      tags: parsed.tags,
      finalUrl: botRes.finalUrl,
    });

    return {
      locked: false as const,
      bot: data.bot,
      requestedUrl: data.url,
      finalUrl: botRes.finalUrl,
      status: botRes.status,
      contentType: botRes.contentType,
      sizeBytes: botRes.sizeBytes,
      elapsedMs: botRes.elapsedMs,
      headers: botRes.headers,
      title: parsed.title,
      meta: parsed.tags,
      preview: {
        title: pick(parsed.tags, "og:title") ?? parsed.title,
        description: pick(parsed.tags, "og:description") ?? pick(parsed.tags, "description"),
        image: pick(parsed.tags, "og:image"),
        url: pick(parsed.tags, "og:url") ?? botRes.finalUrl,
        siteName: pick(parsed.tags, "og:site_name"),
      },
      warnings,
      cloakDiff: null as null,
    };
  });
