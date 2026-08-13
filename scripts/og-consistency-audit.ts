/**
 * OG consistency audit.
 *
 * For every active short link, fetch /r/{code} on EACH public domain
 * (breezysocial.com, sleepox.com) with the Facebook scraper UA and
 * verify that:
 *   - og:url        === https://{domain}/{code}  (clean URL, no /r/)
 *   - canonical     === https://{domain}/{code}
 *   - twitter:url   === https://{domain}/{code}
 *   - og:image      is a non-empty absolute https:// URL
 *   - HTTP status 200
 *
 * Any mismatch fails the run and writes a markdown report to
 * /tmp/og-consistency.md. Exit code is non-zero on any failure so the
 * script can be wired into cron / pre-deploy.
 *
 * Usage (VPS):
 *   cd /opt/sleepox-app-new && bun run scripts/og-consistency-audit.ts
 *   cat /tmp/og-consistency.md
 *
 * Env overrides:
 *   DOMAINS=breezysocial.com,sleepox.com   (default — must match SHORT_DOMAINS)
 *   LIMIT=200
 *   CONCURRENCY=8
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (required)
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const DOMAINS = (process.env.DOMAINS || "breezysocial.com,sleepox.com")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);
const LIMIT = Number(process.env.LIMIT || 200);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.sleepox.com";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var.");
  process.exit(2);
}
const s = createClient(SUPABASE_URL, KEY);

type Row = { id: string; short_code: string };

const { data: links, error } = await s
  .from("links")
  .select("id, short_code")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(LIMIT);

if (error) {
  console.error("links query failed:", error.message);
  process.exit(2);
}

console.log(
  `Auditing ${links?.length ?? 0} links across ${DOMAINS.length} domains: ${DOMAINS.join(", ")}`,
);

function metaContent(html: string, attr: "property" | "name", key: string): string {
  const re = new RegExp(
    `<meta[^>]+${attr}\\s*=\\s*["']${key}["'][^>]+content\\s*=\\s*["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  if (m) return m[1].trim();
  // Try reverse order: content first, then attr
  const re2 = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+${attr}\\s*=\\s*["']${key}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2 ? m2[1].trim() : "";
}
function canonicalHref(html: string): string {
  const m = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
  return m ? m[1].trim() : "";
}

type Issue = {
  domain: string;
  code: string;
  expectedUrl: string;
  status: number;
  ogUrl: string;
  canonical: string;
  twitterUrl: string;
  ogImage: string;
  problems: string[];
};

async function check(domain: string, code: string): Promise<Issue> {
  const expectedUrl = `https://${domain}/${code}`;
  const fetchUrl = `https://${domain}/r/${code}`;
  const problems: string[] = [];
  let status = 0;
  let ogUrl = "", canonical = "", twitterUrl = "", ogImage = "";
  try {
    const res = await fetch(fetchUrl, {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "manual",
    });
    status = res.status;
    if (status !== 200) {
      problems.push(`HTTP ${status} (expected 200)`);
      return { domain, code, expectedUrl, status, ogUrl, canonical, twitterUrl, ogImage, problems };
    }
    const html = await res.text();
    ogUrl = metaContent(html, "property", "og:url");
    canonical = canonicalHref(html);
    twitterUrl = metaContent(html, "name", "twitter:url");
    ogImage = metaContent(html, "property", "og:image");

    if (ogUrl !== expectedUrl) problems.push(`og:url=${ogUrl || "(missing)"} ≠ ${expectedUrl}`);
    if (canonical !== expectedUrl) problems.push(`canonical=${canonical || "(missing)"} ≠ ${expectedUrl}`);
    if (twitterUrl !== expectedUrl) problems.push(`twitter:url=${twitterUrl || "(missing)"} ≠ ${expectedUrl}`);
    if (!ogImage) problems.push("og:image missing");
    else if (!/^https:\/\//i.test(ogImage)) problems.push(`og:image not absolute https: ${ogImage}`);
  } catch (e) {
    problems.push("FETCH_FAILED: " + (e as Error).message);
  }
  return { domain, code, expectedUrl, status, ogUrl, canonical, twitterUrl, ogImage, problems };
}

const tasks: Array<{ domain: string; code: string }> = [];
for (const row of links as Row[]) {
  for (const domain of DOMAINS) tasks.push({ domain, code: row.short_code });
}

const results: Issue[] = [];
const queue = [...tasks];
async function worker() {
  while (queue.length) {
    const t = queue.shift();
    if (!t) break;
    const r = await check(t.domain, t.code);
    results.push(r);
    const tag = r.problems.length ? `❌` : `✅`;
    console.log(`${tag} ${t.domain} /r/${t.code}${r.problems.length ? "  → " + r.problems.join("; ") : ""}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const broken = results.filter((r) => r.problems.length);
const ok = results.length - broken.length;

const lines: string[] = [];
lines.push(`# OG Consistency Audit`);
lines.push(``);
lines.push(`- Domains: ${DOMAINS.join(", ")}`);
lines.push(`- Links checked: ${links?.length ?? 0}`);
lines.push(`- Total checks: ${results.length}`);
lines.push(`- ✅ OK: ${ok}`);
lines.push(`- ❌ Broken: ${broken.length}`);
lines.push(`- Generated: ${new Date().toISOString()}`);
lines.push(``);

if (broken.length) {
  lines.push(`## Inconsistencies`);
  lines.push(``);
  lines.push(`| Domain | Code | Expected | Problems |`);
  lines.push(`|--------|------|----------|----------|`);
  for (const r of broken) {
    lines.push(`| ${r.domain} | ${r.code} | ${r.expectedUrl} | ${r.problems.join("<br>")} |`);
  }
  lines.push(``);
}

const out = "/tmp/og-consistency.md";
writeFileSync(out, lines.join("\n"));
console.log(`\n=== Summary ===`);
console.log(`OK: ${ok} / ${results.length}  |  Broken: ${broken.length}`);
console.log(`Report: ${out}`);

if (broken.length > 0) {
  try {
    await s.from("error_logs").insert({
      source: "og-consistency-audit",
      message: `OG consistency audit found ${broken.length}/${results.length} broken checks`,
      context: { sample: broken.slice(0, 10), total: broken.length, domains: DOMAINS },
    } as any);
  } catch {}
  process.exit(1);
}
process.exit(0);
