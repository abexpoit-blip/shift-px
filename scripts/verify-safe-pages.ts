#!/usr/bin/env bun
/**
 * Crawl the 5 safe pages and verify:
 *  - HTTP 200 (follows redirects)
 *  - <link rel="canonical"> present and on breezysocial.com
 *  - OpenGraph: og:title, og:description, og:url, og:image
 *  - Twitter: twitter:card, twitter:title, twitter:description
 *  - Page listed in sitemap.xml
 *
 * Usage:
 *   bun scripts/verify-safe-pages.ts
 *   bun scripts/verify-safe-pages.ts --origin https://breezysocial.com
 *
 * Exits 0 on full pass, 1 on any failure (CI-friendly).
 */
import { SAFE_PAGE_POOL } from "../src/lib/safe-page-pool";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");
}
const ORIGIN = args.get("origin") || "https://breezysocial.com";
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;

type Severity = "critical" | "important" | "nice-to-have";
type Check = {
  name: string;
  ok: boolean;
  detail?: string;
  severity?: Severity;
  expected?: string;
  reason?: string;
  fixHint?: string;
};
type Report = { url: string; status: number | null; checks: Check[]; pass: boolean; headSnippet?: string };

// Per-tag metadata for rich missing-tag logging.
const TAG_META: Record<string, { severity: Severity; why: string; fixHint: string }> = {
  "canonical present":   { severity: "critical",  why: "Crawlers attribute content to the canonical URL; missing → duplicate-content risk.",   fixHint: "Add <link rel='canonical' href='<page-url>'> in route head().links" },
  "og:title":            { severity: "critical",  why: "FB/Meta uses this as share-card headline.",                                              fixHint: "head().meta: { property: 'og:title', content: '<page title>' }" },
  "og:description":      { severity: "critical",  why: "FB share-card subtitle; missing → bot sees thin preview.",                              fixHint: "head().meta: { property: 'og:description', content: '<short description>' }" },
  "og:url":              { severity: "critical",  why: "Self-reference URL used by FB crawler to confirm page identity.",                       fixHint: "head().meta: { property: 'og:url', content: 'https://breezysocial.com<path>' }" },
  "og:image":            { severity: "important", why: "Share preview image. Without it FB shows a blank/random thumb.",                        fixHint: "head().meta: { property: 'og:image', content: 'https://breezysocial.com/og-default.png' }" },
  "twitter:card":        { severity: "important", why: "Twitter/X card type. Default behaviour without it is plain link.",                      fixHint: "head().meta: { name: 'twitter:card', content: 'summary_large_image' }" },
  "twitter:title":       { severity: "important", why: "Twitter/X card headline.",                                                              fixHint: "head().meta: { name: 'twitter:title', content: '<page title>' }" },
  "twitter:description": { severity: "important", why: "Twitter/X card subtitle.",                                                              fixHint: "head().meta: { name: 'twitter:description', content: '<short description>' }" },
  "in sitemap.xml":      { severity: "important", why: "Page must be in sitemap to look like a normal indexed URL to FB.",                      fixHint: "Add <url><loc>https://breezysocial.com<path></loc></url> to src/routes/sitemap[.]xml.ts" },
  "HTTP 200":            { severity: "critical",  why: "Bot must get 200 OK or it flags the destination as broken.",                            fixHint: "Check route handler / server logs for 4xx/5xx" },
};

function enrich(c: Check): Check {
  if (c.ok) return c;
  const m = TAG_META[c.name];
  if (!m) return c;
  return { ...c, severity: m.severity, reason: m.why, fixHint: m.fixHint };
}

function extractHeadSnippet(html: string): string {
  const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  if (!m) return "(no <head> found)";
  // Compact whitespace, cap length so logs stay readable.
  return m[1].replace(/\s+/g, " ").trim().slice(0, 2000);
}

function extractMeta(html: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const m = re.exec(html);
  if (m) return m[1];
  // Try reversed attribute order
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    "i",
  );
  const m2 = re2.exec(html);
  return m2 ? m2[1] : null;
}

function extractCanonical(html: string): string | null {
  const m = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html);
  return m ? m[1] : null;
}

async function fetchSitemapUrls(): Promise<Set<string>> {
  try {
    const r = await fetch(SITEMAP_URL);
    if (!r.ok) return new Set();
    const xml = await r.text();
    const urls = new Set<string>();
    const re = /<loc>([^<]+)<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) urls.add(m[1].trim());
    return urls;
  } catch {
    return new Set();
  }
}

