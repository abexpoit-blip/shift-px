import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      "Earn $1.00 per 50,000 verified visits",
      "Standard Meta & Facebook bot cloaking",
      "Real-time click & country analytics",
      "No withdrawal (Upgrade to cash out)",
    ],
    sort_order: 0,
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
    can_withdraw: true,
    features: [
      "Unlimited Short Links creation",
      "Unlimited traffic & Tier-1 fast routing",
      "Instant Cashouts Enabled (Min $5 USD)",
      "Advanced Facebook Ad Review Cloaking",
      "Geo-Targeting & Multi-Offer A/B Rotation",
      "Dynamic SubID & UTM tracking forwarding",
      "Priority VIP Telegram & Discord Support",
    ],
    sort_order: 1,
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
    can_withdraw: true,
    features: [
      "Everything in 6-Month Plan included",
      "Save $20 (2 Months FREE — $120 → $100)",
      "Unlimited Short Links & Max Speed CDNs",
      "Instant Lifetime Withdrawals (Min $5 USD)",
      "Custom Short Domains Connection",
      "Dedicated High-Priority Server Queue",
      "Real-Time Click Logs & Audit Export",
      "24/7 Dedicated VIP Account Manager",
    ],
    sort_order: 2,
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
  const hasPremium = rows.some((p) => p.slug === "premium_6m" || p.slug === "premium_12m");
  if (!hasPremium || rows.length < 3) {
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
        .select("plan_slug, premium_until, link_limit, click_quota, can_withdraw, balance_available")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("upgrade_requests")
        .select("id, package_slug, amount_usd, status, crypto_currency, crypto_amount, crypto_address, plisio_invoice_url, expires_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const profile = profileRes.data ?? {};
    return {
      planSlug: (profile as any).plan_slug ?? "free",
      premiumUntil: (profile as any).premium_until ?? null,
      linkLimit: (profile as any).link_limit ?? 50,
      clickQuota: (profile as any).click_quota ?? null,
      canWithdraw: (profile as any).can_withdraw ?? false,
      balanceAvailable: Number((profile as any).balance_available ?? 0),
      recentUpgrades: (upgradeRes.data ?? []) as UpgradeRequest[],
    };
  });

export type UpgradeRequest = {
  id: string;
  package_slug: string;
  amount_usd: number;
  status: "pending" | "paid" | "failed" | "expired";
  crypto_currency: string | null;
  crypto_amount: string | null;
  crypto_address: string | null;
  plisio_invoice_url: string | null;
  expires_at: string;
  created_at: string;
};

