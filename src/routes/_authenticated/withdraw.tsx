import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Coins,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getEarningsOverview,
  listWithdrawals,
  requestWithdrawal,
  type WithdrawalRow,
} from "@/lib/earnings.functions";

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw Earnings — AdsPx" },
      {
        name: "description",
        content: "Cash out your AdsPx earnings in Litecoin (LTC). Minimum $5 USD payout threshold.",
      },
    ],
  }),
  component: WithdrawPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function StatusBadge({ status }: { status: WithdrawalRow["status"] }) {
  const map = {
    pending: {
      icon: Clock,
      cls: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      label: "Pending",
    },
    approved: {
      icon: Clock,
      cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      label: "Approved",
    },
    paid: {
      icon: CheckCircle2,
      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      label: "Paid",
    },
    rejected: {
      icon: XCircle,
      cls: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      label: "Rejected",
    },
  } as const;
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${cfg.cls}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function WithdrawPage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getEarningsOverview);
  const withdrawalsFn = useServerFn(listWithdrawals);
  const requestFn = useServerFn(requestWithdrawal);

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");

  const { data: overview, isLoading: isOverviewLoading } = useQuery({
    queryKey: ["earnings-overview"],
    queryFn: () => overviewFn(),
    staleTime: 10_000,
  });

  const { data: withdrawals = [], isLoading: isWithdrawalsLoading } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: () => withdrawalsFn(),
    staleTime: 10_000,
  });

    const withdrawMut = useMutation({
    mutationFn: () =>
      requestFn({
        data: {
          amount: Number(amount),
          amount_usd: Number(amount),
          network: "Litecoin (LTC)",
          address: address.trim(),
          wallet_address: address.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Withdrawal request submitted successfully! Pending admin review.");
      setAmount("");
      setAddress("");
      qc.invalidateQueries({ queryKey: ["earnings-overview"] });
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message || "Withdrawal failed"),
  });

  const available = Number(overview?.balanceAvailable ?? 0);
  const minWithdrawal = Number(overview?.minWithdrawal ?? 5);
  const canSubmit = available >= minWithdrawal && Number(amount) >= minWithdrawal && Number(amount) <= available && address.trim().length >= 10;

  return (
    <div className="relative min-h-screen text-foreground pb-16" style={display}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[500px] h-[500px] -top-32 -left-20 opacity-25" />
        <span className="orb orb-purple w-[400px] h-[400px] top-80 -right-20 opacity-20" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Page Header */}
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
            <span className="font-black text-sm">Ł</span> Litecoin (LTC) Payouts
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Withdraw Earnings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Request instant crypto cashouts in Litecoin (LTC). Minimum payout threshold: <strong>${minWithdrawal.toFixed(2)} USD</strong>.
          </p>
        </header>

        {/* Balance Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-card border border-border/80 p-6 space-y-1 shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available Balance</div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
              ${available.toFixed(4)}
            </div>
            <p className="text-[11px] text-muted-foreground">Ready for instant withdrawal</p>
          </div>

          <div className="rounded-3xl bg-card border border-border/80 p-6 space-y-1 shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Payouts</div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
              ${Number(overview?.balancePending ?? 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground">Currently processing</p>
          </div>

          <div className="rounded-3xl bg-card border border-border/80 p-6 space-y-1 shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lifetime Withdrawn</div>
            <div className="text-3xl sm:text-4xl font-black text-foreground font-mono">
              ${Number(overview?.balanceWithdrawn ?? 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground">Total earnings sent</p>
          </div>
        </div>

        {/* Withdrawal Request Form */}
        <div className="rounded-3xl border-2 border-blue-500/30 bg-card p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center font-black text-xl text-blue-400">
                Ł
              </div>
              <div>
                <h3 className="font-black text-lg text-foreground">New Litecoin (LTC) Withdrawal</h3>
                <p className="text-xs text-muted-foreground">Payouts are sent directly to your personal Litecoin address.</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
              Min ${minWithdrawal.toFixed(2)}
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                <span>Amount to Withdraw (USD) *</span>
                <span className="text-emerald-400 font-mono cursor-pointer hover:underline" onClick={() => setAmount(String(available))}>
                  Max: ${available.toFixed(4)}
                </span>
              </label>
              <Input
                type="number"
                step="0.01"
                min={minWithdrawal}
                max={available}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min $${minWithdrawal}.00`}
                className="h-12 text-base font-mono rounded-2xl bg-muted/40 border-border"
              />
              {amount !== "" && Number(amount) < minWithdrawal && (
                <p className="text-xs text-rose-400 font-bold flex items-center gap-1 mt-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Minimum withdrawal amount is ${minWithdrawal.toFixed(2)} USD.
                </p>
              )}
              {amount !== "" && Number(amount) > available && (
                <p className="text-xs text-rose-400 font-bold flex items-center gap-1 mt-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Amount exceeds your available balance (${available.toFixed(2)}).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Litecoin (LTC) Wallet Address *
              </label>
              <Input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. ltc1q... or L..."
                className="h-12 text-sm font-mono rounded-2xl bg-muted/40 border-border"
              />
            </div>

            <div className="rounded-2xl bg-blue-500/5 border border-blue-500/20 p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Litecoin blockchain confirmation is fast (under 2.5 minutes) with near-zero network fees. Please ensure your address is accurate on the native LTC network.
              </p>
            </div>

            <Button
              onClick={() => withdrawMut.mutate()}
              disabled={withdrawMut.isPending || !canSubmit}
              className="w-full h-14 text-base font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-glow hover:opacity-95"
            >
              {withdrawMut.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Submitting Payout Request…
                </>
              ) : (
                <>
                  <Coins className="h-5 w-5 mr-2" /> Request ${amount ? Number(amount).toFixed(2) : "0.00"} LTC Withdrawal
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Withdrawal History Table */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-lg">
          <h3 className="font-extrabold text-xl text-foreground">Withdrawal History</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground font-bold">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Amount (USD)</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Wallet Address</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      No withdrawal history found.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 font-bold font-mono text-foreground">
                        ${Number(w.amount_usd).toFixed(2)}
                      </td>
                      <td className="py-3.5 font-semibold text-blue-400">Litecoin (LTC)</td>
                      <td className="py-3.5 font-mono text-xs text-muted-foreground">
                        {w.wallet_address.slice(0, 8)}...{w.wallet_address.slice(-6)}
                      </td>
                      <td className="py-3.5 text-right">
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
