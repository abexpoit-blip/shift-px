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

interface StoredGoogleLink {
  id: string;
  original_url: string;
  google_url: string;
  intermediate_url?: string;
  mode: "gshort_api" | "tracer" | "manual";
  status: "active" | "error" | "tested";
  created_at: string;
  hops_count: number;
  last_tested_at?: string;
  latency_ms?: number;
  notes?: string;
}

interface GoogleLinksStore {
  apiKey?: string;
  links: StoredGoogleLink[];
}

function loadStore(): GoogleLinksStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("[google-link] Failed to read storage file:", err);
  }
  return { apiKey: process.env.GSHORT_API_KEY || "", links: [] };
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
        "Verified Google Official Domain: Facebook/Meta post filters will accept this link without domain reputation penalties (DA 100).";
    } else {
      verdict =
        "Standard custom/third-party domain: Relies on external domain reputation and DNS configuration.";
    }

    // Update or add to stored history
    const store = loadStore();
    const existingIndex = store.links.findIndex((l) => l.google_url === targetUrl);
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      store.links[existingIndex].last_tested_at = nowIso;
      store.links[existingIndex].latency_ms = totalLatency;
      store.links[existingIndex].hops_count = hops.length;
      store.links[existingIndex].status = hops.some((h) => h.error) ? "error" : "active";
    } else {
      store.links.unshift({
        id: "gl_" + Math.random().toString(36).slice(2, 9),
        original_url: lastHop,
        google_url: targetUrl,
        intermediate_url: hops[1]?.url,
        mode: "tracer",
        status: hops.some((h) => h.error) ? "error" : "tested",
        created_at: nowIso,
        last_tested_at: nowIso,
        hops_count: hops.length,
        latency_ms: totalLatency,
      });
      // Keep max 50 in history
      if (store.links.length > 50) store.links = store.links.slice(0, 50);
    }
    saveStore(store);

    const result: TraceResult = {
      initialUrl: targetUrl,
      finalUrl: lastHop,
      totalLatencyMs: totalLatency,
      hops,
      isGoogleDomain,
      metaPostSafe,
      verdict,
    };

    return result;
  });

export const adminGenerateGoogleLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        destinationUrl: z.string().url("Must be a valid destination URL"),
        apiKey: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    await assertAdminRole();

    const store = loadStore();
    const activeApiKey = data.apiKey?.trim() || store.apiKey || process.env.GSHORT_API_KEY || "";

    if (!activeApiKey) {
      throw new Error(
        "Gshort API Key is missing. Please provide an API key or configure it in the Google Link settings."
      );
    }

    // Call Gshort.net API
    try {
      const idempotencyKey = "px-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      const res = await fetch("https://gshort.net/api/v1/links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          destination_url: data.destinationUrl,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          body?.error?.message ||
          body?.message ||
          `Gshort API failed with status ${res.status}: ${res.statusText}`;
        throw new Error(errorMsg);
      }

      // Extract generated google URL or short URL from response
      const googleUrl =
        body?.data?.google_url ||
        body?.google_url ||
        body?.data?.short_url ||
        body?.short_url ||
        body?.data?.url ||
        body?.url;

      if (!googleUrl) {
        throw new Error(
          "Gshort API returned success, but no google_url or short_url was found in the response payload."
        );
      }

      const nowIso = new Date().toISOString();
      const newEntry: StoredGoogleLink = {
        id: "gl_" + Math.random().toString(36).slice(2, 9),
        original_url: data.destinationUrl,
        google_url: googleUrl,
        intermediate_url: body?.data?.short_url || undefined,
        mode: "gshort_api",
        status: "active",
        created_at: nowIso,
        hops_count: 2,
        notes: data.notes,
      };

      store.links.unshift(newEntry);
      if (store.links.length > 50) store.links = store.links.slice(0, 50);
      saveStore(store);

      return {
        success: true,
        googleUrl,
        destinationUrl: data.destinationUrl,
        raw: body,
      };
    } catch (err: any) {
      console.error("[google-link] Generate failed:", err);
      throw new Error(err.message || "Failed to generate Google Link via Gshort API");
    }
  });

export const adminGetGoogleLinksState = createServerFn({ method: "GET" }).handler(async () => {
  await assertAdminRole();
  const store = loadStore();
  return {
    hasApiKey: !!(store.apiKey || process.env.GSHORT_API_KEY),
    maskedApiKey: store.apiKey
      ? store.apiKey.slice(0, 4) + "••••••••" + store.apiKey.slice(-4)
      : process.env.GSHORT_API_KEY
      ? "ENV:••••••••"
      : "",
    links: store.links,
  };
});

export const adminSaveGoogleApiKey = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        apiKey: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    await assertAdminRole();
    const store = loadStore();
    store.apiKey = data.apiKey.trim();
    saveStore(store);
    return { success: true };
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
