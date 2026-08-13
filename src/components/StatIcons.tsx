import { Smartphone, Tablet, Monitor, HelpCircle } from "lucide-react";

/**
 * Premium country flag — high-res PNG from flagcdn (free, CDN-cached).
 * Falls back to a neutral chip when code is unknown.
 */
export function Flag({
  code,
  small = false,
  large = false,
}: {
  code: string;
  small?: boolean;
  large?: boolean;
}) {
  const lower = (code ?? "").toLowerCase();
  const size = large ? "w-9 h-6" : small ? "w-5 h-3.5" : "w-7 h-5";
  if (!code || code === "??" || code.length !== 2) {
    return (
      <span
        className={`${size} inline-flex items-center justify-center bg-white/70 rounded-[3px] text-[#7D6452] text-[8px] ring-1 ring-black/5 shrink-0`}
        aria-label="Unknown country"
      >
        ?
      </span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${lower}.png`}
      srcSet={`https://flagcdn.com/w80/${lower}.png 2x, https://flagcdn.com/w160/${lower}.png 3x`}
      alt={code}
      className={`${size} object-cover rounded-[3px] ring-1 ring-black/10 shadow-sm shrink-0`}
      loading="lazy"
    />
  );
}

/**
 * Device icon — real brand SVGs (Android, Apple, Windows, Linux)
 * from simpleicons CDN, with lucide fallback for generic device types.
 */
export function DeviceIcon({
  name,
  os,
  large = false,
}: {
  name: string;
  os?: string;
  large?: boolean;
}) {
  const size = large ? "w-5 h-5" : "w-3.5 h-3.5";
  const o = (os ?? "").toLowerCase();
  if (o.includes("android"))
    return <img src="https://cdn.simpleicons.org/android/3DDC84" alt="Android" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("ios") || o.includes("ipad") || o.includes("iphone"))
    return <img src="https://cdn.simpleicons.org/apple/000000" alt="iOS" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("mac"))
    return <img src="https://cdn.simpleicons.org/apple/000000" alt="macOS" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("windows"))
    return <img src="https://cdn.simpleicons.org/windows11/0078D4" alt="Windows" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("linux"))
    return <img src="https://cdn.simpleicons.org/linux/000000" alt="Linux" className={`${size} shrink-0`} loading="lazy" />;
  const n = (name ?? "").toLowerCase();
  const cls = `${size} text-[#7D6452] shrink-0`;
  if (n === "mobile") return <Smartphone className={cls} />;
  if (n === "tablet") return <Tablet className={cls} />;
  if (n === "desktop") return <Monitor className={cls} />;
  return <HelpCircle className={cls} />;
}

/**
 * Browser brand icon — simpleicons CDN with brand color baked in.
 */
export function BrowserIcon({
  slug,
  color,
  title,
  large = false,
}: {
  slug: string;
  color: string;
  title: string;
  large?: boolean;
}) {
  const size = large ? "w-6 h-6" : "w-4 h-4";
  if (!slug || slug === "unknown") {
    return (
      <span
        className={`${size} inline-flex items-center justify-center bg-white/70 rounded text-[#7D6452] text-[10px] shrink-0`}
        title={title}
      >
        ?
      </span>
    );
  }
  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/${color}`}
      alt={title}
      title={title}
      className={`${size} shrink-0`}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

/* ---- Lightweight UA parsers (shared with backend analytics) ---- */
export function deviceFromUA(ua: string | null): {
  name: "Mobile" | "Desktop" | "Tablet" | "Other";
  os: string;
} {
  const u = (ua ?? "").toLowerCase();
  let os = "";
  if (u.includes("android")) os = "Android";
  else if (u.includes("iphone") || u.includes("ipad") || u.includes("ios")) os = "iOS";
  else if (u.includes("mac os") || u.includes("macintosh")) os = "macOS";
  else if (u.includes("windows")) os = "Windows";
  else if (u.includes("linux")) os = "Linux";
  let name: "Mobile" | "Desktop" | "Tablet" | "Other" = "Other";
  if (/ipad|tablet/.test(u)) name = "Tablet";
  else if (/mobile|android|iphone/.test(u)) name = "Mobile";
  else if (u) name = "Desktop";
  return { name, os };
}

export function browserFromUA(ua: string | null): {
  name: string;
  slug: string;
  color: string;
} {
  const u = (ua ?? "").toLowerCase();
  if (u.includes("samsungbrowser")) return { name: "Samsung Internet", slug: "samsung", color: "1428A0" };
  if (u.includes("ucbrowser")) return { name: "UC Browser", slug: "ucbrowser", color: "F8B500" };
  if (u.includes("edg/")) return { name: "Edge", slug: "microsoftedge", color: "0078D7" };
  if (u.includes("firefox")) return { name: "Firefox", slug: "firefoxbrowser", color: "FF7139" };
  if (u.includes("opr/") || u.includes("opera")) return { name: "Opera", slug: "opera", color: "FF1B2D" };
  if (u.includes("chrome") && !u.includes("chromium")) return { name: "Chrome", slug: "googlechrome", color: "4285F4" };
  if (u.includes("safari")) return { name: "Safari", slug: "safari", color: "000000" };
  return { name: "Unknown", slug: "unknown", color: "999999" };
}
