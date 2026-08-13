import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normDomain(input: string): string {
  let d = (input || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").split("/")[0].split("?")[0].split("#")[0].split(":")[0];
  return d;
}

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const listMonitoredDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("monitored_domains")
      .select("*")
      .order("status", { ascending: true, nullsFirst: false })
      .order("domain", { ascending: true });
    if (error) throw new Error(error.message);
    return { domains: data || [] };
  });

export const addMonitoredDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domain: string; notes?: string }) =>
    z.object({ domain: z.string().min(3), notes: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const domain = normDomain(data.domain);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error("Invalid domain");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("monitored_domains")
      .upsert({ domain, source: "manual", notes: data.notes || null, is_active: true } as any, {
        onConflict: "domain",
      });
    if (error) throw new Error(error.message);
    return { ok: true, domain };
  });

export const toggleMonitoredDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; is_active: boolean }) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("monitored_domains")
      .update({ is_active: data.is_active } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMonitoredDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("monitored_domains").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncOfferDomainsFromLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links, error } = await supabaseAdmin
      .from("links")
      .select("destination_url")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const l of links || []) {
      const d = domainFromUrl((l as any).destination_url);
      if (d) set.add(d);
    }
    const rows = [...set].map((domain) => ({ domain, source: "auto", is_active: true }));
    if (rows.length === 0) return { ok: true, added: 0, total: 0 };
    const { error: upErr } = await supabaseAdmin
      .from("monitored_domains")
      .upsert(rows as any, { onConflict: "domain", ignoreDuplicates: true });
    if (upErr) throw new Error(upErr.message);
    return { ok: true, total: rows.length };
  });

export const scanMonitoredDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, saveCheckResult } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("monitored_domains")
      .select("id, domain")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error(error?.message || "Not found");
    const { runDomainHealthCheck } = await import("./domain-health.server");
    const r = await runDomainHealthCheck((row as any).domain);
    await saveCheckResult((row as any).id, (row as any).domain, r);
    const { raw: _raw, ...safe } = r;
    return { ok: true, result: safe };
  });

export const scanAllMonitoredDomains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, scanAllInternal } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    return await scanAllInternal();
  });

export const getDomainHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("domain_health_checks")
      .select("*")
      .eq("domain_id", data.id)
      .order("checked_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { history: rows || [] };
  });