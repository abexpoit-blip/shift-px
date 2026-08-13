import { supabaseAdmin } from "@/integrations/supabase/client.server";

const loadHealth = (): Promise<typeof import("./domain-health.server")> => {
  const spec = "./domain-health" + ".server";
  return import(/* @vite-ignore */ spec) as any;
};

export async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export async function saveCheckResult(domainId: string, domain: string, r: any) {
  await supabaseAdmin.from("domain_health_checks").insert({
    domain_id: domainId,
    domain,
    status: r.status,
    ssl_valid: r.ssl_valid,
    ssl_expires_at: r.ssl_expires_at,
    ssl_days_remaining: r.ssl_days_remaining,
    ssl_issuer: r.ssl_issuer,
    dns_ok: r.dns_ok,
    http_status: r.http_status,
    http_final_url: r.http_final_url,
    redirect_count: r.redirect_count,
    blacklisted: r.blacklisted,
    blacklist_sources: r.blacklist_sources,
    error_message: r.error_message,
    raw: r.raw,
  } as any);
  await supabaseAdmin
    .from("monitored_domains")
    .update({
      status: r.status,
      ssl_valid: r.ssl_valid,
      ssl_expires_at: r.ssl_expires_at,
      ssl_days_remaining: r.ssl_days_remaining,
      ssl_issuer: r.ssl_issuer,
      dns_ok: r.dns_ok,
      http_status: r.http_status,
      http_final_url: r.http_final_url,
      redirect_count: r.redirect_count,
      blacklisted: r.blacklisted,
      blacklist_sources: r.blacklist_sources,
      last_checked_at: new Date().toISOString(),
      last_error: r.error_message,
    } as any)
    .eq("id", domainId);
}

export async function scanAllInternal() {
  const { data: rows, error } = await supabaseAdmin
    .from("monitored_domains")
    .select("id, domain")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { ok: true, scanned: 0 };
  const { runDomainHealthCheck } = await loadHealth();

  const BATCH = 5;
  let scanned = 0;
  let critical = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      slice.map(async (r: any) => {
        const res = await runDomainHealthCheck(r.domain);
        await saveCheckResult(r.id, r.domain, res);
        return res.status;
      }),
    );
    for (const x of results) {
      if (x.status === "fulfilled") {
        scanned++;
        if (x.value === "critical") critical++;
      }
    }
  }
  return { ok: true, scanned, critical };
}