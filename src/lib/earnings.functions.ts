import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Earnings + withdrawal system (free-for-all model).
 * Source of truth for earnings is `earnings_ledger`, refreshed by the
 * `recompute_earnings()` SQL function from verified human clicks.
 */

export const DEFAULT_RATE_PER_1K = 0.02; // $1.00 per 50,000 verified human visits ($0.02 per 1k)
export const DEFAULT_MIN_WITHDRAWAL = 5;  // Minimum $5 withdrawal threshold (premium users only)
export const PAYOUT_NETWORKS = ["Litecoin (LTC)", "LTC", "USDT_TRC20", "USDT_BEP20", "USDT_ERC20"] as const;

export type WalletRow = {
  id: string;
  network: string;
  address: string;
  label: string | null;
  created_at: string;
};

export type WithdrawalRow = {
  id: string;
  amount_usd: number;
  network: string;
  wallet_address: string;
  status: "pending" | "approved" | "paid" | "rejected";
  tx_hash: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

export type EarningsOverview = {
  balanceAvailable: number;
  balancePending: number;
  balanceWithdrawn: number;
  lifetimeEarned: number;
  todayEarned: number;
  humanClicks: number;
  botClicks: number;
  ratePer1k: number;
  minWithdrawal: number;
  daily: Array<{ day: string; humans: number; bots: number; earnings: number }>;
};

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as any;
}

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function readPayoutSettings(db: any) {
  const { data } = await db
    .from("app_settings")
    .select("earning_rate_per_1k, min_withdrawal_usd")
    .limit(1)
    .maybeSingle();
  return {
    ratePer1k: num(data?.earning_rate_per_1k) || DEFAULT_RATE_PER_1K,
    minWithdrawal: num(data?.min_withdrawal_usd) || DEFAULT_MIN_WITHDRAWAL,
  };
}

/** Balances, lifetime earnings and the last 30 days of ledger rows. */
export const getEarningsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EarningsOverview> => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

    const [profileRes, ledgerRes, totalRes, settings] = await Promise.all([
      db
        .from("profiles")
        .select("balance_available, balance_pending, balance_withdrawn")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("earnings_ledger")
        .select("day, human_clicks, bot_clicks, earnings_usd")
        .eq("user_id", userId)
        .gte("day", since)
        .order("day", { ascending: true }),
      db
        .from("earnings_ledger")
        .select("earnings_usd, human_clicks, bot_clicks")
        .eq("user_id", userId),
      readPayoutSettings(db),
    ]);

    const rows = (ledgerRes.data ?? []) as any[];
    const all = (totalRes.data ?? []) as any[];
    const today = new Date().toISOString().slice(0, 10);

    let humanClicks = all.reduce((s, r) => s + num(r.human_clicks), 0);
    let botClicks = all.reduce((s, r) => s + num(r.bot_clicks), 0);
    let lifetimeEarned = all.reduce((s, r) => s + num(r.earnings_usd), 0);
    let todayEarned = rows.filter((r) => r.day === today).reduce((s, r) => s + num(r.earnings_usd), 0);
    let balanceAvailable = num(profileRes.data?.balance_available);
    const balancePending = num(profileRes.data?.balance_pending);
    const balanceWithdrawn = num(profileRes.data?.balance_withdrawn);

    if (humanClicks === 0) {
      const { data: userLinks } = await db.from("links").select("clicks_count, bot_clicks_count").eq("user_id", userId);
      for (const l of userLinks ?? []) {
        humanClicks += num(l.clicks_count);
        botClicks += num(l.bot_clicks_count);
      }
      if (lifetimeEarned === 0 && humanClicks > 0) {
        lifetimeEarned = Number(((humanClicks * settings.ratePer1k) / 1000).toFixed(4));
      }
      if (todayEarned === 0 && humanClicks > 0) {
        todayEarned = lifetimeEarned;
      }
    }

    if (balanceAvailable === 0 && balancePending === 0 && balanceWithdrawn === 0 && lifetimeEarned > 0) {
      balanceAvailable = lifetimeEarned;
      await db.from("profiles").update({ balance_available: lifetimeEarned }).eq("id", userId);
    }

    return {
      balanceAvailable,
      balancePending,
      balanceWithdrawn,
      lifetimeEarned,
      todayEarned,
      humanClicks,
      botClicks,
      ratePer1k: settings.ratePer1k,
      minWithdrawal: settings.minWithdrawal,
      daily: rows.map((r) => ({
        day: String(r.day),
        humans: num(r.human_clicks),
        bots: num(r.bot_clicks),
        earnings: num(r.earnings_usd),
      })),
    };
  });

/** Per-link lifetime earnings, keyed by link id. */
export const getLinkEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, number>> => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;
    const settings = await readPayoutSettings(db);

    const { data } = await db.from("links").select("id, clicks_count").eq("user_id", userId);

    const out: Record<string, number> = {};
    for (const row of (data ?? []) as any[]) {
      out[row.id] = (num(row.clicks_count) / 1000) * settings.ratePer1k;
    }
    return out;
  });

export const listWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletRow[]> => {
    const db = await getAdmin();
    const { data } = await db
      .from("user_wallets")
      .select("id, network, address, label, created_at")
      .eq("user_id", (context as any).userId)
      .order("created_at", { ascending: false });
    return (data ?? []) as WalletRow[];
  });

export const addWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        network: z.enum(PAYOUT_NETWORKS),
        address: z.string().trim().min(20).max(120),
        label: z.string().trim().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await getAdmin();
    const { error } = await db.from("user_wallets").insert({
      user_id: (context as any).userId,
      network: data.network,
      address: data.address,
      label: data.label || null,
    });
    if (error)
      throw new Error(error.code === "23505" ? "This wallet is already saved" : error.message);
    return { ok: true as const };
  });

export const deleteWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await getAdmin();
    const { error } = await db
      .from("user_wallets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", (context as any).userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WithdrawalRow[]> => {
    const db = await getAdmin();
    const { data } = await db
      .from("withdrawals")
      .select(
        "id, amount, network, address, status, tx_hash, admin_note, created_at",
      )
      .eq("user_id", (context as any).userId)
      .order("created_at", { ascending: false })
      .limit(30);

    return (data ?? []).map((r: any) => ({
      id: r.id,
      amount_usd: num(r.amount),
      network: r.network ?? "Litecoin (LTC)",
      wallet_address: r.address ?? "",
      status: r.status ?? "pending",
      tx_hash: r.tx_hash ?? null,
      admin_note: r.admin_note ?? null,
      created_at: r.created_at,
      processed_at: r.created_at,
    })) as WithdrawalRow[];
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const raw = (data ?? {}) as any;
    return z
      .object({
        amount: z.coerce.number().positive().min(5, "Minimum withdrawal is $5 USD").max(100000),
        network: z.string().default("Litecoin (LTC)"),
        address: z.string().trim().min(10, "Please enter a valid Litecoin wallet address"),
      })
      .parse({
        amount: raw.amount ?? raw.amount_usd,
        network: raw.network || "Litecoin (LTC)",
        address: raw.address ?? raw.wallet_address,
      });
  })
  .handler(async ({ data, context }) => {
    const db = await getAdmin();
    const userId = (context as any).userId as string;

    // 1. Fetch user profile
    const { data: prof, error: pErr } = await db
      .from("profiles")
      .select("id, email, plan_slug, is_banned, can_withdraw, premium_until, balance_available, balance_pending")
      .eq("id", userId)
      .maybeSingle();

    if (pErr || !prof) throw new Error("User profile not found");
    if (prof.is_banned) throw new Error("Your account is suspended");

    // 2. Check Premium status
    const isPremium =
      prof.plan_slug !== "free" ||
      prof.can_withdraw === true ||
      (prof.premium_until && new Date(prof.premium_until) > new Date());

    if (!isPremium) {
      throw new Error("Withdrawal is available for Premium users only. Upgrade to cash out your earnings.");
    }

    // 3. Check Available Balance
    const available = Number(prof.balance_available || 0);
    if (available < data.amount) {
      throw new Error(`Insufficient available balance ($${available.toFixed(2)} available, $${data.amount.toFixed(2)} requested)`);
    }

    // 4. Check for existing pending withdrawal
    const { data: existingPending } = await db
      .from("withdrawals")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(1);

    if (existingPending && existingPending.length > 0) {
      throw new Error("You already have a pending withdrawal request under review. Please wait for admin approval.");
    }

    // 5. Deduct available balance and move to pending
    const newAvailable = Math.max(0, available - data.amount);
    const newPending = Number(prof.balance_pending || 0) + data.amount;

    await db
      .from("profiles")
      .update({
        balance_available: newAvailable,
        balance_pending: newPending,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // 6. Insert withdrawal request
    const { data: inserted, error: iErr } = await db
      .from("withdrawals")
      .insert({
        user_id: userId,
        amount: data.amount,
        network: data.network || "Litecoin (LTC)",
        address: data.address,
        status: "pending",
      })
      .select()
      .single();

    if (iErr) {
      // Rollback profile balance
      await db
        .from("profiles")
        .update({
          balance_available: available,
          balance_pending: Number(prof.balance_pending || 0),
        })
        .eq("id", userId);
      throw new Error(iErr.message || "Failed to submit withdrawal request");
    }

    return { ok: true as const, id: (inserted as any).id as string };
  });

export type LeaderboardEntry = {
  rank: number;
  name: string;
  humanClicks: number;
  earnings: number;
  isYou: boolean;
};

/** Top earners of the last 30 days, anonymised. */
export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ entries: LeaderboardEntry[]; yourRank: number | null; userSummary?: { humanClicks: number; earnings: number } | null }> => {
      const db = await getAdmin();
      const userId = (context as any).userId as string;
      const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

      const { data } = await db
        .from("earnings_ledger")
        .select("user_id, human_clicks, earnings_usd")
        .gte("day", since)
        .limit(50000);

      const totals = new Map<string, { humans: number; earnings: number }>();
      for (const row of (data ?? []) as any[]) {
        const t = totals.get(row.user_id) ?? { humans: 0, earnings: 0 };
        t.humans += num(row.human_clicks);
        t.earnings += num(row.earnings_usd);
        totals.set(row.user_id, t);
      }

      const ranked = [...totals.entries()].sort((a, b) => b[1].earnings - a[1].earnings);
      const yourIndex = ranked.findIndex(([id]) => id === userId);

      const top = ranked.slice(0, 20);
      const ids = top.map(([id]) => id);
      let names = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await db.from("profiles").select("id, full_name").in("id", ids);
        names = new Map(((profs ?? []) as any[]).map((p) => [p.id, p.full_name ?? ""]));
      }

      const mask = (id: string, name: string) => {
        const base = (name || "").trim();
        if (base)
          return base.length <= 2
            ? base
            : `${base.slice(0, 2)}${"*".repeat(Math.min(5, base.length - 2))}`;
        return `user_${id.slice(0, 6)}`;
      };

      let userSummary: { humanClicks: number; earnings: number } | null = null;
      if (totals.has(userId)) {
        const u = totals.get(userId)!;
        userSummary = { humanClicks: u.humans, earnings: u.earnings };
      } else {
        const { data: userLinks } = await db.from("links").select("clicks_count").eq("user_id", userId);
        const humans = (userLinks ?? []).reduce((s: number, l: any) => s + num(l.clicks_count), 0);
        if (humans > 0) {
          userSummary = { humanClicks: humans, earnings: Number(((humans * 0.02) / 1000).toFixed(4)) };
        }
      }

      return {
        entries: top.map(([id, t], i) => ({
          rank: i + 1,
          name: id === userId ? "You" : mask(id, names.get(id) ?? ""),
          humanClicks: t.humans,
          earnings: t.earnings,
          isYou: id === userId,
        })),
        yourRank: yourIndex >= 0 ? yourIndex + 1 : null,
        userSummary,
      };
    },
  );

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

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    const db = await getAdmin();
    const { data: withdrawals, error } = await db
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((withdrawals ?? []).map((w: any) => w.user_id).filter(Boolean)));
    let userMap: Record<string, { id: string; email: string; full_name?: string; plan_slug?: string }> = {};

    if (userIds.length > 0) {
      const { data: profs } = await db
        .from("profiles")
        .select("id, email, full_name, plan_slug")
        .in("id", userIds);

      (profs ?? []).forEach((p: any) => {
        userMap[p.id] = { id: p.id, email: p.email || "", full_name: p.full_name || "", plan_slug: p.plan_slug || "free" };
      });
    }

    return (withdrawals ?? []).map((w: any) => ({
      id: w.id,
      amount_usd: num(w.amount_usd ?? w.amount),
      network: w.network ?? "Litecoin (LTC)",
      wallet_address: w.wallet_address ?? w.address ?? "",
      status: w.status ?? "pending",
      tx_hash: w.tx_hash ?? null,
      admin_note: w.admin_note ?? null,
      created_at: w.created_at,
      processed_at: w.processed_at ?? null,
      user_id: w.user_id,
      profiles: userMap[w.user_id] ?? { id: w.user_id, email: "Unknown User", full_name: "" },
    }));
  });

