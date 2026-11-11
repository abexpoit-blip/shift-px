import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchIpv4 } from "@/lib/fetch-ipv4";

/**
 * Package upgrade & Automated NOWPayments Cryptocurrency Integration.
 * Supports automated live LTC rate conversion, instant blockchain IPN verification,
 * and reliable fallback options.
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
    const json = (await res.json()) as any;
    const price = Number(json?.price);
    if (price > 10 && price < 2000) return price;
  } catch {}

  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd", {
      signal: AbortSignal.timeout(4000),
    });
    const json = (await res.json()) as any;
    const price = Number(json?.litecoin?.usd);
    if (price > 10 && price < 2000) return price;
  } catch {}

  return 90.0;
}

export const CANONICAL_PACKAGES: Package[] = [
  {
    id: "pkg-free",
    slug: "free",
    name: "Free Plan",
    price_monthly: 0,
    price_usd: 0,
    duration_months: 0,
    link_limit: 5,
    click_quota: null,
    is_premium: false,
    can_withdraw: false,
    features: [
      "5 Short Links Total Limit",
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
    link_limit: 10,
    click_quota: null,
    is_premium: true,
    can_withdraw: false,
    features: [
      "10 Short Links / day limit",
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
    link_limit: 50,
    click_quota: null,
    is_premium: true,
    can_withdraw: false,
    features: [
      "Everything in Monthly Plan included",
      "50 Short Links / day limit",
      "6 Months Uninterrupted Access",
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
    link_limit: 100,
    click_quota: null,
    is_premium: true,
    can_withdraw: false,
    features: [
      "Everything in 6-Month Plan included",
      "100 Short Links / day limit",
      "Save $20 (2 Months FREE — $120 → $100)",
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
    .select("id, slug, name, price_monthly, price_usd, duration_months, link_limit, click_quota, is_premium, can_withdraw, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as any[];
  if (!rows || rows.length < 3) {
    return CANONICAL_PACKAGES;
  }

  // Merge canonical features and limits with DB rows
  return CANONICAL_PACKAGES.map((cp) => {
    const dbRow = rows.find((r) => r.slug === cp.slug);
    if (!dbRow) return cp;
    return {
      ...cp,
      id: dbRow.id || cp.id,
      name: dbRow.name || cp.name,
      price_monthly: Number(dbRow.price_monthly ?? cp.price_monthly),
      price_usd: Number(dbRow.price_usd ?? cp.price_usd),
      duration_months: Number(dbRow.duration_months ?? cp.duration_months),
      link_limit: Number(dbRow.link_limit ?? cp.link_limit),
      is_premium: Boolean(dbRow.is_premium ?? cp.is_premium),
      can_withdraw: Boolean(dbRow.can_withdraw ?? cp.can_withdraw),
    };
  });
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

// ─── Order Fulfillment Helper (Idempotent) ──────────────────────────────────
export async function fulfillUpgradeOrder(
  orderIdOrPaymentId: string,
  details?: {
    txHash?: string | null;
    actuallyPaid?: number;
    rawStatus?: string;
    paymentId?: string;
  },
): Promise<{ ok: boolean; message: string; userId?: string; planSlug?: string }> {
  const db = await getAdmin();
  const nowIso = new Date().toISOString();

  let query = db.from("upgrade_requests").select("*");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrPaymentId);
  if (isUuid) {
    query = query.or(`id.eq.${orderIdOrPaymentId},payment_id.eq.${orderIdOrPaymentId}`);
  } else {
    query = query.eq("payment_id", orderIdOrPaymentId);
  }

  const { data: req, error: reqErr } = await query.maybeSingle();
  if (reqErr || !req) {
    return { ok: false, message: `Upgrade request not found: ${orderIdOrPaymentId}` };
  }

  if (req.status === "paid" || req.status === "completed") {
    return { ok: true, message: "Order is already fulfilled", userId: req.user_id, planSlug: req.package_slug };
  }

  // Determine months and link_limit based on plan
  let months = 1;
  let linkLimit = 10;
  if (req.package_slug === "premium_12m") {
    months = 12;
    linkLimit = 100;
  } else if (req.package_slug === "premium_6m") {
    months = 6;
    linkLimit = 50;
  } else if (req.package_slug === "premium_1m") {
    months = 1;
    linkLimit = 10;
  }

  // Update request to paid
  await db
    .from("upgrade_requests")
    .update({
      status: "paid",
      tx_hash: details?.txHash || req.tx_hash || null,
      admin_note: details?.paymentId
        ? `NOWPayments Confirmed (ID: ${details.paymentId}, Status: ${details.rawStatus || "finished"})`
        : req.admin_note,
      updated_at: nowIso,
    })
    .eq("id", req.id);

  // Read current user profile
  const { data: currentProfile } = await db
    .from("profiles")
    .select("premium_until, plan_started_at")
    .eq("id", req.user_id)
    .maybeSingle();

  const currentExpiry = currentProfile?.premium_until ? new Date(currentProfile.premium_until) : new Date();
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
  const newExpiry = new Date(baseDate.setMonth(baseDate.getMonth() + months)).toISOString();

  // Update profile
  await db
    .from("profiles")
    .update({
      plan_slug: req.package_slug,
      plan_started_at: currentProfile?.plan_started_at || nowIso,
      plan_expires_at: newExpiry,
      premium_until: newExpiry,
      can_withdraw: true,
      link_limit: linkLimit,
      click_quota: null,
      updated_at: nowIso,
    })
    .eq("id", req.user_id);

  return {
    ok: true,
    message: `Plan ${req.package_slug} activated successfully!`,
    userId: req.user_id,
    planSlug: req.package_slug,
  };
}

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
        .select("id, package_slug, amount, status, tx_hash, payment_id, crypto_currency, crypto_amount, crypto_address, invoice_url, created_at, updated_at")
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

    // Daily link limit according to user plan: 1m -> 10, 6m -> 50, 12m -> 100
    let linkLimit = 5;
    if (isPremiumActive) {
      if (effectivePlanSlug === "premium_12m") linkLimit = 100;
      else if (effectivePlanSlug === "premium_6m") linkLimit = 50;
      else if (effectivePlanSlug === "premium_1m") linkLimit = 10;
      else linkLimit = Number((profile as any).link_limit) || 10;
    }

    return {
      planSlug: effectivePlanSlug,
      isPremiumActive,
      planStartedAt: planStartedAtStr,
      formattedStartDate,
      premiumUntil: premiumUntilStr ?? null,
      daysRemaining,
      formattedExpiry,
      linkLimit,
      clickQuota: null,
      canWithdraw,
      balanceAvailable: Number((profile as any).balance_available ?? 0),
      recentUpgrades: ((upgradeRes.data ?? []) as any[]).map((r) => ({
        id: r.id,
        package_slug: r.package_slug,
        packageName:
          r.package_slug === "premium_12m"
            ? "Premium — 12 Months"
            : r.package_slug === "premium_6m"
              ? "Premium — 6 Months"
              : r.package_slug === "premium_1m"
                ? "Premium — 1 Month"
                : "Subscription Plan",
        amount_usd: Number(r.amount ?? (r.package_slug === "premium_12m" ? 100 : r.package_slug === "premium_6m" ? 60 : 10)),
        status: r.status,
        tx_hash: r.tx_hash || null,
        crypto_currency: r.crypto_currency || "LTC",
        crypto_amount: r.crypto_amount ? String(r.crypto_amount) : null,
        crypto_address: r.crypto_address || r.payment_id || null,
        invoice_url: r.invoice_url || null,
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
  invoice_url?: string | null;
  expires_at: string;
  created_at: string;
};

// ─── User: Create an upgrade request (NOWPayments Automated Integration) ────
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
    const fallbackName =
      data.package_slug === "premium_12m"
        ? "Premium — 12 Months"
        : data.package_slug === "premium_6m"
          ? "Premium — 6 Months"
          : "Premium — 1 Month";
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
      const linkLimit = data.package_slug === "premium_12m" ? 100 : data.package_slug === "premium_6m" ? 50 : 10;
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
          link_limit: linkLimit,
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
        crypto_currency: "COUPON",
        crypto_amount: 0,
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

    // Expire any older pending requests for this user
    await db
      .from("upgrade_requests")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");

    // Create pending upgrade request in DB
    const { data: req, error: insertErr } = await db
      .from("upgrade_requests" as any)
      .insert({
        user_id: userId,
        package_slug: data.package_slug,
        amount: finalPriceUsd,
        status: "pending",
        admin_note: appliedPromoCode ? `Promo Applied: ${appliedPromoCode} (${discountPercent}% OFF)` : null,
      } as any)
      .select()
      .single();

    if (insertErr || !req) throw new Error(insertErr?.message || "Failed to create order request");

    const requestId = (req as any).id as string;

    // Automated NOWPayments creation
    let npPayment: any = null;
    try {
      const { createNowPayment } = await import("@/lib/nowpayments.server");
      npPayment = await createNowPayment({
        usdAmount: finalPriceUsd,
        orderNumber: requestId,
        payCurrency: "ltc",
        callbackUrl: "https://adspx.com/api/public/nowpayments-callback",
        orderDescription: `AdsPx ${packageName}`,
      });
    } catch (npErr) {
      console.warn("[Upgrade] NOWPayments automated creation error:", npErr);
    }

    if (npPayment && npPayment.payment_id) {
      const payAddress = npPayment.pay_address;
      const payAmount = String(npPayment.pay_amount);
      const invoiceUrl = `https://nowpayments.io/payment/?iid=${npPayment.payment_id}`;

      await db
        .from("upgrade_requests")
        .update({
          payment_id: String(npPayment.payment_id),
          crypto_currency: "LTC",
          crypto_amount: npPayment.pay_amount,
          crypto_address: payAddress,
          invoice_url: invoiceUrl,
          admin_note: `NOWPayments Payment ID: ${npPayment.payment_id}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

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
        cryptoAmount: payAmount,
        cryptoAddress: payAddress,
        invoiceUrl,
        paymentId: String(npPayment.payment_id),
        expiresAt: npPayment.expiration_estimate_date || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        manualMode: false,
      };
    }

    // Fallback: Manual Deposit Mode if NOWPayments is unreachable
    const ltcPrice = await getLiveLtcPrice();
    const ltcAmount = (finalPriceUsd / ltcPrice).toFixed(5);
    const { data: settings } = await db
      .from("app_settings")
      .select("ltc_deposit_address, usdt_deposit_address")
      .limit(1)
      .maybeSingle();

    const ltcAddress = (settings as any)?.ltc_deposit_address || "LWV6HwSiMN8axPAtGrbuTtHAofyBp98Rew";
    const usdtAddress = (settings as any)?.usdt_deposit_address || "";

    await db
      .from("upgrade_requests")
      .update({
        payment_id: ltcAddress,
        crypto_currency: "LTC",
        crypto_amount: Number(ltcAmount),
        crypto_address: ltcAddress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

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
      invoiceUrl: null,
      paymentId: null,
      usdtAddress: usdtAddress || null,
      ltcPriceUsd: ltcPrice,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      manualMode: true,
    };
  });

// ─── User: Check Upgrade Request Status (Active Polling & Verification) ─────
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
      .select("id, status, package_slug, tx_hash, payment_id, created_at")
      .eq("id", data.request_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!req) return { status: "not_found", isPaid: false };

    let status = String((req as any)?.status || "pending").toLowerCase();
    let isPaid = status === "paid" || status === "completed" || status === "success" || status === "finished";

    // If pending and has a NOWPayments payment_id (numeric), check live status
    if (!isPaid && req.payment_id && /^\d+$/.test(req.payment_id)) {
      try {
        const { getNowPaymentStatus, mapNowPaymentStatus } = await import("@/lib/nowpayments.server");
        const npStatus = await getNowPaymentStatus(req.payment_id);
        if (npStatus) {
          const mapped = mapNowPaymentStatus(npStatus.payment_status);
          if (mapped === "paid") {
            await fulfillUpgradeOrder(req.id, {
              txHash: (npStatus as any).payin_hash || (npStatus as any).payout_hash || null,
              actuallyPaid: npStatus.actually_paid || npStatus.pay_amount,
              rawStatus: npStatus.payment_status,
              paymentId: req.payment_id,
            });
            status = "paid";
            isPaid = true;
          } else if (mapped === "failed") {
            await db
              .from("upgrade_requests")
              .update({ status: "failed", updated_at: new Date().toISOString() })
              .eq("id", req.id);
            status = "failed";
          }
        }
      } catch (e) {
        console.warn("[CheckUpgrade] NOWPayments live status check error:", e);
      }
    }

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
    const linkLimit = data.package_slug === "premium_12m" ? 100 : data.package_slug === "premium_6m" ? 50 : 10;

    const { data: currentProfile } = await db
      .from("profiles")
      .select("premium_until, plan_started_at")
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
        plan_started_at: currentProfile?.plan_started_at || nowIso,
        plan_expires_at: newExpiry,
        premium_until: newExpiry,
        can_withdraw: true,
        link_limit: linkLimit,
        click_quota: null,
        updated_at: nowIso,
      } as any)
      .eq("id", data.user_id);

    if (error) throw new Error(error.message);

    if (data.upgrade_request_id) {
      await db
        .from("upgrade_requests")
        .update({ status: "paid", updated_at: nowIso } as any)
        .eq("id", data.upgrade_request_id);
    }

    return { ok: true, premiumUntil: newExpiry, linkLimit };
  });
