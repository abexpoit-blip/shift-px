import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PromoCode = {
  id: string;
  code: string;
  discount_percent: number;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

// Default fallback promo code that is always valid
export const DEFAULT_PROMO_CODE: PromoCode = {
  id: "promo-basic50-default",
  code: "BASIC50",
  discount_percent: 50,
  valid_until: null,
  max_uses: null,
  times_used: 0,
  description: "Special 50% discount on all Premium upgrade packages",
  is_active: true,
  created_at: new Date().toISOString(),
};

async function getSupabaseAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as any;
}

async function assertAdmin(userId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: Admin privileges required");
  return supabaseAdmin;
}

function parsePromoRecord(row: any): PromoCode | null {
  if (!row) return null;
  try {
    let payload: any = {};
    if (typeof row.body === "string" && row.body.startsWith("{")) {
      payload = JSON.parse(row.body);
    }
    const code = (payload.code || row.title.replace(/^PROMO:/i, "")).trim().toUpperCase();
    return {
      id: row.id,
      code,
      discount_percent: Number(payload.discount_percent || 50),
      valid_until: payload.valid_until || row.expires_at || null,
      max_uses: payload.max_uses ? Number(payload.max_uses) : null,
      times_used: Number(payload.times_used || 0),
      description: payload.description || "Promo Coupon",
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
    };
  } catch (err) {
    return null;
  }
}

// ─── Public/User: Validate Promo Code ───────────────────────────────────────
export const validatePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z.string().trim().min(1).max(50),
        package_slug: z.enum(["premium_6m", "premium_12m"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const rawCode = data.code.trim().toUpperCase();
    const supabaseAdmin = await getSupabaseAdmin();

    // Query promo from database
    const { data: rows } = await supabaseAdmin
      .from("broadcasts")
      .select("*")
      .eq("title", `PROMO:${rawCode}`)
      .limit(1);

    let promo: PromoCode | null = null;

    if (rows && rows.length > 0) {
      promo = parsePromoRecord(rows[0]);
    }

    // If not found in DB but matches canonical BASIC50, use default fallback
    if (!promo && rawCode === "BASIC50") {
      promo = DEFAULT_PROMO_CODE;
    }

    if (!promo) {
      throw new Error(`Invalid promo code "${data.code}". Please check and try again.`);
    }

    if (!promo.is_active) {
      throw new Error(`Promo code "${promo.code}" is no longer active.`);
    }

    if (promo.valid_until) {
      const expiry = new Date(promo.valid_until);
      if (expiry.getTime() < Date.now()) {
        throw new Error(`Promo code "${promo.code}" has expired on ${expiry.toLocaleDateString()}.`);
      }
    }

    if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
      throw new Error(`Promo code "${promo.code}" has reached its maximum usage limit.`);
    }

    const originalPriceUsd = data.package_slug === "premium_12m" ? 100 : 60;
    const discountPercent = Math.min(100, Math.max(1, promo.discount_percent));
    const discountAmountUsd = Number(((originalPriceUsd * discountPercent) / 100).toFixed(2));
    const finalPriceUsd = Math.max(0, Number((originalPriceUsd - discountAmountUsd).toFixed(2)));

    return {
      valid: true,
      code: promo.code,
      discount_percent: discountPercent,
      original_price_usd: originalPriceUsd,
      discount_amount_usd: discountAmountUsd,
      final_price_usd: finalPriceUsd,
      description: promo.description,
      message: `Coupon "${promo.code}" applied! ${discountPercent}% discount ($${discountAmountUsd.toFixed(2)} saved).`,
    };
  });

// ─── Admin: List all promo codes ───────────────────────────────────────────
export const adminListPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("broadcasts")
      .select("*")
      .like("title", "PROMO:%")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const list: PromoCode[] = (rows ?? [])
      .map(parsePromoRecord)
      .filter((p: PromoCode | null): p is PromoCode => p !== null);

    // If BASIC50 is not yet in the DB, prepend the default so admin can manage it
    const hasBasic50 = list.some((p: PromoCode) => p.code === "BASIC50");
    if (!hasBasic50) {
      list.unshift(DEFAULT_PROMO_CODE);
    }

    return list;
  });

// ─── Admin: Create or update promo code ────────────────────────────────────
export const adminCreatePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(2)
          .max(30)
          .regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric without spaces"),
        discount_percent: z.number().int().min(1).max(99).default(50),
        valid_until: z.string().nullable().optional(),
        max_uses: z.number().int().min(1).nullable().optional(),
        description: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const upperCode = data.code.trim().toUpperCase();

    const payload = {
      code: upperCode,
      discount_percent: data.discount_percent,
      valid_until: data.valid_until || null,
      max_uses: data.max_uses || null,
      times_used: 0,
      description: data.description || `${data.discount_percent}% Discount Coupon`,
    };

    // Check if code exists
    const { data: existing } = await supabaseAdmin
      .from("broadcasts")
      .select("id")
      .eq("title", `PROMO:${upperCode}`)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from("broadcasts")
        .update({
          body: JSON.stringify(payload),
          is_active: true,
          expires_at: data.valid_until || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateErr) throw new Error(updateErr.message);
      return { ok: true, message: `Coupon "${upperCode}" updated successfully` };
    }

    const { error: insertErr } = await supabaseAdmin.from("broadcasts").insert({
      title: `PROMO:${upperCode}`,
      body: JSON.stringify(payload),
      icon: "sparkles",
      tone: "premium",
      is_active: true,
      expires_at: data.valid_until || null,
      created_by: context.userId,
    });

    if (insertErr) throw new Error(insertErr.message);
    return { ok: true, message: `Coupon "${upperCode}" created with ${data.discount_percent}% discount!` };
  });

// ─── Admin: Delete promo code ──────────────────────────────────────────────
export const adminDeletePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    // If it's the hardcoded placeholder ID, handle gracefully
    if (data.id === "promo-basic50-default") {
      // Create a disabled record in DB to suppress it
      await supabaseAdmin.from("broadcasts").insert({
        title: "PROMO:BASIC50",
        body: JSON.stringify({ ...DEFAULT_PROMO_CODE, is_active: false }),
        icon: "sparkles",
        tone: "premium",
        is_active: false,
        created_by: context.userId,
      });
      return { ok: true };
    }

    const { error } = await supabaseAdmin.from("broadcasts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Admin: Toggle promo code active status ────────────────────────────────
export const adminTogglePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    if (data.id === "promo-basic50-default") {
      await supabaseAdmin.from("broadcasts").insert({
        title: "PROMO:BASIC50",
        body: JSON.stringify({ ...DEFAULT_PROMO_CODE, is_active: data.is_active }),
        icon: "sparkles",
        tone: "premium",
        is_active: data.is_active,
        created_by: context.userId,
      });
      return { ok: true };
    }

    const { error } = await supabaseAdmin
      .from("broadcasts")
      .update({ is_active: data.is_active, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