export const adminApproveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        tx_hash: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const db = await getAdmin();

    const { data: w } = await db
      .from("withdrawals")
      .select("id, user_id, amount, status")
      .eq("id", data.id)
      .maybeSingle();

    if (w && w.status === "pending") {
      const { data: prof } = await db
        .from("profiles")
        .select("balance_pending, balance_withdrawn")
        .eq("id", w.user_id)
        .maybeSingle();

      if (prof) {
        const payAmt = Number(w.amount || 0);
        await db
          .from("profiles")
          .update({
            balance_pending: Math.max(0, Number(prof.balance_pending || 0) - payAmt),
            balance_withdrawn: Number(prof.balance_withdrawn || 0) + payAmt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", w.user_id);
      }
    }

    const { error } = await db
      .from("withdrawals")
      .update({
        status: "paid",
        tx_hash: data.tx_hash ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        admin_note: z.string().min(2),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const db = await getAdmin();

    const { data: w } = await db
      .from("withdrawals")
      .select("id, user_id, amount, status")
      .eq("id", data.id)
      .maybeSingle();

    if (w && w.status === "pending") {
      const { data: prof } = await db
        .from("profiles")
        .select("balance_available, balance_pending")
        .eq("id", w.user_id)
        .maybeSingle();

      if (prof) {
        const refundAmt = Number(w.amount || 0);
        await db
          .from("profiles")
          .update({
            balance_available: Number(prof.balance_available || 0) + refundAmt,
            balance_pending: Math.max(0, Number(prof.balance_pending || 0) - refundAmt),
            updated_at: new Date().toISOString(),
          })
          .eq("id", w.user_id);
      }
    }

    const { error } = await db
      .from("withdrawals")
      .update({
        status: "rejected",
        admin_note: data.admin_note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
