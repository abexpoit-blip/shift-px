import { useEffect, useState, useCallback } from "react";

/**
 * Domains flagged by Google Safe Browsing / blocklists. They must never be
 * offered or used as a default short domain — every link on them renders a
 * red "Dangerous site" interstitial. Remove a host from here only after the
 * Safe Browsing review has actually cleared it.
 */
export const FLAGGED_SHORT_DOMAINS: readonly string[] = ["tekuc.com"];

export function isFlaggedShortDomain(host: string): boolean {
  const h = (host || "")
    .toLowerCase()
    .split(":")[0]
    .replace(/^www\./, "")
    .trim();
  return FLAGGED_SHORT_DOMAINS.includes(h);
}

export const SHORT_DOMAINS = [
  { host: "adswapx.com", label: "adswapx.com (Primary)" },
] as const;

export type ShortDomainHost = string;

/**
 * Default shortener host. Safe pages / articles are ALWAYS served from a
 * shortener domain — never from the SaaS main domain. Add new shortener
 * domains to SHORT_DOMAINS and the whole safe-page system picks it up
 * automatically (visitors always stay on the domain they arrived on).
 */
export const DEFAULT_SHORT_HOST = "adswapx.com";
export const DEFAULT_SHORT_ORIGIN = `https://${DEFAULT_SHORT_HOST}`;

const STORAGE_KEY = "adspx.shortDomain";
const DEFAULT_HOST = "adswapx.com";

function isValidHost(h: string | null): h is string {
  return typeof h === "string" && h.length > 0 && !isFlaggedShortDomain(h);
}

/**
 * Returns the currently selected short-link domain (e.g. "adswapx.com")
 * and a setter that persists the choice to localStorage.
 *
 * Both domains route to the same backend, so any short code works on either.
 * Default: adswapx.com (the dedicated Adspx shortener domain).
 */
export function useShortDomain(): {
  host: ShortDomainHost;
  baseUrl: string;
  setHost: (h: ShortDomainHost) => void;
} {
  const [host, setHostState] = useState<ShortDomainHost>(DEFAULT_HOST);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isValidHost(saved)) setHostState(saved);
  }, []);

  const setHost = useCallback((h: ShortDomainHost) => {
    setHostState(h);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, h);
    }
  }, []);

  return { host, baseUrl: `https://${host}`, setHost };
}

/** Build a clean short URL like https://adswapx.com/abc123 (no /r/ prefix). */
export function buildShortUrl(host: ShortDomainHost, code: string): string {
  return `https://${host}/${code}`;
}
