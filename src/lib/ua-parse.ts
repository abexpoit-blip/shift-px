/**
 * Tiny UA classifier shared by the statistics layer.
 *
 * The hot `clicks` table only stores a capped `ua` string (no device/browser
 * columns any more — see migration 35). Anything older than 7 days comes from
 * the `click_dim_daily` archive, which stores the SAME buckets, so both paths
 * must agree on the vocabulary below.
 */

export type DeviceBucket = "mobile" | "desktop" | "tablet" | "other";

export function deviceBucket(ua: string | null | undefined): DeviceBucket {
  const u = (ua ?? "").toLowerCase();
  if (!u) return "other";
  if (/ipad|tablet/.test(u)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(u)) return "mobile";
  return "desktop";
}

export function browserBucket(ua: string | null | undefined): string {
  const u = (ua ?? "").toLowerCase();
  if (!u) return "other";
  if (u.includes("edg/")) return "edge";
  if (u.includes("opr/") || u.includes("opera")) return "opera";
  if (u.includes("samsungbrowser")) return "samsung";
  if (/firefox|fxios/.test(u)) return "firefox";
  if (/chrome|crios/.test(u)) return "chrome";
  if (u.includes("safari")) return "safari";
  return "other";
}

export function sourceBucket(host: string | null | undefined): string {
  const h = (host ?? "").toLowerCase();
  if (!h) return "direct";
  if (/facebook|fb\./.test(h)) return "facebook";
  if (h.includes("instagram")) return "instagram";
  if (h.includes("tiktok")) return "tiktok";
  if (/youtube|youtu\.be/.test(h)) return "youtube";
  if (/twitter|x\.com|t\.co/.test(h)) return "twitter";
  if (/t\.me|telegram/.test(h)) return "telegram";
  if (/whatsapp|wa\.me/.test(h)) return "whatsapp";
  if (h.includes("google")) return "google";
  return "other";
}

const LABELS: Record<string, string> = {
  mobile: "Mobile",
  desktop: "Desktop",
  tablet: "Tablet",
  other: "Other",
  direct: "Direct",
  edge: "Edge",
  opera: "Opera",
  samsung: "Samsung",
  firefox: "Firefox",
  chrome: "Chrome",
  safari: "Safari",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  google: "Google",
};

export function bucketLabel(slug: string): string {
  return LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}
