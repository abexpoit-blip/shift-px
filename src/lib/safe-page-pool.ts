/**
 * Phase A: Fixed pool of 5 real Breezy pages used as safe redirects for bot
 * traffic. Sticky per visitor (fingerprint hash) + per short_code, so the
 * SAME visitor always sees the SAME page on revisit — looks like a normal
 * site, not a cloaking rotation.
 *
 * Includes:
 *  - Health tracking (unhealthy URLs auto-skipped, next healthy URL used)
 *  - Lazy background HEAD self-check every HEALTH_CHECK_INTERVAL_MS
 *  - Structured pick log returned to caller (for redirect audit log)
 */
import { fetchIpv4 } from "@/lib/fetch-ipv4";
import { isAdspxSaasHost } from "@/lib/site-hosts";
import { DEFAULT_SHORT_ORIGIN } from "@/lib/short-domains";

/**
 * Default content host used when the caller can't supply the serving origin.
 * MUST never be the SaaS host (adspx.com) — an ad reviewer following a safe
 * redirect must land on neutral content, not on the link-shortener product.
 */
export const SAFE_CONTENT_ORIGIN = DEFAULT_SHORT_ORIGIN;

/**
 * Real, indexable pages that exist in this app (see src/routes/*). Stored as
 * PATHS so the safe redirect always stays on the SAME origin the visitor
 * already hit — no cross-domain hop, no shortener↔content footprint.
 */
export const SAFE_PAGE_PATHS: readonly string[] = [
  "/blog/magnesium-sleep-guide-2026",
  "/blog/science-backed-sleep-hacks-2026",
  "/blog/blue-light-and-sleep",
  "/blog/best-sleep-apps-insomnia-2026",
  "/blog/healthy-morning-routine",
  "/blog/travel-gadgets-flights",
  "/blog/best-tech-gifts-under-100",
  "/shop/smart-sleep-headphones",
  "/shop/blue-light-glasses",
  "/faq",
  "/size-guide",
  "/about",
] as const;

/**
 * Resolve the origin a safe page must be served from.
 *
 * Rule: stay on whatever shortener domain the visitor already hit, so adding
 * a brand new shortener domain needs ZERO code changes. Only when the caller
 * gives us the SaaS host (or nothing usable) do we fall back to the default
 * shortener origin — the SaaS main domain must never appear in an ad-review
 * path, but it is never blocked either (it keeps serving the product).
 */
export function normOrigin(origin?: string | null): string {
  const raw = (origin || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) return SAFE_CONTENT_ORIGIN;
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    return SAFE_CONTENT_ORIGIN;
  }
  // SaaS host, localhost, raw IP, preview host → use the default shortener.
  if (isAdspxSaasHost(host)) return SAFE_CONTENT_ORIGIN;
  return raw;
}

/** Absolute safe-page fallback URL for the origin the visitor is on. */
export function safeFallbackFor(origin?: string | null): string {
  return `${normOrigin(origin)}/`;
}

/** Absolute pool for a given serving origin. */
export function safePoolFor(origin?: string | null): string[] {
  const o = normOrigin(origin);
  return SAFE_PAGE_PATHS.map((p) => `${o}${p}`);
}

/** Health-check pool (default origin) — kept for the admin refresh route. */
export const SAFE_PAGE_POOL: readonly string[] = safePoolFor(SAFE_CONTENT_ORIGIN);

// Mark a URL unhealthy for this long after a 4xx/5xx is observed.
const UNHEALTHY_TTL_MS = 10 * 60 * 1000; // 10 min
// Re-run full pool HEAD check at most this often (lazy, non-blocking).
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
// HEAD timeout per URL.
const HEALTH_CHECK_TIMEOUT_MS = 4000;

type HealthEntry = { unhealthyUntil: number; lastStatus: number | null; lastCheckedAt: number };
const health: Map<string, HealthEntry> = new Map();
let lastFullCheckAt = 0;
let inflightCheck: Promise<void> | null = null;

// djb2 — fast, well-distributed string hash. Stable across processes.
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function isHealthy(url: string, now: number): boolean {
  const h = health.get(url);
  if (!h) return true;
  return h.unhealthyUntil <= now;
}

export function markSafePageUnhealthy(url: string, status: number | null = null): void {
  const now = Date.now();
  health.set(url, {
    unhealthyUntil: now + UNHEALTHY_TTL_MS,
    lastStatus: status,
    lastCheckedAt: now,
  });
}

export function markSafePageHealthy(url: string, status = 200): void {
  health.set(url, { unhealthyUntil: 0, lastStatus: status, lastCheckedAt: Date.now() });
}

