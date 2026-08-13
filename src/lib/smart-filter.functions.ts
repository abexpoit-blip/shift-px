import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listCloakingRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("cloaking_rules")
      .select("*")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCloakingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      rule_type: z.enum(["ua", "ip", "asn", "country"]),
      pattern: z.string().min(1).max(200),
      label: z.string().max(100).nullable().optional(),
      action: z.enum(["safe", "block", "offer"]),
      priority: z.number().int().min(0).max(10000).default(100),
      is_active: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("cloaking_rules").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("cloaking_rules").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCloakingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("cloaking_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReferrerRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("referrer_rules").select("*").order("trust_score", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertReferrerRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      pattern: z.string().min(1).max(200),
      label: z.string().max(100).nullable().optional(),
      trust_score: z.number().int().min(0).max(100),
      action: z.enum(["allow", "suspect", "block"]),
      is_active: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("referrer_rules").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("referrer_rules").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteReferrerRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("referrer_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBotFingerprints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("bot_fingerprints")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((f: any) => ({
      ...f,
      hit_count: (Number(f.is_bot_count) || 0) + (Number(f.is_human_count) || 0),
      bot_hits: Number(f.is_bot_count) || 0,
      sample_ip: f.last_ip,
      sample_country: f.last_country,
      last_seen: f.updated_at
    }));
  });

export const toggleFingerprintBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ hash: z.string().min(1), block: z.boolean() }).parse)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("bot_fingerprints")
      .update({ auto_blocked: data.block })
      .eq("fingerprint_hash", data.hash);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCountryTiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("country_tiers").select("*").order("tier").order("country_code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCountryTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      country_code: z.string().min(2).max(3),
      tier: z.number().int().min(1).max(3),
      country_name: z.string().max(100).optional(),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("country_tiers")
      .upsert({ ...data, country_code: data.country_code.toUpperCase() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });