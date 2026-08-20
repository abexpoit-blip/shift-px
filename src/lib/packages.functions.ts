import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Package upgrade & Plisio payment integration.
 * Admin sets Plisio API key in Control Panel → Settings.
 * We generate a self-hosted invoice (no redirect to Plisio page).
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
  if (!data) throw new Error("Forbidden");
}

// ─── Public: list available packages ────────────────────────────────────────
export const listPackages = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getAdmin();
  const { data } = await db
    .from("packages")
    .select("id, slug, name, price_monthly, price_usd, duration_months, link_limit, click_quota, is_premium, can_withdraw, features, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Package[];
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

// ─── User: Create an upgrade request (generate self-hosted invoice) ──────────
export const createUpgradeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        package_slug: z.enum(["premium_6m", "premium_12m"]),
        crypto_currency: z.string().default("USDT_TRC20"),
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

    if (!pkg) throw new Error("Package not found");

    // Check Plisio settings
    const { data: settings } = await db
      .from("app_settings")
      .select("plisio_api_key, plisio_enabled")
      .limit(1)
      .maybeSingle();

    // Expire any pending requests for this user
    await db
      .from("upgrade_requests")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");

    let invoiceUrl: string | null = null;
    let cryptoCurrency: string | null = null;
    let cryptoAmount: string | null = null;
    let cryptoAddress: string | null = null;
    let plisioInvoiceId: string | null = null;

    // If Plisio is enabled, call Plisio API to get crypto amount & address
    if ((settings as any)?.plisio_enabled && (settings as any)?.plisio_api_key) {
      try {
        const apiKey = (settings as any).plisio_api_key;
        const currency = data.crypto_currency === "USDT_TRC20" ? "USDT" : "USDT";
        const network = data.crypto_currency === "USDT_TRC20" ? "TRX" : data.crypto_currency === "USDT_BEP20" ? "BSC" : "ETH";

        const params = new URLSearchParams({
          api_key: apiKey,
          currency: "USD",
          amount: String((pkg as any).price_usd),
          source_currency: currency,
          order_name: `AdsPx ${(pkg as any).name}`,
          order_number: `adspx-${userId.slice(0, 8)}-${Date.now()}`,
          callback_url: `https://adspx.com/api/plisio-webhook`,
          success_url: `https://adspx.com/upgrade?status=success`,
          fail_url: `https://adspx.com/upgrade?status=failed`,
          language: "en_US",
        });

        const res = await fetch(`https://plisio.net/api/v1/invoices/new?${params.toString()}`, {
          signal: AbortSignal.timeout(8000),
        });
        const json = await res.json() as any;

        if (json.status === "success" && json.data) {
          plisioInvoiceId = json.data.txn_id ?? null;
          invoiceUrl = json.data.invoice_url ?? null;
          cryptoCurrency = json.data.source_currency ?? currency;
          cryptoAmount = json.data.source_amount ?? null;
          cryptoAddress = json.data.invoice_total_sum ?? null; // Plisio address
        }
      } catch (e) {
        // Plisio unavailable — fall through to manual invoice
        console.error("Plisio API error:", e);
      }
    }

    // Create upgrade request in DB
    const { data: req, error } = await db.from("upgrade_requests").insert({
      user_id: userId,
      package_slug: (pkg as any).slug,
      amount_usd: (pkg as any).price_usd,
      status: "pending",
      plisio_invoice_id: plisioInvoiceId,
      plisio_invoice_url: invoiceUrl,
      crypto_currency: cryptoCurrency,
      crypto_amount: cryptoAmount,
      crypto_address: cryptoAddress,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      requestId: (req as any).id as string,
      packageName: (pkg as any).name as string,
      amountUsd: (pkg as any).price_usd as number,
      cryptoCurrency,
      cryptoAmount,
      cryptoAddress,
      plisioInvoiceUrl: invoiceUrl,
      expiresAt: (req as any).expires_at as string,
      manualMode: !invoiceUrl, // If no Plisio invoice, user pays manually
    };
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

    const { data: res, error } = await db.rpc("activate_premium", {
      _user_id: data.user_id,
      _package_slug: data.package_slug,
      _upgrade_request_id: data.upgrade_request_id ?? null,
    });

    if (error) throw new Error(error.message);
    const out = res as any;
    if (!out?.ok) throw new Error(out?.error ?? "Activation failed");
    return { ok: true as const, premiumUntil: out.premium_until as string };
  });

// ─── Admin: List all upgrade requests ───────────────────────────────────────
export const adminListUpgradeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    const db = await getAdmin();
    const { data } = await db
      .from("upgrade_requests")
      .select(
        "id, user_id, package_slug, amount_usd, status, crypto_currency, crypto_amount, crypto_address, plisio_invoice_url, paid_at, expires_at, admin_note, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as any[];
  });

// ─── Admin: Update Plisio API key in app_settings ───────────────────────────
export const adminSetPlisioKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        plisio_api_key: z.string().trim().min(10).max(200),
        plisio_secret_key: z.string().trim().max(200).optional(),
        plisio_enabled: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const db = await getAdmin();
    const { error } = await db
      .from("app_settings")
      .update({
        plisio_api_key: data.plisio_api_key,
        plisio_secret_key: data.plisio_secret_key ?? null,
        plisio_enabled: data.plisio_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
