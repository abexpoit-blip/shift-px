/**
 * Smart bot detection helpers — runs inside the redirect server route.
 * Pure functions, no DB calls (callers fetch rules separately).
 */

export type Action = "safe" | "block" | "offer";

export interface DetectInput {
  ua: string;
  ip: string;
  asn: string;
  country: string;
  referer: string;
  acceptLanguage: string;
  accept: string;
  acceptEncoding: string;
  secChUa: string;
  ja3: string;
}

export interface DetectSignals {
  score: number; // 0–100, higher = more bot-like
  reasons: string[];
  isHeadless: boolean;
  isDirectHit: boolean;
}

/**
 * djb2 hash → hex. Stable, fast, no crypto needed for fingerprint bucketing.
 */
export function quickHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint = stable bucket per device/network. Used for auto-blacklist.
 * Drops the last IPv4 octet so mobile NATs don't fragment into thousands of rows.
 */
export function fingerprint(input: DetectInput): string {
  const ipBucket = input.ip.includes(".")
    ? input.ip.split(".").slice(0, 3).join(".")
    : input.ip.split(":").slice(0, 4).join(":");
  const raw = [
    ipBucket,
    input.ua.slice(0, 120),
    input.acceptLanguage.slice(0, 40),
    input.acceptEncoding.slice(0, 40),
    input.secChUa.slice(0, 80),
  ].join("|");
  return quickHash(raw);
}

/**
 * Categorize the Referer host into a cohort source key.
 * Used for cohort analytics + referrer trust scoring.
 */
export function classifyReferrer(refererHost: string): string {
  if (!refererHost) return "direct";
  const h = refererHost.toLowerCase();
  if (/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/.test(h)) return "facebook";
  if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
  if (/(^|\.)t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/.test(h)) return "twitter";
  if (/(^|\.)t\.me$|(^|\.)telegram\.org$/.test(h)) return "telegram";
  if (/(^|\.)whatsapp\.com$|(^|\.)wa\.me$/.test(h)) return "whatsapp";
  if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h)) return "youtube";
  if (/(^|\.)reddit\.com$/.test(h)) return "reddit";
  if (/(^|\.)google\./.test(h)) return "google";
  if (/(^|\.)bing\.com$/.test(h)) return "bing";
  if (/(^|\.)yahoo\.com$/.test(h)) return "yahoo";
  if (/(^|\.)duckduckgo\.com$/.test(h)) return "duckduckgo";
  return "other";
}

/**
 * Header coherence analysis. Real browsers always send Accept, Accept-Language,
 * Accept-Encoding. Headless tools often skip one or send odd combos.
 */
export function analyzeSignals(input: DetectInput): DetectSignals {
  const reasons: string[] = [];
  let score = 0;
  const uaLow = input.ua.toLowerCase();

  const isHeadless =
    /headlesschrome|phantomjs|selenium|puppeteer|playwright|nightmare|electron/.test(uaLow);
  if (isHeadless) {
    score += 80;
    reasons.push("headless-ua");
  }

  if (!input.ua || input.ua.length < 20) {
    score += 40;
    reasons.push("empty/short-ua");
  }

  // Real browsers send Accept on navigation
  if (!input.accept) {
    score += 25;
    reasons.push("no-accept");
  }
  if (!input.acceptLanguage) {
    score += 25;
    reasons.push("no-accept-language");
  }
  if (!input.acceptEncoding) {
    score += 15;
    reasons.push("no-accept-encoding");
  }

  // Modern Chrome/Edge send sec-ch-ua. iOS Safari doesn't. Cross-check with UA.
  const claimsChrome = /chrome|edg\//i.test(uaLow);
  const claimsMobileSafari = /iphone|ipad/i.test(uaLow) && /safari/i.test(uaLow);
  if (claimsChrome && !input.secChUa) {
    score += 20;
    reasons.push("chrome-no-sec-ch-ua");
  }
  if (claimsMobileSafari && input.secChUa) {
    // Real iOS Safari never sends sec-ch-ua → spoofed UA
    score += 30;
    reasons.push("ios-with-sec-ch-ua");
  }

  // Accept-Language empty + datacenter ASN combo → strong bot
  if (!input.acceptLanguage && input.asn) {
    score += 10;
  }

  const isDirectHit = !input.referer;

  return { score: Math.min(score, 100), reasons, isHeadless, isDirectHit };
}

/**
 * Apply cloaking rules (UA/ASN/IP/country patterns) — first match wins by priority.
 */
export interface CloakingRule {
  rule_type: "ua" | "ip" | "asn" | "country";
  pattern: string;
  action: Action;
  label: string | null;
}

export function matchCloaking(
  input: DetectInput,
  rules: CloakingRule[],
): { rule: CloakingRule; matchKey: string } | null {
  const uaLow = input.ua.toLowerCase();
  for (const r of rules) {
    const p = (r.pattern || "").toLowerCase();
    if (!p) continue;
    if (r.rule_type === "ua" && uaLow.includes(p)) return { rule: r, matchKey: `ua:${p}` };
    if (r.rule_type === "asn" && input.asn && input.asn === p)
      return { rule: r, matchKey: `asn:${p}` };
    if (r.rule_type === "ip" && input.ip && input.ip.startsWith(p))
      return { rule: r, matchKey: `ip:${p}` };
    if (
      r.rule_type === "country" &&
      input.country &&
      input.country.toUpperCase() === p.toUpperCase()
    )
      return { rule: r, matchKey: `country:${p}` };
  }
  return null;
}

/**
 * Apply referrer rules (host substring match, lowest priority).
 */
export interface ReferrerRule {
  pattern: string;
  trust_score: number;
  action: "allow" | "suspect" | "block";
  label: string | null;
}

export function matchReferrer(refererHost: string, rules: ReferrerRule[]): ReferrerRule | null {
  if (!refererHost) return null;
  const h = refererHost.toLowerCase();
  for (const r of rules) {
    const p = (r.pattern || "").toLowerCase();
    if (!p) continue;
    if (h === p || h.endsWith("." + p) || h.includes(p)) return r;
  }
  return null;
}

/**
 * Weighted random pick — used for A/B variants and multi-geo offers.
 */
export function weightedPick<T extends { weight_pct?: number; weight?: number }>(
  items: T[],
): T | null {
  if (items.length === 0) return null;
  const totals = items.map((i) => Math.max(1, i.weight_pct ?? i.weight ?? 1));
  const sum = totals.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= totals[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
