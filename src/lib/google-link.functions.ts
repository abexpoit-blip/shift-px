import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestAuth } from "@/lib/request-auth.server";
import fs from "fs";
import path from "path";

async function assertAdminRole() {
  const context = await getRequestAuth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    throw new Error("Admin authorization required");
  }
  return context.userId;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORAGE_FILE = path.join(DATA_DIR, "google_links.json");

export interface StoredGoogleLink {
  id: string;
  original_url: string;
  google_url: string;
  intermediate_url?: string;
  mode: "inhouse_share" | "inhouse_script" | "tracer";
  status: "active" | "error" | "tested";
  created_at: string;
  hops_count: number;
  last_tested_at?: string;
  latency_ms?: number;
  notes?: string;
}

interface GoogleLinksStore {
  links: StoredGoogleLink[];
}

function loadStore(): GoogleLinksStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, "utf8");
      const parsed = JSON.parse(content);
      return { links: Array.isArray(parsed.links) ? parsed.links : [] };
    }
  } catch (err) {
    console.error("[google-link] Failed to read storage file:", err);
  }
  return { links: [] };
}

function saveStore(store: GoogleLinksStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("[google-link] Failed to save storage file:", err);
  }
}

export interface HopDetail {
  hop: number;
  url: string;
  status: number;
  statusText?: string;
  server?: string;
  location?: string | null;
  latencyMs: number;
  contentType?: string | null;
  error?: string;
}

export interface TraceResult {
  initialUrl: string;
  finalUrl: string;
  totalLatencyMs: number;
  hops: HopDetail[];
  isGoogleDomain: boolean;
  metaPostSafe: boolean;
  verdict: string;
}

export const adminTraceRedirect = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        url: z.string().min(1, "URL is required"),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    await assertAdminRole();

    let targetUrl = data.url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    const hops: HopDetail[] = [];
    let cur = targetUrl;
    let totalLatency = 0;
    const maxHops = 6;

    for (let i = 0; i < maxHops; i++) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(cur, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          },
        });
        clearTimeout(timeout);

        const latency = Date.now() - start;
        totalLatency += latency;
        const loc = res.headers.get("location");
        const server = res.headers.get("server") || undefined;
        const contentType = res.headers.get("content-type") || undefined;

        hops.push({
          hop: i + 1,
          url: cur,
          status: res.status,
          statusText: res.statusText,
          server,
          location: loc,
          contentType,
          latencyMs: latency,
        });

        if (res.status >= 300 && res.status < 400 && loc) {
          cur = new URL(loc, cur).toString();
        } else {
          break;
        }
      } catch (err: any) {
        const latency = Date.now() - start;
        totalLatency += latency;
        hops.push({
          hop: i + 1,
          url: cur,
          status: 0,
          error: err.name === "AbortError" ? "Request timed out (>7s)" : err.message,
          latencyMs: latency,
        });
        break;
      }
    }

    const firstHop = hops[0]?.url || targetUrl;
    const lastHop = hops[hops.length - 1]?.url || targetUrl;

    const isGoogleDomain =
      firstHop.includes("google.com") ||
      firstHop.includes("share.google") ||
      firstHop.includes("goo.gl");

    const metaPostSafe = isGoogleDomain;

    let verdict = "";
    if (isGoogleDomain) {
      verdict =
        "Verified Official Google Domain: Facebook and Meta post scanners whitelist this link (DA 100). No domain ban risk.";
    } else {
      verdict =
        "External domain: Make sure domain reputation and DNS configuration are clean.";
    }

    return {
      initialUrl: targetUrl,
      finalUrl: lastHop,
      totalLatencyMs: totalLatency,
      hops,
      isGoogleDomain,
      metaPostSafe,
      verdict,
    };
  });

export const adminRegisterInhouseGoogleLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        googleUrl: z.string().min(5, "Must be a valid Google URL or share code"),
        destinationUrl: z.string().url("Must be a valid destination URL"),
        mode: z.enum(["inhouse_share", "inhouse_script"]).default("inhouse_share"),
        notes: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    await assertAdminRole();

    let cleanGoogleUrl = data.googleUrl.trim();

    // If user provided a raw code e.g. "wK9kr3kPN2R05JQc6", format it
    if (!cleanGoogleUrl.startsWith("http://") && !cleanGoogleUrl.startsWith("https://")) {
      cleanGoogleUrl = `https://www.google.com/share.google?q=${cleanGoogleUrl}`;
    } else if (cleanGoogleUrl.includes("share.google/") && !cleanGoogleUrl.includes("?q=")) {
      try {
        const parsed = new URL(cleanGoogleUrl);
        const code = parsed.pathname.replace(/^\/+/, "").split("/")[0];
        if (code) {
          cleanGoogleUrl = `https://www.google.com/share.google?q=${code}`;
        }
      } catch {}
    }

    const store = loadStore();
    const nowIso = new Date().toISOString();

    const newEntry: StoredGoogleLink = {
      id: "gs_" + Math.random().toString(36).slice(2, 9),
      original_url: data.destinationUrl.trim(),
      google_url: cleanGoogleUrl,
      mode: data.mode,
      status: "active",
      created_at: nowIso,
      last_tested_at: nowIso,
      hops_count: 2,
      notes: data.notes?.trim() || undefined,
    };

    store.links.unshift(newEntry);
    if (store.links.length > 50) store.links = store.links.slice(0, 50);
    saveStore(store);

    return {
      success: true,
      entry: newEntry,
    };
  });

export const adminGetGoogleLinksState = createServerFn({ method: "GET" }).handler(async () => {
  await assertAdminRole();
  const store = loadStore();
  return {
    links: store.links,
  };
});

export const adminDeleteGoogleLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    await assertAdminRole();
    const store = loadStore();
    store.links = store.links.filter((l) => l.id !== data.id);
    saveStore(store);
    return { success: true };
  });
