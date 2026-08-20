import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Zap, Crown, Check, Loader2, Clock, Copy,
  ExternalLink, ShieldCheck, AlertCircle, Sparkles,
  ArrowRight, Star, Infinity
} from "lucide-react";
import { toast } from "sonner";
import { listPackages, createUpgradeRequest, getMyPlanStatus, type Package } from "@/lib/packages.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — AdsPx" }] }),
  component: UpgradePage,
});

const NETWORKS = [
  { value: "USDT_TRC20", label: "USDT (TRC-20)", icon: "🟢", note: "Cheapest fees" },
  { value: "USDT_BEP20", label: "USDT (BEP-20)", icon: "🟡", note: "Fast" },
  { value: "USDT_ERC20", label: "USDT (ERC-20)", icon: "🔵", note: "Most popular" },
];

function PlanCard({
  pkg,
  isCurrent,
  onSelect,
  selected,
}: {
  pkg: Package;
  isCurrent: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  const isYearly = pkg.slug === "premium_12m";
  const isFree = pkg.slug === "free";

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 cursor-pointer transition-all duration-200 ${
        isFree
          ? "border-border bg-card/50 opacity-75 cursor-default"
          : selected
            ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "border-border bg-card hover:border-primary/50 hover:shadow-lg"
      }`}
      onClick={isFree ? undefined : onSelect}
    >
      {isYearly && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-lg">
            <Star className="h-3 w-3" /> BEST VALUE — SAVE $20
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-bold text-white">
            <Check className="h-3 w-3" /> Current Plan
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isFree ? (
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow">
              <Crown className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <div className="font-bold text-foreground">{pkg.name}</div>
            {!isFree && (
              <div className="text-[11px] text-muted-foreground">
                {pkg.duration_months}-month access
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          {isFree ? (
            <div className="text-2xl font-black text-foreground">$0</div>
          ) : (
            <>
              <div className="text-2xl font-black text-foreground">${pkg.price_usd}</div>
              {isYearly && (
                <div className="text-[11px] text-muted-foreground line-through">$120</div>
              )}
            </>
          )}
        </div>
      </div>

      <ul className="space-y-2 mb-4">
        {(pkg.features as string[]).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isFree ? "text-muted-foreground" : "text-emerald-500"}`} />
            <span className={isFree ? "text-muted-foreground" : "text-foreground"}>{f}</span>
          </li>
        ))}
      </ul>

      {!isFree && (
        <div
          className={`mt-4 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
            selected
              ? "bg-primary text-primary-foreground shadow-glow"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {selected ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          {selected ? "Selected" : "Select Plan"}
        </div>
      )}
    </div>
  );
}

function InvoicePanel({
  result,
  onClose,
}: {
  result: {
    requestId: string;
    packageName: string;
    amountUsd: number;
    cryptoCurrency: string | null;
    cryptoAmount: string | null;
    cryptoAddress: string | null;
    plisioInvoiceUrl: string | null;
    expiresAt: string;
    manualMode: boolean;
  };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"amount" | "address" | null>(null);

  const copy = (val: string, type: "amount" | "address") => {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const expiresIn = Math.max(0, Math.round((new Date(result.expiresAt).getTime() - Date.now()) / 60000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <div className="font-black text-lg">Upgrade Invoice</div>
              <div className="text-sm text-white/80">{result.packageName} — ${result.amountUsd} USD</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {result.manualMode ? (
            /* Manual payment mode */
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
              <div className="flex items-center gap-2 text-amber-600 font-bold mb-2">
                <AlertCircle className="h-4 w-4" /> Manual Payment Mode
              </div>
              <p className="text-sm text-muted-foreground">
                Plisio is not configured yet. Please send the payment manually to the admin wallet and contact support with your transaction hash.
              </p>
            </div>
          ) : (
            <>
              {/* Crypto payment details */}
              <div className="space-y-3">
                <div className="rounded-xl bg-muted p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <span className="font-bold text-foreground">{result.cryptoCurrency}</span>
                  </div>
                  {result.cryptoAmount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount to send</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-600">{result.cryptoAmount}</span>
                        <button
                          onClick={() => copy(result.cryptoAmount!, "amount")}
                          className="h-7 w-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          {copied === "amount" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {result.cryptoAddress && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Send to address</div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-background rounded-lg p-2 flex-1 break-all border border-border">
                          {result.cryptoAddress}
                        </code>
                        <button
                          onClick={() => copy(result.cryptoAddress!, "address")}
                          className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted flex-shrink-0"
                        >
                          {copied === "address" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {result.plisioInvoiceUrl && (
                  <a
                    href={result.plisioInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-indigo-500/10 text-indigo-600 font-bold text-sm border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" /> View Full Invoice on Plisio
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-amber-500" />
                Invoice expires in ~{expiresIn} minutes. Premium activates automatically after payment confirmation.
              </div>
            </>
          )}

          <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-3">
            <div className="flex items-center gap-2 text-sm text-indigo-600 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Premium activates instantly once payment is confirmed.
            </div>
          </div>

          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function UpgradePage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listPackages);
  const statusFn = useServerFn(getMyPlanStatus);
  const upgradeFn = useServerFn(createUpgradeRequest);

  const [selectedSlug, setSelectedSlug] = useState<"premium_6m" | "premium_12m">("premium_6m");
  const [network, setNetwork] = useState("USDT_TRC20");
  const [invoiceResult, setInvoiceResult] = useState<any>(null);

  const { data: packages = [], isLoading: pkgsLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const { data: status } = useQuery({
    queryKey: ["my-plan-status"],
    queryFn: () => statusFn(),
  });

  const upgrade = useMutation({
    mutationFn: () =>
      upgradeFn({ data: { package_slug: selectedSlug, crypto_currency: network } }),
    onSuccess: (res) => {
      setInvoiceResult(res);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const isPremium = status?.planSlug !== "free" && status?.premiumUntil
    ? new Date(status.premiumUntil) > new Date()
    : false;

  return (
    <div className="relative min-h-screen" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[500px] h-[500px] -top-32 -left-20 opacity-30" />
        <span className="orb orb-pink w-[400px] h-[400px] top-60 -right-24 opacity-20" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header */}
        <header className="anim-rise text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-400">
            <Crown className="h-3.5 w-3.5" /> Premium Plans
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight">
            Unlock <span className="text-gradient">everything</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Unlimited short links, priority support, and the ability to withdraw your earnings.
            Start earning at <strong>$1 per 50,000 verified human clicks</strong>.
          </p>
        </header>

        {isPremium && (
          <div className="anim-rise rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-4 flex items-center gap-4">
            <ShieldCheck className="h-8 w-8 text-emerald-500 flex-shrink-0" />
            <div>
              <div className="font-bold text-emerald-600">You are on Premium!</div>
              <div className="text-sm text-muted-foreground">
                Expires {new Date(status!.premiumUntil!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
                Upgrading again will extend from the current expiry date.
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="anim-rise d-1 grid grid-cols-3 gap-4">
          {[
            { icon: Zap, label: "Earnings Rate", value: "$1 / 50k clicks" },
            { icon: Infinity, label: "Premium Links", value: "Unlimited" },
            { icon: ShieldCheck, label: "Min Withdrawal", value: "$5 (Premium)" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-card border border-border p-4 text-center">
              <Icon className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-bold text-foreground mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        {pkgsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="anim-rise d-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <PlanCard
                key={pkg.slug}
                pkg={pkg}
                isCurrent={status?.planSlug === pkg.slug}
                selected={selectedSlug === pkg.slug}
                onSelect={() => setSelectedSlug(pkg.slug as "premium_6m" | "premium_12m")}
              />
            ))}
          </div>
        )}

        {/* Payment method selector + CTA */}
        <div className="anim-rise d-3 rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Payment Method (Crypto via Plisio)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {NETWORKS.map((n) => (
              <button
                key={n.value}
                onClick={() => setNetwork(n.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all text-sm font-semibold ${
                  network === n.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <span className="text-2xl">{n.icon}</span>
                <span>{n.label}</span>
                <span className="text-[10px] font-normal opacity-70">{n.note}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => upgrade.mutate()}
              disabled={upgrade.isPending || !selectedSlug}
              className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-700 text-white hover:opacity-90 shadow-glow"
            >
              {upgrade.isPending ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating Invoice…</>
              ) : (
                <><Crown className="h-5 w-5 mr-2" /> Upgrade Now</>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            By upgrading you accept our terms. Premium activates instantly after payment is confirmed on-chain (usually within 2–5 minutes).
          </p>
        </div>
      </div>

      {invoiceResult && (
        <InvoicePanel result={invoiceResult} onClose={() => setInvoiceResult(null)} />
      )}
    </div>
  );
}