// ─── User: Create an upgrade request (LTC Deposit Invoice) ──────────────────
export const createUpgradeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        package_slug: z.enum(["premium_6m", "premium_12m"]),
        crypto_currency: z.string().default("LTC"),
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

    const priceUsd = Number(pkg?.price_usd ?? (data.package_slug === "premium_12m" ? 100 : 60));
    const packageName = pkg?.name ?? (data.package_slug === "premium_12m" ? "Premium — 12 Months" : "Premium — 6 Months");

    // Fetch settings
    const { data: settings } = await db
      .from("app_settings")
      .select("ltc_deposit_address, plisio_api_key, plisio_enabled")
      .limit(1)
      .maybeSingle();

    // Default Litecoin address or admin configured address
    let ltcAddress = (settings as any)?.ltc_deposit_address || "ltc1qu99r55302t9e295pks5k072049e6x89ycmq8h7";

    // Compute live LTC amount from live market rate
    const ltcPrice = await getLiveLtcPrice();
    let ltcAmount = (priceUsd / ltcPrice).toFixed(5);

    // Expire any pending requests for this user
    await db
      .from("upgrade_requests")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");

    let invoiceUrl: string | null = null;
    let plisioInvoiceId: string | null = null;

    // Plisio integration if enabled
    if ((settings as any)?.plisio_enabled && (settings as any)?.plisio_api_key) {
      try {
        const apiKey = (settings as any).plisio_api_key || "mNftu0lvWb5iTX6AVsiUhZINdfZkWVFRNJke3sUwKXyrxFVo0cHUS0A3yOf065Dq";
        const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        const params = new URLSearchParams({
          api_key: apiKey,
          currency: "LTC",
          source_currency: "USD",
          source_amount: String(priceUsd),
          order_name: `AdsPx ${packageName}`,
          order_number: reqId,
          callback_url: "https://adspx.com/api/public/plisio-webhook",
          success_url: "https://adspx.com/upgrade?status=success",
          cancel_url: "https://adspx.com/upgrade?status=failed",
          language: "en_US",
        });

        const res = await fetch(`https://plisio.net/api/v1/invoices/new?${params.toString()}`, {
          signal: AbortSignal.timeout(10000),
        });
        const json = await res.json() as any;

        if (json.status === "success" && json.data) {
          plisioInvoiceId = json.data.txn_id ?? null;
          invoiceUrl = json.data.invoice_url ?? null;
          if (json.data.wallet_hash) {
            ltcAddress = json.data.wallet_hash;
          }
          if (json.data.amount) {
            ltcAmount = String(json.data.amount);
          }
        }
      } catch (e) {
        console.error("Plisio API error:", e);
      }
    }

    // Create upgrade request in DB
    const { data: req, error } = await db.from("upgrade_requests").insert({
      user_id: userId,
      package_slug: data.package_slug,
      amount_usd: priceUsd,
      status: "pending",
      plisio_invoice_id: plisioInvoiceId,
      plisio_invoice_url: invoiceUrl,
      crypto_currency: "LTC",
      crypto_amount: ltcAmount,
      crypto_address: ltcAddress,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      requestId: (req as any).id as string,
      packageName,
      amountUsd: priceUsd,
      cryptoCurrency: "LTC",
      cryptoAmount: ltcAmount,
      cryptoAddress: ltcAddress,
      ltcPriceUsd: ltcPrice,
      plisioInvoiceUrl: invoiceUrl,
      expiresAt: (req as any).expires_at as string,
      manualMode: !invoiceUrl,
    };
  });

// ─── User: Submit Transaction Hash / TXID for verification ─────────────────
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
      .select("id, status, package_slug")
      .eq("id", data.request_id)
      .eq("user_id", userId)
      .maybeSingle();

    return {
      status: (req as any)?.status ?? "pending",
      isPaid: (req as any)?.status === "paid" || (req as any)?.status === "completed",
    };
  });

export const submitUpgradeTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        tx_hash: z.string().min(8, "Please enter a valid transaction hash / TXID"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;

    const { error } = await db
      .from("upgrade_requests")
      .update({
        admin_note: `TXID: ${data.tx_hash.trim()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.request_id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    return { ok: true, message: "Transaction submitted for verification! Your plan will activate shortly." };
  });

// ─── Admin: Manually activate premium for a user ────────────────────────────
export const adminActivatePremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        package_slug: z.enum(["premium_6m", "premium_12m"]),
        upgrade_request_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const db = await getAdmin();

    const months = data.package_slug === "premium_12m" ? 12 : 6;
    const { data: currentProfile } = await db
      .from("profiles")
      .select("premium_until")
      .eq("id", data.user_id)
      .maybeSingle();

    const currentExpiry = currentProfile?.premium_until ? new Date(currentProfile.premium_until) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate.setMonth(baseDate.getMonth() + months)).toISOString();

    const { error } = await db
      .from("profiles")
      .update({
        plan_slug: data.package_slug,
        premium_until: newExpiry,
        can_withdraw: true,
        link_limit: 1000000,
        click_quota: null,
      })
      .eq("id", data.user_id);

    if (error) throw new Error(error.message);

    if (data.upgrade_request_id) {
      await db
        .from("upgrade_requests")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", data.upgrade_request_id);
    }

    return { ok: true, premiumUntil: newExpiry };
  });