async function checkPage(url: string, sitemapUrls: Set<string>): Promise<Report> {
  const checks: Check[] = [];
  let status: number | null = null;
  let html = "";
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "BreezySocial-Verify/1.0" } });
    status = r.status;
    html = await r.text();
    checks.push({ name: "HTTP 200", ok: r.ok, detail: `status ${r.status}` });
  } catch (e) {
    checks.push({ name: "HTTP 200", ok: false, detail: `fetch failed: ${(e as Error).message}` });
    return { url, status, checks, pass: false };
  }

  const canonicalRaw = extractCanonical(html);
  const canonicalAbs = canonicalRaw ? new URL(canonicalRaw, url).toString() : null;
  const pageAbs = new URL(url).toString();
  checks.push({
    name: "canonical present",
    ok: !!canonicalAbs && (canonicalAbs === pageAbs || canonicalAbs.replace(/\/$/, "") === pageAbs.replace(/\/$/, "")),
    detail: canonicalAbs || "missing",
  });

  for (const k of ["og:title", "og:description", "og:url", "og:image"] as const) {
    const v = extractMeta(html, "property", k);
    const ok = k === "og:url"
      ? !!v && new URL(v, url).toString().replace(/\/$/, "") === pageAbs.replace(/\/$/, "")
      : !!v;
    checks.push({ name: k, ok, detail: v ? v.slice(0, 80) : "missing" });
  }
  for (const k of ["twitter:card", "twitter:title", "twitter:description"] as const) {
    const v = extractMeta(html, "name", k);
    checks.push({ name: k, ok: !!v, detail: v ? v.slice(0, 80) : "missing" });
  }

  const inSitemap = sitemapUrls.has(url) || sitemapUrls.has(url.replace(/\/$/, ""));
  checks.push({ name: "in sitemap.xml", ok: inSitemap, detail: inSitemap ? "yes" : `not in ${SITEMAP_URL}` });

  const enriched = checks.map(enrich);
  return {
    url,
    status,
    checks: enriched,
    pass: enriched.every((c) => c.ok),
    headSnippet: extractHeadSnippet(html),
  };
}

async function main() {
  const verbose = args.has("verbose") || process.env.VERBOSE === "1";
  const jsonOut = args.has("json");

  console.log(`\nVerifying ${SAFE_PAGE_POOL.length} safe pages against ${ORIGIN}`);
  console.log(`flags: verbose=${verbose} json=${jsonOut}\n`);
  const sitemapUrls = await fetchSitemapUrls();
  console.log(`sitemap loaded: ${sitemapUrls.size} urls\n`);

  const reports: Report[] = [];
  for (const url of SAFE_PAGE_POOL) {
    const target = url.replace("https://breezysocial.com", ORIGIN);
    reports.push(await checkPage(target, sitemapUrls));
  }

  // Aggregate missing-tag stats across all pages.
  const missingByTag = new Map<string, string[]>();
  let failed = 0;

  for (const r of reports) {
    const mark = r.pass ? "PASS" : "FAIL";
    console.log(`[${mark}] ${r.url}  (HTTP ${r.status ?? "?"})`);
    for (const c of r.checks) {
      const m = c.ok ? "  ok  " : " FAIL ";
      console.log(`   [${m}] ${c.name.padEnd(22)} ${c.detail ?? ""}`);
      if (!c.ok) {
        const arr = missingByTag.get(c.name) ?? [];
        arr.push(r.url);
        missingByTag.set(c.name, arr);

        // Rich per-failure detail block.
        const sev = c.severity ? `[${c.severity.toUpperCase()}]` : "";
        console.log(`          ↳ ${sev} ${c.reason ?? "(no reason recorded)"}`);
        if (c.fixHint) console.log(`          ↳ FIX:    ${c.fixHint}`);
        console.log(`          ↳ FOUND:  ${c.detail ?? "(nothing)"}`);
      }
    }
    if (verbose) {
      console.log(`   ── <head> snippet (2KB max) ───────────────`);
      console.log(`   ${r.headSnippet ?? "(none)"}`);
      console.log(`   ───────────────────────────────────────────`);
    }
    if (!r.pass) failed++;
    console.log("");
  }

  // Roll-up: which tags are systemically missing across pages.
  if (missingByTag.size > 0) {
    console.log("── Missing meta roll-up ─────────────────────────────");
    const rows = [...missingByTag.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [tag, urls] of rows) {
      const meta = TAG_META[tag];
      const sev = meta ? `[${meta.severity}]` : "";
      console.log(`  ${sev} ${tag}  — missing on ${urls.length}/${reports.length} page(s)`);
      for (const u of urls) console.log(`        · ${u}`);
      if (meta) {
        console.log(`        why: ${meta.why}`);
        console.log(`        fix: ${meta.fixHint}`);
      }
    }
    console.log("─────────────────────────────────────────────────────\n");
  }

  console.log(`Summary: ${reports.length - failed}/${reports.length} passed`);

  if (jsonOut) {
    console.log("\n── JSON report ──");
    console.log(JSON.stringify({ origin: ORIGIN, reports, missingByTag: Object.fromEntries(missingByTag) }, null, 2));
  } else {
    console.log(`Tip: re-run with --verbose to print each page's <head> snippet,`);
    console.log(`     or --json for a machine-readable report.`);
  }

  process.exit(failed === 0 ? 0 : 1);
}


main().catch((e) => {
  console.error("verify-safe-pages crashed:", e);
  process.exit(2);
});
