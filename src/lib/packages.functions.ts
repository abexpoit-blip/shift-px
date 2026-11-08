import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchIpv4 } from "@/lib/fetch-ipv4";

/**
 * Package upgrade & Litecoin (LTC) payment integration.
 * Supports automated live LTC rate conversion and self-hosted deposit workflow.
 */

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as any;
}

async function assertAdmin(userId: string) {
  const db = await getAdmin();
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: Admin access required");
}

async function getLiveLtcPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=LTCUSDT", {
      signal: AbortSignal.timeout(4000),
    });
    const json = await res.json() as any;
    const price = Number(json?.price);
    if (price > 10 && price < 2000) return price;
  } catch {}

  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd", {
      signal: AbortSignal.timeout(4000),
    });
    const json = await res.json() as any;
    const price = Number(json?.litecoin?.usd);
    if (price > 10 && price < 2000) return price;
  } catch {}

  return 90.00;
}

const CANONICAL_PACKAGES: Package[] = [
  {
    id: "pkg-free",
    slug: "free",
    name: "Free Plan",
    price_monthly: 0,
    price_usd: 0,
    duration_months: 0,
    link_limit: 50,
    click_quota: null,
    is_premium: false,
    can_withdraw: false,
    features: [
      "50 Short Links limit",
      "Unlimited traffic & visitors",
      "Earning System: Service Off",
      "Standard Meta & Facebook bot cloaking",
      "Real-time click & country analytics",
      "Cashouts: Service Off",
    ],
    sort_order: 0,
  },
  {
    id: "pkg-1m",
    slug: "premium_1m",
    name: "Premium — 1 Month",
    price_monthly: 10,
    price_usd: 10,
    duration_months: 1,
    link_limit: 1000000,
    click_quota: null,
    is_premium: true,
    can_withdraw: false,
    features: [
      "Unlimited Short Links creation",
      "Unlimited traffic & Tier-1 fast routing",
      "Full Facebook & Meta Ad Review Cloaking",
      "Geo-Targeting & Multi-Offer A/B Rotation",
      "Dynamic SubID & UTM tracking forwarding",
      "Earning System: Service Off",
      "Priority VIP Telegram & Discord Support",
    ],
    sort_order: 1,
  },
  {
    id: "pkg-6m",
    slug: "premium_6m",
    name: "Premium — 6 Months",
    price_monthly: 10,
    price_usd: 60,
    duration_months: 6,
    link_limit: 1000000,
    click_quota: null,
    is_premium: true,
    can_withdraw: false,
    features: [
      "Everything in Monthly Plan included",
      "6 Months Uninterrupted Access",
      "Unlimited Short Links creation",
      "Unlimited traffic & Tier-1 fast routing",
      "Advanced Facebook Ad Review Cloaking",
      "Geo-Targeting & Multi-Offer A/B Rotation",
      "Priority VIP Telegram & Discord Support",
    ],
    sort_order: 2,
  },
  {
    id: "pkg-12m",
    slug: "premium_12m",
    name: "Premium — 12 Months",
    price_monthly: 8.33,
    price_usd: 100,
    duration_months: 12,
    link_limit: 1000000,
    click_quota: null,
    is_premium: true,
    can_withdraw: false,
    features: [
      "Everything in 6-Month Plan included",
      "Save $20 (2 Months FREE — $120 → $100)",
      "Unlimited Short Links & Max Speed CDNs",
      "Custom Short Domains Connection",
      "Dedicated High-Priority Server Queue",
      "Real-Time Click Logs & Audit Export",
      "24/7 Dedicated VIP Account Manager",
    ],
    sort_order: 3,
  },
];

// ─── Public: list available packages ────────────────────────────────────────
export const listPackages = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getAdmin();
  const { data } = await db
    .from("packages")
    .select("id, slug, name, price_monthly, price_usd, duration_months, link_limit, click_quota, is_premium, can_withdraw, features, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as Package[];
  const hasMonthly = rows.some((p) => p.slug === "premium_1m");
  if (!hasMonthly || rows.length < 3) {
    return CANONICAL_PACKAGES;
  }
  return rows;
});

