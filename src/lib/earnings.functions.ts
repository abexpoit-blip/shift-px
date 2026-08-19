import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Earnings + withdrawal system (free-for-all model).
 * Source of truth for earnings is `earnings_ledger`, refreshed by the
 * `recompute_earnings()` SQL function from verified human clicks.
 */

export const DEFAULT_RATE_PER_1K = 0.01; // $1.00 per 100,000 (1 lakh) verified human visits
export const DEFAULT_MIN_WITHDRAWAL = 10; // Minimum $10 withdrawal threshold
export const PAYOUT_NETWORKS = ["USDT_TRC20", "USDT_BEP20", "USDT_ERC20"] as const;

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

    return {
      balanceAvailable: num(profileRes.data?.balance_available),
      balancePending: num(profileRes.data?.balance_pending),
      balanceWithdrawn: num(profileRes.data?.balance_withdrawn),
      lifetimeEarned: all.reduce((s, r) => s + num(r.earnings_usd), 0),
      todayEarned: rows.filter((r) => r.day === today).reduce((s, r) => s + num(r.earnings_usd), 0),
      humanClicks: all.reduce((s, r) => s + num(r.human_clicks), 0),
      botClicks: all.reduce((s, r) => s + num(r.bot_clicks), 0),
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
        "id, amount_usd, network, wallet_address, status, tx_hash, admin_note, created_at, processed_at",
      )
      .eq("user_id", (context as any).userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data ?? []) as WithdrawalRow[];
  });

const ERRORS: Record<string, string> = {
  below_minimum: "Amount is below the minimum withdrawal",
  invalid_address: "That wallet address doesn't look valid",
  insufficient_balance: "Not enough available balance",
  pending_request_exists: "You already have a pending withdrawal",
  account_suspended: "Your account is suspended",
  unauthorized: "Please sign in again",
};

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        amount: z.number().positive().max(100000),
        network: z.enum(PAYOUT_NETWORKS),
        address: z.string().trim().min(20).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // RPC runs as the caller so auth.uid() + row locking stay correct.
    const supabase = (context as any).supabase;
    const { data: res, error } = await supabase.rpc(
      "request_withdrawal" as never,
      {
        _amount: data.amount,
        _network: data.network,
        _address: data.address,
      } as never,
    );
    if (error) throw new Error(error.message);
    const out = res as any;
    if (!out?.ok) throw new Error(ERRORS[out?.error] ?? "Withdrawal request failed");
    return { ok: true as const, id: out.id as string };
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
    async ({ context }): Promise<{ entries: LeaderboardEntry[]; yourRank: number | null }> => {
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

      return {
        entries: top.map(([id, t], i) => ({
          rank: i + 1,
          name: id === userId ? "You" : mask(id, names.get(id) ?? ""),
          humanClicks: t.humans,
          earnings: t.earnings,
          isYou: id === userId,
        })),
        yourRank: yourIndex >= 0 ? yourIndex + 1 : null,
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
      .select("*, profiles:user_id(id, email, full_name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return (withdrawals ?? []).map((w: any) => ({
      id: w.id,
      amount_usd: num(w.amount_usd ?? w.amount),
      network: w.network ?? "USDT_TRC20",
      wallet_address: w.wallet_address ?? w.address ?? "",
      status: w.status ?? "pending",
      tx_hash: w.tx_hash ?? null,
      admin_note: w.admin_note ?? null,
      created_at: w.created_at,
      processed_at: w.processed_at ?? null,
      user_id: w.user_id,
      profiles: w.profiles ?? null,
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
