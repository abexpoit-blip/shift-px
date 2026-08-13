/**
 * OG audit: fetch every active /r/{code} short link with the Facebook
 * scraper UA and verify og:title, og:description, og:image are all
 * present and non-empty. Writes a markdown report to /tmp/og-audit.md
 * and exits non-zero on any missing field so it can be wired to cron.
 *
 * Usage (on VPS):
 *   cd /opt/sleepox-app-new && bun run scripts/og-audit.ts
 *   cat /tmp/og-audit.md
 *
 * Env overrides:
 *   BASE_URL=https://breezysocial.com   (default)
 *   LIMIT=200                            (max links to check)
 *   CONCURRENCY=8
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const BASE_URL = (process.env.BASE_URL || "https://breezysocial.com").replace(/\/$/, "");
const LIMIT = Number(process.env.LIMIT || 500);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.sleepox.com";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var.");
  process.exit(2);
}
const s = createClient(SUPABASE_URL, KEY);

type Row = { id: string; short_code: string; title: string | null };

const { data: links, error } = await s
  .from("links")
  .select("id, short_code, title")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(LIMIT);

if (error) {
  console.error("links query failed:", error.message);
  process.exit(2);
}

console.log(`Auditing ${links?.length ?? 0} active links against ${BASE_URL}/r/<code> ...`);

type Result = {
  code: string;
  url: string;
  status: number;
  title: string;
  description: string;
  image: string;
  missing: string[];
};

function extract(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

async function check(row: Row): Promise<Result> {
  const url = `${BASE_URL}/r/${row.short_code}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "follow",
    });
    const html = await res.text();
    const title = extract(html, "og:title");
    const description = extract(html, "og:description");
    const image = extract(html, "og:image");
    const missing: string[] = [];
    if (!title) missing.push("og:title");
    if (!description) missing.push("og:description");
    if (!image) missing.push("og:image");
    return { code: row.short_code, url, status: res.status, title, description, image, missing };
  } catch (e) {
    return {
      code: row.short_code,
      url,
      status: 0,
      title: "",
      description: "",
      image: "",
      missing: ["FETCH_FAILED:" + (e as Error).message],
    };
  }
}

// simple concurrency pool
const results: Result[] = [];
const queue = [...(links as Row[])];
async function worker() {
  while (queue.length) {
    const row = queue.shift();
    if (!row) break;
    const r = await check(row);
    results.push(r);
    const tag = r.missing.length ? `❌ ${r.missing.join(",")}` : "✅";
    console.log(`${tag} ${r.code} (${r.status})`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const broken = results.filter((r) => r.missing.length || r.status !== 200);
const ok = results.length - broken.length;

const lines: string[] = [];
lines.push(`# OG Audit Report`);
lines.push(``);
lines.push(`- Base URL: ${BASE_URL}`);
lines.push(`- Checked: ${results.length}`);
lines.push(`- ✅ OK: ${ok}`);
lines.push(`- ❌ Broken: ${broken.length}`);
lines.push(`- Generated: ${new Date().toISOString()}`);
lines.push(``);

if (broken.length) {
  lines.push(`## Broken links`);
  lines.push(``);
  lines.push(`| Code | HTTP | Missing | URL |`);
  lines.push(`|------|------|---------|-----|`);
  for (const r of broken) {
    lines.push(`| ${r.code} | ${r.status} | ${r.missing.join(", ")} | ${r.url} |`);
  }
  lines.push(``);
}

lines.push(`## All results (sample of first 30)`);
lines.push(``);
lines.push(`| Code | Title | Image |`);
lines.push(`|------|-------|-------|`);
for (const r of results.slice(0, 30)) {
  lines.push(`| ${r.code} | ${(r.title || "—").slice(0, 60)} | ${r.image ? "✅" : "❌"} |`);
}

const out = "/tmp/og-audit.md";
writeFileSync(out, lines.join("\n"));
console.log(`\n=== Summary ===`);
console.log(`OK: ${ok} / ${results.length}  |  Broken: ${broken.length}`);
console.log(`Report: ${out}`);

if (broken.length > 0) {
  // Record in error_logs so admin sees it
  try {
    await s.from("error_logs").insert({
      source: "og-audit",
      message: `OG audit found ${broken.length}/${results.length} broken /r/ pages`,
      context: { sample: broken.slice(0, 10), total: broken.length },
    } as any);
  } catch {}
  process.exit(1);
}
process.exit(0);