export type Package = {
  id: string;
  slug: string;
  name: string;
  price_monthly: number;
  price_usd: number;
  duration_months: number;
  link_limit: number;
  click_quota: number | null;
  is_premium: boolean;
  can_withdraw: boolean;
  features: string[];
  sort_order: number;
};

// ─── User: Get own upgrade requests / current plan status ───────────────────
export const getMyPlanStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;

    const [profileRes, upgradeRes] = await Promise.all([
      db
        .from("profiles")
        .select("plan_slug, plan_started_at, plan_expires_at, premium_until, link_limit, click_quota, can_withdraw, balance_available, created_at")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("upgrade_requests")
        .select("id, package_slug, amount, status, tx_hash, payment_id, created_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const profile = profileRes.data ?? {};
    const premiumUntilStr = (profile as any).premium_until || (profile as any).plan_expires_at;
    const planStartedAtStr = (profile as any).plan_started_at || (profile as any).created_at;
    let isPremiumActive = false;
    let daysRemaining = 0;
    let formattedExpiry = "Lifetime / Active";
    let formattedStartDate = planStartedAtStr ? new Date(planStartedAtStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Active";

    if (premiumUntilStr) {
      const expiryDate = new Date(premiumUntilStr);
      if (expiryDate > new Date()) {
        isPremiumActive = true;
        daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        formattedExpiry = expiryDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }

    const rawSlug = (profile as any).plan_slug ?? "free";
    const isLifetime = rawSlug === "lifetime" || rawSlug === "unlimited";
    if (isLifetime) {
      isPremiumActive = true;
      daysRemaining = 9999;
      formattedExpiry = "Lifetime (Never Expires)";
    }
    const effectivePlanSlug = isPremiumActive ? rawSlug : "free";
    const canWithdraw = isPremiumActive ? ((profile as any).can_withdraw ?? true) : false;
    const linkLimit = isPremiumActive ? 1000000 : 50;

    return {
      planSlug: effectivePlanSlug,
      isPremiumActive,
      planStartedAt: planStartedAtStr,
      formattedStartDate,
      premiumUntil: premiumUntilStr ?? null,
      daysRemaining,
      formattedExpiry,
      linkLimit,
      clickQuota: null, // Unlimited clicks across all active plans
      canWithdraw,
      balanceAvailable: Number((profile as any).balance_available ?? 0),
      recentUpgrades: ((upgradeRes.data ?? []) as any[]).map((r) => ({
        id: r.id,
        package_slug: r.package_slug,
        packageName: r.package_slug === "premium_12m" ? "Premium — 12 Months" : r.package_slug === "premium_6m" ? "Premium — 6 Months" : r.package_slug === "premium_1m" ? "Premium — 1 Month" : "Subscription Plan",
        amount_usd: Number(r.amount ?? (r.package_slug === "premium_12m" ? 100 : r.package_slug === "premium_6m" ? 60 : 10)),
        status: r.status,
        tx_hash: r.tx_hash || null,
        crypto_currency: "LTC",
        crypto_amount: null,
        crypto_address: r.payment_id || null,
        formattedDate: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Recent",
        expires_at: r.updated_at || r.created_at,
        created_at: r.created_at,
      })) as Array<UpgradeRequest & { packageName?: string; formattedDate?: string }>,
    };
  });

export type UpgradeRequest = {
  id: string;
  package_slug: string;
  amount_usd: number;
  status: "pending" | "paid" | "completed" | "failed" | "rejected" | "expired";
  tx_hash?: string | null;
  crypto_currency: string | null;
  crypto_amount: string | null;
  crypto_address: string | null;
  expires_at: string;
  created_at: string;
};

// ─── User: Create an upgrade request (LTC Deposit Invoice) ──────────────────
export const createUpgradeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        package_slug: z.enum(["premium_1m", "premium_6m", "premium_12m"]),
        crypto_currency: z.string().default("LTC"),
        promo_code: z.string().trim().max(50).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;

    // Get package details
    const { data: pkg } = await db
      .from("packages")
      .select("slug, name, price_usd")
      .eq("slug", data.package_slug)
      .eq("is_active", true)
      .maybeSingle();

    const fallbackPrice = data.package_slug === "premium_12m" ? 100 : data.package_slug === "premium_6m" ? 60 : 10;
    const fallbackName = data.package_slug === "premium_12m" ? "Premium — 12 Months" : data.package_slug === "premium_6m" ? "Premium — 6 Months" : "Premium — 1 Month";
    const priceUsd = Number(pkg?.price_usd ?? fallbackPrice);
    const packageName = pkg?.name ?? fallbackName;

    // Validate promo code if provided
    let discountPercent = 0;
    let discountAmountUsd = 0;
    let appliedPromoCode: string | null = null;

    if (data.promo_code && data.promo_code.trim()) {
      const codeUpper = data.promo_code.trim().toUpperCase();
      const { data: promoRows } = await db
        .from("broadcasts")
        .select("*")
        .eq("title", `PROMO:${codeUpper}`)
        .limit(1);

      let promoPayload: any = null;
      let promoRow = promoRows?.[0];

      if (promoRow) {
        try {
          promoPayload = typeof promoRow.body === "string" ? JSON.parse(promoRow.body) : promoRow.body;
        } catch {}
      } else if (codeUpper === "BASIC50") {
        promoPayload = { discount_percent: 50, is_active: true };
      }

      if (promoPayload && (promoRow ? promoRow.is_active : true)) {
        const validUntil = promoPayload.valid_until || promoRow?.expires_at;
        const notExpired = !validUntil || new Date(validUntil).getTime() > Date.now();
        const underLimit = promoPayload.max_uses == null || (promoPayload.times_used || 0) < promoPayload.max_uses;

        if (notExpired && underLimit) {
          discountPercent = Math.min(100, Math.max(1, Number(promoPayload.discount_percent || 50)));
          discountAmountUsd = Number(((priceUsd * discountPercent) / 100).toFixed(2));
          appliedPromoCode = codeUpper;

          if (promoRow) {
            promoPayload.times_used = (promoPayload.times_used || 0) + 1;
            const updatePayload: any = {
              body: JSON.stringify(promoPayload),
              updated_at: new Date().toISOString(),
            };
            if (promoPayload.max_uses && promoPayload.times_used >= promoPayload.max_uses) {
              updatePayload.is_active = false;
            }
            await db
              .from("broadcasts")
              .update(updatePayload)
              .eq("id", promoRow.id);
          }
        }
      }
    }

    const rawDiscountedPrice = Number((priceUsd - discountAmountUsd).toFixed(2));

    // Instant Free Activation for 100% Discount Coupons
    if (rawDiscountedPrice <= 0 || discountPercent === 100) {
      const months = data.package_slug === "premium_12m" ? 12 : data.package_slug === "premium_6m" ? 6 : 1;
      const baseDate = new Date();
      const newExpiry = new Date(baseDate.setMonth(baseDate.getMonth() + months)).toISOString();
      const nowIso = new Date().toISOString();

      // Activate user profile immediately
      await db
        .from("profiles")
        .update({
          plan_slug: data.package_slug,
          plan_started_at: nowIso,
          plan_expires_at: newExpiry,
          premium_until: newExpiry,
          can_withdraw: true,
          link_limit: 1000000,
          click_quota: null,
          updated_at: nowIso,
        })
        .eq("id", userId);

      // Record completed upgrade request
      await db.from("upgrade_requests").insert({
        user_id: userId,
        package_slug: data.package_slug,
        amount: 0,
        status: "paid",
        payment_id: `COUPON:${appliedPromoCode || "100_PERCENT"}`,
        created_at: nowIso,
        updated_at: nowIso,
      });

      return {
        free_activated: true,
        package_name: packageName,
        message: `Congratulations! Coupon ${appliedPromoCode} applied successfully. Your ${packageName} plan is now ACTIVE!`,
      };
    }

    const finalPriceUsd = Math.max(1, rawDiscountedPrice);

    // Fetch official deposit address from app settings
    const { data: settings } = await db
      .from("app_settings")
      .select("ltc_deposit_address, usdt_deposit_address")
      .limit(1)
      .maybeSingle();

    // Default Litecoin address or admin configured address
    const ltcAddress = (settings as any)?.ltc_deposit_address || "ltc1qu99r55302t9e295pks5k072049e6x89ycmq8h7";
    const usdtAddress = (settings as any)?.usdt_deposit_address || "";

    // Compute live LTC amount from live market rate using final discounted price
    const ltcPrice = await getLiveLtcPrice();
    const ltcAmount = (finalPriceUsd / ltcPrice).toFixed(5);

    // Expire any older pending requests for this user
    await db
      .from("upgrade_requests")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");

    // Create pending upgrade request in DB
    const { data: req, error: insertErr } = await db.from("upgrade_requests" as any).insert({
      user_id: userId,
      package_slug: data.package_slug,
      amount: finalPriceUsd,
      status: "pending",
      payment_id: ltcAddress,
      admin_note: appliedPromoCode ? `Promo Applied: ${appliedPromoCode} (${discountPercent}% OFF)` : null,
    } as any).select().single();

    if (insertErr || !req) throw new Error(insertErr?.message || "Failed to create order request");

    const requestId = (req as any).id as string;

    return {
      ok: true as const,
      requestId,
      packageName,
      originalPriceUsd: priceUsd,
      discountAmountUsd,
      discountPercent,
      appliedPromoCode,
      amountUsd: finalPriceUsd,
      cryptoCurrency: "LTC",
      cryptoAmount: ltcAmount,
      cryptoAddress: ltcAddress,
      usdtAddress: usdtAddress || null,
      ltcPriceUsd: ltcPrice,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      manualMode: true,
    };
  });

// ─── User: Check Upgrade Request Status ────────────────────────────────────
export const checkUpgradeRequestStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ request_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;
    const { data: req } = await db
      .from("upgrade_requests")
      .select("id, status, package_slug, tx_hash, created_at")
      .eq("id", data.request_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!req) return { status: "not_found", isPaid: false };

    const status = String((req as any)?.status || "pending").toLowerCase();
    const isPaid = status === "paid" || status === "completed" || status === "success" || status === "finished";

    return {
      status,
      isPaid,
      txHash: (req as any)?.tx_hash || null,
    };
  });

