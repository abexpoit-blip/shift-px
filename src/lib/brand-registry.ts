/**
 * Per-host brand identity for safe pages / articles.
 *
 * Goal — every safe-content domain (tekuc.com, breezysocial.com, adspx.com,
 * and any future host) presents a DIFFERENT brand name / tagline / email to
 * Meta / Facebook / Google crawlers. This breaks the cross-domain footprint:
 * the crawler sees three unrelated ecommerce brands, not three mirrors of
 * one site.
 *
 * The internal storefront copy is written around "BreezySocial" — we
 * intercept that token in og:title / og:description at meta-build time and
 * swap it for the host's brand. No route file needs to know which brand it
 * is running under.
 */

export type Brand = {
  /** Display brand name — replaces "BreezySocial" tokens in titles/desc. */
  name: string;
  /** Short tagline used for og:site_name where useful. */
  tagline: string;
  /** Support email surfaced in schema.org / contact info. */
  email: string;
  /** City / country line for local-business schema. */
  city: string;
  /** Bare hostname for this brand (no www), used in visible policy copy. */
  host: string;
};

const REGISTRY: Record<string, Brand> = {
  "tekuc.com": {
    name: "Tekuc",
    tagline: "Modern wellness tech for calm, focused living.",
    email: "hello@tekuc.com",
    city: "Austin, TX",
    host: "tekuc.com",
  },
  "breezysocial.com": {
    name: "BreezySocial",
    tagline: "Smart gadgets for calm, modern living.",
    email: "hello@breezysocial.com",
    city: "San Francisco, CA",
    host: "breezysocial.com",
  },
  "skypq.com": {
    name: "Skypq",
    tagline: "Everyday essentials, thoughtfully made.",
    email: "hello@skypq.com",
    city: "Denver, CO",
    host: "skypq.com",
  },
  "mefok.com": {
    name: "Mefok",
    tagline: "Simple home gear for better daily routines.",
    email: "hello@mefok.com",
    city: "Portland, OR",
    host: "mefok.com",
  },
  "adswapx.com": {
    name: "Adswapx",
    tagline: "Everyday finds, simply delivered.",
    email: "hello@adswapx.com",
    city: "Chicago, IL",
    host: "adswapx.com",
  },
  "adspx.com": {
    name: "Adspx",
    tagline: "Sleep-first gear engineered for real rest.",
    email: "hello@adspx.com",
    city: "Seattle, WA",
    host: "adspx.com",
  },
};

/** Our own shortener host is the fallback identity — never another domain's brand. */
const DEFAULT_BRAND: Brand = REGISTRY["adswapx.com"];

function hostOf(origin: string): string {
  try {
    return new URL(origin).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return origin
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./, "")
      .toLowerCase();
  }
}

/**
 * Any NEW shortener domain added later gets its own coherent identity
 * derived from its own hostname — never a leftover brand from another
 * domain. Two domains must never look like the same site (Meta/Google
 * both treat duplicated brand footprints as a cloaking signal).
 */
const AUTO_TAGLINES = [
  "Everyday finds, simply delivered.",
  "Practical gear for calmer days.",
  "Small upgrades for better routines.",
  "Thoughtful essentials, honestly priced.",
] as const;
const AUTO_CITIES = ["Austin, TX", "Columbus, OH", "Boise, ID", "Raleigh, NC"] as const;

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function autoBrand(host: string): Brand {
  const label = host.split(".")[0] || host;
  const name = label.charAt(0).toUpperCase() + label.slice(1);
  const h = hashStr(host);
  return {
    name,
    tagline: AUTO_TAGLINES[h % AUTO_TAGLINES.length],
    email: `hello@${host}`,
    host,
    city: AUTO_CITIES[(h >>> 3) % AUTO_CITIES.length],
  };
}

export function brandForOrigin(origin: string): Brand {
  const host = hostOf(origin);
  if (REGISTRY[host]) return REGISTRY[host];
  if (host && host.includes(".")) return autoBrand(host);
  return DEFAULT_BRAND;
}

/**
 * Rewrite any "BreezySocial" mention in a string to the host's brand name.
 * Case-preserving for the plain form; leaves other brand words alone.
 */
export function rebrand(text: string, origin: string): string {
  const brand = brandForOrigin(origin);
  if (brand.name === "BreezySocial" || !text) return text;
  return text
    .replace(/BreezySocial/g, brand.name)
    .replace(/breezysocial/g, brand.name.toLowerCase());
}