export function getSafePoolHealth(): Array<{
  url: string;
  healthy: boolean;
  lastStatus: number | null;
  lastCheckedAt: number;
  unhealthyUntil: number;
}> {
  const now = Date.now();
  return SAFE_PAGE_POOL.map((url) => {
    const h = health.get(url);
    return {
      url,
      healthy: !h || h.unhealthyUntil <= now,
      lastStatus: h?.lastStatus ?? null,
      lastCheckedAt: h?.lastCheckedAt ?? 0,
      unhealthyUntil: h?.unhealthyUntil ?? 0,
    };
  });
}

async function headCheck(url: string): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    // Use GET with Range header — some hosts/CDNs don't answer HEAD reliably.
    const r = await fetchIpv4(url, {
      method: "GET",
      headers: { range: "bytes=0-0", "user-agent": "BreezySocial-Healthcheck/1.0" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (r.status >= 200 && r.status < 400) {
      markSafePageHealthy(url, r.status);
    } else {
      markSafePageUnhealthy(url, r.status);
      console.warn(JSON.stringify({
        event: "safe_pool.unhealthy",
        url,
        status: r.status,
        reason: "non-2xx-on-check",
      }));
    }
  } catch (e) {
    // Network-level failure (DNS/IPv6/hairpin from inside the VPS) is NOT
    // evidence the page is broken for real visitors. Never mark unhealthy on
    // transport errors — only real 4xx/5xx responses count.
    console.warn(JSON.stringify({
      event: "safe_pool.check_skipped",
      url,
      reason: "transport-error",
      error: (e as Error)?.message,
    }));
  } finally {
    clearTimeout(t);
  }
}

/** Lazy, non-blocking full-pool health check. At most one inflight at a time. */
export function maybeRunHealthCheck(): void {
  const now = Date.now();
  if (inflightCheck) return;
  if (now - lastFullCheckAt < HEALTH_CHECK_INTERVAL_MS) return;
  lastFullCheckAt = now;
  inflightCheck = Promise.allSettled(SAFE_PAGE_POOL.map(headCheck))
    .then(() => undefined)
    .finally(() => {
      inflightCheck = null;
    });
}

/**
 * Force a full-pool re-check RIGHT NOW, bypassing the throttle interval.
 * Awaitable — use from an admin trigger route.
 */
export async function forceHealthCheck(): Promise<Array<{ url: string; healthy: boolean; status: number | null }>> {
  // Clear all prior unhealthy marks so a recovered URL gets a clean slate.
  health.clear();
  if (inflightCheck) await inflightCheck;
  lastFullCheckAt = Date.now();
  const p = Promise.allSettled(SAFE_PAGE_POOL.map(headCheck)).then(() => undefined);
  inflightCheck = p.finally(() => { inflightCheck = null; });
  await p;
  const now = Date.now();
  return SAFE_PAGE_POOL.map((url) => {
    const h = health.get(url);
    return {
      url,
      healthy: !h || h.unhealthyUntil <= now,
      status: h?.lastStatus ?? null,
    };
  });
}


export type SafePagePick = {
  url: string;
  index: number;
  fallbackFrom: number | null; // original idx if we had to skip unhealthy
};

/**
 * Deterministic pick from the safe pool. Same (code, fpHash) → same URL.
 * If the chosen URL is currently marked unhealthy, advance to the next
 * healthy URL (preserves stickiness while routing around broken pages).
 * Also kicks off a lazy background health check.
 */
export function pickSafePage(
  code: string,
  fpHash: string | null | undefined,
  origin?: string | null,
): SafePagePick {
  maybeRunHealthCheck();
  const now = Date.now();
  const pool = safePoolFor(origin);
  const key = `${code}|${fpHash || "anon"}`;
  const startIdx = djb2(key) % pool.length;

  for (let step = 0; step < pool.length; step++) {
    const i = (startIdx + step) % pool.length;
    if (isHealthy(pool[i], now)) {
      return {
        url: pool[i],
        index: i,
        fallbackFrom: step === 0 ? null : startIdx,
      };
    }
  }
  // All unhealthy → use original pick anyway (better than SAFE_FALLBACK loop).
  return { url: pool[startIdx], index: startIdx, fallbackFrom: null };
}

/** Backward-compat shim — returns only the URL. */
export function pickSafePageUrl(
  code: string,
  fpHash: string | null | undefined,
  origin?: string | null,
): string {
  return pickSafePage(code, fpHash, origin).url;
}