// ─── User: Submit Transaction Hash / TXID for Manual Verification ──────────
export const submitUpgradeTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        tx_hash: z.string().trim().min(5, "Please enter a valid Transaction Hash / TXID or payment proof"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;

    const { error } = await db
      .from("upgrade_requests")
      .update({
        tx_hash: data.tx_hash.trim(),
        admin_note: `Manual TXID: ${data.tx_hash.trim()}`,
        status: "pending",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.request_id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    return {
      ok: true,
      message: "Transaction proof submitted successfully! Our administrators will review and activate your plan shortly.",
    };
  });

// ─── Admin: Manually activate premium for a user ────────────────────────────
export const adminActivatePremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        package_slug: z.enum(["premium_1m", "premium_6m", "premium_12m"]),
        upgrade_request_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const db = await getAdmin();

    const months = data.package_slug === "premium_12m" ? 12 : data.package_slug === "premium_6m" ? 6 : 1;
    const { data: currentProfile } = await db
      .from("profiles")
      .select("premium_until")
      .eq("id", data.user_id)
      .maybeSingle();

    const currentExpiry = currentProfile?.premium_until ? new Date(currentProfile.premium_until) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate.setMonth(baseDate.getMonth() + months)).toISOString();
    const nowIso = new Date().toISOString();

    const { error } = await db
      .from("profiles")
      .update({
        plan_slug: data.package_slug,
        plan_started_at: nowIso,
        plan_expires_at: newExpiry,
        premium_until: newExpiry,
        can_withdraw: true,
        link_limit: 1000000,
        click_quota: null,
      } as any)
      .eq("id", data.user_id);

    if (error) throw new Error(error.message);

    if (data.upgrade_request_id) {
      await db
        .from("upgrade_requests")
        .update({ status: "paid", updated_at: nowIso } as any)
        .eq("id", data.upgrade_request_id);
    }

    return { ok: true, premiumUntil: newExpiry };
  });
