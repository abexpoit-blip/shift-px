import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  LayoutDashboard
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getEarningsOverview,
  listWithdrawals,
  type WithdrawalRow,
} from "@/lib/earnings.functions";

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({
    meta: [
      { title: "Payouts Disabled — AdsPx" },
      {
        name: "description",
        content: "Payouts & withdrawals are currently turned off on AdsPx.",
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
  const overviewFn = useServerFn(getEarningsOverview);
  const withdrawalsFn = useServerFn(listWithdrawals);

  const { data: overview } = useQuery({
    queryKey: ["earnings-overview"],
    queryFn: () => overviewFn(),
    staleTime: 30_000,
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: () => withdrawalsFn(),
    staleTime: 30_000,
  });

  return (
    <div className="relative min-h-screen text-foreground pb-16" style={display}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[500px] h-[500px] -top-32 -left-20 opacity-25" />
        <span className="orb orb-purple w-[400px] h-[400px] top-80 -right-20 opacity-20" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Service Off Banner */}
        <div className="rounded-3xl border-2 border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-card p-8 text-center space-y-4 shadow-2xl">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-black text-3xl text-rose-400">
            ⛔
          </div>
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1 text-[11px] font-black uppercase text-rose-300 tracking-wider">
              Service Currently Off
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              Payout & Cashout System is Currently Disabled
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Payout and earnings withdrawal services are officially turned <strong>OFF</strong>. AdsPx is operating exclusively as a high-performance URL shortener, Facebook & Meta ad cloaking protection, and traffic routing suite. Your existing links, redirection rules, and campaigns remain 100% active and running without interruption.
          </p>
          <div className="pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25 transition-all text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Return to Dashboard
            </Link>
          </div>
        </div>

        {/* Withdrawal History Table (Read-Only) */}
        {withdrawals.length > 0 && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-lg">
            <h3 className="font-extrabold text-lg text-foreground">Past Payout History</h3>
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
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/30">
                      <td className="py-3 text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</td>
                      <td className="py-3 font-mono font-bold">${Number(w.amount_usd || 0).toFixed(2)}</td>
                      <td className="py-3 text-muted-foreground">{w.network}</td>
                      <td className="py-3 font-mono text-xs">{w.wallet_address}</td>
                      <td className="py-3 text-right">
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
