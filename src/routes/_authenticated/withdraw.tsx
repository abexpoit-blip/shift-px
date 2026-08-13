import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Wallet,
  Bitcoin,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addWallet,
  deleteWallet,
  getEarningsOverview,
  listWallets,
  listWithdrawals,
  requestWithdrawal,
  PAYOUT_NETWORKS,
  type WithdrawalRow,
} from "@/lib/earnings.functions";

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw earnings — Adspx" },
      { name: "description", content: "Cash out your Adspx earnings in USDT (TRC20 / BEP20). Minimum $10, processed within 24 hours." },
      { property: "og:title", content: "Withdraw earnings — Adspx" },
      { property: "og:description", content: "Cash out your Adspx earnings in USDT. Minimum $10, processed within 24 hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WithdrawPage,
});

const NETWORK_LABEL: Record<string, string> = {
  USDT_TRC20: "USDT · TRC20",
  USDT_BEP20: "USDT · BEP20",
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function StatusBadge({ status }: { status: WithdrawalRow["status"] }) {
  const map = {
    pending: { icon: Clock, cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Pending" },
    approved: { icon: Clock, cls: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Approved" },
    paid: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Paid" },
    rejected: { icon: XCircle, cls: "bg-red-500/10 text-red-600 border-red-500/20", label: "Rejected" },
  } as const;
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function WithdrawPage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getEarningsOverview);
  const walletsFn = useServerFn(listWallets);
  const historyFn = useServerFn(listWithdrawals);
  const addWalletFn = useServerFn(addWallet);
  const deleteWalletFn = useServerFn(deleteWallet);
  const requestFn = useServerFn(requestWithdrawal);

  const overview = useQuery({ queryKey: ["earnings-overview"], queryFn: () => overviewFn({}) });
  const wallets = useQuery({ queryKey: ["wallets"], queryFn: () => walletsFn({}) });
  const history = useQuery({ queryKey: ["withdrawals"], queryFn: () => historyFn({}) });

  const [showAdd, setShowAdd] = useState(false);
  const [network, setNetwork] = useState<(typeof PAYOUT_NETWORKS)[number]>("USDT_TRC20");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<string | null>(null);

  const balance = overview.data?.balanceAvailable ?? 0;
  const pending = overview.data?.balancePending ?? 0;
  const withdrawn = overview.data?.balanceWithdrawn ?? 0;
  const minAmount = overview.data?.minWithdrawal ?? 10;

  const saveWallet = useMutation({
    mutationFn: () => addWalletFn({ data: { network, address: address.trim(), label: label.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Wallet saved");
      setAddress("");
      setLabel("");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeWallet = useMutation({
    mutationFn: (id: string) => deleteWalletFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Wallet removed");
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: () => {
      const w = (wallets.data ?? []).find((x) => x.id === walletId);
      if (!w) throw new Error("Select a wallet first");
      return requestFn({
        data: { amount: Number(amount), network: w.network as (typeof PAYOUT_NETWORKS)[number], address: w.address },
      });
    },
    onSuccess: () => {
      toast.success("Withdrawal requested — processed within 24 hours");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["earnings-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const amountNum = Number(amount);
  const canSubmit =
    !!walletId && Number.isFinite(amountNum) && amountNum >= minAmount && amountNum <= balance && !submit.isPending;

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl space-y-5 sm:space-y-7">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Withdraw earnings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          USDT payouts on TRC20 / BEP20 · minimum {money(minAmount)} · processed within 24 hours.
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Available
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{money(balance)}</div>
          <p className="text-xs text-muted-foreground mt-1">Ready to withdraw</p>
        </div>
        <div className="rounded-2xl glass-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Pending
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{money(pending)}</div>
          <p className="text-xs text-muted-foreground mt-1">Awaiting payout</p>
        </div>
        <div className="rounded-2xl glass-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" /> Withdrawn
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{money(withdrawn)}</div>
          <p className="text-xs text-muted-foreground mt-1">Lifetime paid out</p>
        </div>
      </section>

      <section className="rounded-2xl glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Bitcoin className="h-4 w-4 text-primary" /> Your wallets
          </h2>
          <Button variant="outline" size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Add wallet
          </Button>
        </div>

        {showAdd && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 mb-4 space-y-3">
            <div className="flex gap-2">
              {PAYOUT_NETWORKS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNetwork(n)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    network === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {NETWORK_LABEL[n]}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-[1fr_200px] gap-3">
              <div>
                <Label htmlFor="addr">Wallet address</Label>
                <Input
                  id="addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="T... / 0x..."
                  maxLength={120}
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
              <div>
                <Label htmlFor="wlabel">Label (optional)</Label>
                <Input id="wlabel" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className="mt-1.5" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveWallet.mutate()} disabled={address.trim().length < 20 || saveWallet.isPending}>
                {saveWallet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save wallet"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {(wallets.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallets yet — add one to request a payout.</p>
        ) : (
          <ul className="space-y-2">
            {(wallets.data ?? []).map((w) => (
              <li key={w.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
                  {NETWORK_LABEL[w.network] ?? w.network}
                </span>
                {w.label && <span className="text-sm">{w.label}</span>}
                <span className="font-mono text-xs text-muted-foreground truncate flex-1">{w.address}</span>
                <button
                  onClick={() => removeWallet.mutate(w.id)}
                  className="text-muted-foreground hover:text-destructive transition"
                  aria-label="Delete wallet"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Request a withdrawal</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Min {money(minAmount)} · processed within 24 hours · no network fees deducted.
        </p>

        {balance < minAmount && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 mb-4">
            You need at least {money(minAmount)} available to request a payout.
          </div>
        )}

        <div className="space-y-4">
          <div className="max-w-xs">
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              min={minAmount}
              max={balance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {(wallets.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a wallet above to continue.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {(wallets.data ?? []).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWalletId(w.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    walletId === w.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="text-xs font-medium">{NETWORK_LABEL[w.network] ?? w.network}</div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">{w.address}</div>
                </button>
              ))}
            </div>
          )}

          <Button onClick={() => submit.mutate()} disabled={!canSubmit} className="bg-primary-gradient">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request withdrawal"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl glass-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Withdrawal history</h2>
        {(history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Network</th>
                  <th className="py-2 pr-3 font-medium">Wallet</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(history.data ?? []).map((w) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-3 font-semibold tabular-nums">{money(Number(w.amount_usd))}</td>
                    <td className="py-2.5 pr-3">{NETWORK_LABEL[w.network] ?? w.network}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground max-w-[180px] truncate">
                      {w.wallet_address}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
