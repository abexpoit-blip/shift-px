import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertLinkOwner(linkId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("links")
    .select("id, user_id")
    .eq("id", linkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Link not found");
  if (data.user_id !== userId) {
    const { data: admin } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!admin) throw new Error("Forbidden");
  }
}

// ============ Geo offers ============
export const listGeoOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ link_id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertLinkOwner(data.link_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("geo_offers").select("*").eq("link_id", data.link_id).order("tier");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertGeoOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      link_id: z.string().uuid(),
      tier: z.number().int().min(1).max(3).nullable().optional(),
      country_codes: z.array(z.string().min(2).max(3)).optional(),
      offer_url: z.string().url().max(2000),
      weight: z.number().int().min(1).max(10000).default(100),
      is_active: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    await assertLinkOwner(data.link_id, context.userId);
    const row = {
      ...data,
      country_codes: data.country_codes?.map((c) => c.toUpperCase()) ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("geo_offers").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("geo_offers").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteGeoOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), link_id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertLinkOwner(data.link_id, context.userId);
    const { error } = await supabaseAdmin.from("geo_offers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ A/B variants ============
export const listAbVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ link_id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertLinkOwner(data.link_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("ab_variants").select("*").eq("link_id", data.link_id).order("variant_label");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAbVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      link_id: z.string().uuid(),
      variant_label: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
      offer_url: z.string().url().max(2000),
      weight_pct: z.number().int().min(1).max(100),
      is_active: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    await assertLinkOwner(data.link_id, context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("ab_variants").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("ab_variants").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteAbVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), link_id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertLinkOwner(data.link_id, context.userId);
    const { error } = await supabaseAdmin.from("ab_variants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ User's links list (compact for selector) ============
export const listMyLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("links")
      .select("id, short_code, title, clicks_count")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
