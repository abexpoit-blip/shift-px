import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Zap, Crown, Check, Loader2, Clock, Copy,
  ExternalLink, ShieldCheck, AlertCircle, Sparkles,
  ArrowRight, Star, Infinity as InfinityIcon, Shield,
  Globe2, Cpu, DollarSign, Wallet, HelpCircle, ChevronDown,
  Layers, Flame, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { listPackages, createUpgradeRequest, getMyPlanStatus, type Package } from "@/lib/packages.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade to Premium — AdsPx Monetization & Cloaking" },
      { name: "description", content: "Unlock unlimited links, instant withdrawals, and advanced Facebook cloaking protection on AdsPx." }
    ]
  }),
  component: UpgradePage,
});

const NETWORKS = [
  { value: "USDT_TRC20", label: "USDT (TRC-20)", icon: "🟢", note: "Recommended · Lowest network fees" },
  { value: "USDT_BEP20", label: "USDT (BEP-20)", icon: "🟡", note: "Fast · Binance Smart Chain" },
  { value: "USDT_ERC20", label: "USDT (ERC-20)", icon: "🔵", note: "Ethereum Network" },
];

const COMPARISON_ROWS = [
  { feature: "Short Links Creation", free: "50 Links Limit", p6m: "Unlimited Links", p12m: "Unlimited Links" },
  { feature: "Traffic & Clicks Volume", free: "Unlimited", p6m: "Unlimited (Tier-1 Speed)", p12m: "Unlimited (Max Priority)" },
  { feature: "Earning Rate per 50k Human Clicks", free: "$1.00 USD", p6m: "$1.00 USD", p12m: "$1.00 USD" },
  { feature: "Earnings Withdrawal (Cashout)", free: "Disabled (Upgrade Req.)", p6m: "Instant (Min $5 USDT)", p12m: "Instant (Min $5 USDT)" },
  { feature: "Facebook & Meta Review Cloaking", free: "Standard Safe Article", p6m: "Advanced AI Shield", p12m: "Military-Grade VIP Shield" },
  { feature: "Zero Traffic Loss Direct 302", free: "Included", p6m: "Included (Ultra-Low Latency)", p12m: "Included (Dedicated Edge)" },
  { feature: "Adsterra SubID & UTM Forwarding", free: "Basic", p6m: "Full Dynamic Tracking", p12m: "Full Dynamic Tracking" },
  { feature: "Geo-Targeting & A/B Multi-Offer", free: "Not Available", p6m: "Full A/B Rotation", p12m: "Full A/B Rotation" },
  { feature: "Custom Short Domains", free: "Not Available", p6m: "Standard", p12m: "Unlimited Custom Domains" },
  { feature: "Support Tier", free: "Community Support", p6m: "Priority VIP Telegram", p12m: "24/7 Dedicated Account Manager" },
];

const FAQS = [
  {
    q: "How fast does my Premium membership activate?",
    a: "Activation is fully automated. As soon as your crypto payment receives 1 on-chain confirmation (usually within 1–3 minutes), your account is upgraded to Premium instantly."
  },
  {
    q: "Can I earn money on the Free plan before upgrading?",
    a: "Yes! Free users earn $1.00 for every 50,000 verified human clicks. All earnings accumulate in your balance. Once you are ready to cash out (min $5), simply upgrade to Premium to enable instant withdrawals."
  },
  {
    q: "How does the $5 minimum withdrawal work?",
    a: "Premium members can request withdrawals anytime their available balance reaches $5.00 or more. Payouts are sent directly in USDT (TRC-20, BEP-20, or ERC-20) to your specified wallet address."
  },
  {
    q: "What happens to my links if my subscription expires?",
    a: "Your links never break or go offline. If your plan expires, existing links continue redirecting normally. You can renew at any time to create new links and submit withdrawal requests."
  }
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
  const is6M = pkg.slug === "premium_6m";
  const isFree = pkg.slug === "free";

  return (
    <div
      onClick={isFree ? undefined : onSelect}
      className={`group relative flex flex-col justify-between rounded-3xl p-7 transition-all duration-300 ${
        isFree
          ? "border border-border/70 bg-card/40 opacity-90 cursor-default"
          : isYearly
            ? selected
              ? "border-2 border-amber-400/90 bg-gradient-to-b from-amber-500/10 via-purple-500/5 to-card shadow-[0_0_40px_rgba(245,158,11,0.25)] scale-[1.02] cursor-pointer"
              : "border border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-card hover:border-amber-400 hover:shadow-xl hover:scale-[1.01] cursor-pointer"
            : selected
              ? "border-2 border-indigo-500 bg-gradient-to-b from-indigo-500/15 via-purple-500/5 to-card shadow-[0_0_35px_rgba(99,102,241,0.3)] scale-[1.02] cursor-pointer"
              : "border border-indigo-500/30 bg-card hover:border-indigo-500/70 hover:shadow-lg hover:scale-[1.01] cursor-pointer"
      }`}
    >
      {/* Top Banner Tag */}
      {isYearly && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 px-4 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-lg animate-pulse">
            <Star className="h-3.5 w-3.5 fill-current" /> BEST VALUE · SAVE $20 (2 MO FREE)
          </span>
        </div>
      )}

      {is6M && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg">
            <Flame className="h-3.5 w-3.5 fill-current" /> MOST POPULAR
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3.5 right-6 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-black uppercase text-white shadow-md">
            <Check className="h-3.5 w-3.5 stroke-[3]" /> Active Plan
          </span>
        </div>
      )}

      <div>
        {/* Plan Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-md ${
                isFree
                  ? "bg-muted text-muted-foreground"
                  : isYearly
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950"
                    : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
              }`}
            >
              {isFree ? (
                <Zap className="h-6 w-6" />
              ) : isYearly ? (
                <Crown className="h-6 w-6 stroke-[2.5]" />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-foreground tracking-tight">{pkg.name}</h3>
              <p className="text-xs text-muted-foreground">
                {isFree ? "Starter tier" : `${pkg.duration_months} Months Full Access`}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Display */}
        <div className="mb-6 pb-6 border-b border-border/60">
          {isFree ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight text-foreground">$0</span>
              <span className="text-xs font-semibold text-muted-foreground">/ Forever</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                  ${pkg.price_usd}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  / {pkg.duration_months} Months
                </span>
                {isYearly && (
                  <span className="text-sm font-bold text-muted-foreground line-through opacity-70">
                    $120
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-emerald-500">
                {isYearly ? "Only $8.33 / month" : "Only $10.00 / month"}
              </p>
            </div>
          )}
        </div>

        {/* Features List */}
        <div className="space-y-3 mb-6">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
            What is included:
          </div>
          <ul className="space-y-2.5">
            {(pkg.features as string[]).map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                <div
                  className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isFree
                      ? "bg-muted text-muted-foreground"
                      : isYearly
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-indigo-500/20 text-indigo-400"
                  }`}
                >
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
                <span className={isFree && f.includes("No withdrawal") ? "text-amber-500 font-semibold" : "text-foreground"}>
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Select Button */}
      {!isFree && (
        <div
          className={`mt-4 h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-extrabold transition-all shadow-md ${
            selected
              ? isYearly
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              : isYearly
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 group-hover:bg-amber-500/20"
                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 group-hover:bg-indigo-500/20"
          }`}
        >
          {selected ? <Check className="h-4 w-4 stroke-[3]" /> : <ArrowRight className="h-4 w-4" />}
          {selected ? "Selected Plan" : "Choose " + pkg.name}
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
      toast.success(`${type === "amount" ? "Amount" : "Wallet address"} copied to clipboard!`);
      setTimeout(() => setCopied(null), 2500);
    });
  };

  const expiresIn = Math.max(0, Math.round((new Date(result.expiresAt).getTime() - Date.now()) / 60000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Invoice Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-xl leading-none mb-1">Upgrade Invoice</h3>
                <p className="text-xs text-white/80 font-medium">
                  {result.packageName} · <strong className="text-white">${result.amountUsd} USD</strong>
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-400/20 border border-emerald-400/40 px-3 py-1 text-[11px] font-bold text-emerald-300 animate-pulse">
              Awaiting Payment
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {result.manualMode ? (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                <AlertCircle className="h-5 w-5" /> Manual Payment Instructions
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Automated gateway is in maintenance. Please send <strong>${result.amountUsd} USDT</strong> to the official admin address and send your transaction hash via Telegram support for instant approval.
              </p>
            </div>
          ) : (
            <>
              {/* Crypto details panel */}
              <div className="rounded-2xl bg-muted/50 border border-border/80 p-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <span className="text-xs font-semibold text-muted-foreground">Payment Network</span>
                  <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> {result.cryptoCurrency}
                  </span>
                </div>

                {result.cryptoAmount && (
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <span className="text-xs font-semibold text-muted-foreground">Exact Amount to Send</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg text-emerald-500">
                        {result.cryptoAmount} {result.cryptoCurrency?.split("_")[0]}
                      </span>
                      <button
                        onClick={() => copy(result.cryptoAmount!, "amount")}
                        className="h-8 px-2.5 rounded-lg bg-card border border-border flex items-center gap-1 text-xs font-semibold hover:bg-muted transition-colors"
                      >
                        {copied === "amount" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === "amount" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {result.cryptoAddress && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                      <span>Deposit Wallet Address</span>
                      <span className="text-[10px] text-amber-500 font-bold">Send only {result.cryptoCurrency}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-bold bg-background rounded-xl p-3 flex-1 break-all border border-border/80 text-foreground">
                        {result.cryptoAddress}
                      </code>
                      <button
                        onClick={() => copy(result.cryptoAddress!, "address")}
                        className="h-11 px-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity flex-shrink-0"
                      >
                        {copied === "address" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied === "address" ? "Copied" : "Copy"}
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
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 font-bold text-sm border border-indigo-500/30 hover:bg-indigo-500/20 transition-all"
                >
                  <ExternalLink className="h-4 w-4" /> Open Dedicated Plisio Checkout Window
                </a>
              )}

              <div className="flex items-center gap-2.5 text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span>
                  Invoice expires in <strong>~{expiresIn} minutes</strong>. Membership activates automatically upon 1 network confirmation.
                </span>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span>Instant Webhook: No manual approval needed. Your dashboard upgrades the moment the transaction confirms.</span>
          </div>

          <Button onClick={onClose} variant="outline" className="w-full h-11 rounded-2xl font-bold">
            Done / Close Window
          </Button>
        </div>
      </div>
    </div>
  );
}

function UpgradePage() {
  const listFn = useServerFn(listPackages);
  const statusFn = useServerFn(getMyPlanStatus);
  const upgradeFn = useServerFn(createUpgradeRequest);

  const [selectedSlug, setSelectedSlug] = useState<"premium_6m" | "premium_12m">("premium_12m");
  const [network, setNetwork] = useState("USDT_TRC20");
  const [invoiceResult, setInvoiceResult] = useState<any>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      toast.error(e.message || "Failed to generate invoice");
    },
  });

  const isPremium = status?.planSlug !== "free" && status?.premiumUntil
    ? new Date(status.premiumUntil) > new Date()
    : false;

  return (
    <div className="relative min-h-screen pb-16" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[600px] h-[600px] -top-32 -left-20 opacity-30" />
        <span className="orb orb-purple w-[500px] h-[500px] top-96 -right-24 opacity-25" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Page Hero Header */}
        <header className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-indigo-400 shadow-glow">
            <Crown className="h-4 w-4" /> Enterprise Traffic & Cloaking Engine
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
            Monetize & Protect <br />
            <span className="text-gradient">Every Single Click</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Create unlimited short links, enjoy zero-loss redirection, bypass Facebook ad review checks with stealth cloaking, and unlock instant USDT payouts.
          </p>
        </header>

        {/* Active Premium Banner */}
        {isPremium && (
          <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-card p-6 flex flex-col sm:flex-row items-center gap-5 shadow-lg">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 text-emerald-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="font-extrabold text-lg text-foreground">You are currently on Premium!</span>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                  Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Access expires on{" "}
                <strong className="text-foreground">
                  {new Date(status!.premiumUntil!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </strong>
                . Upgrading or extending will automatically add duration to your existing plan.
              </p>
            </div>
          </div>
        )}

        {/* Feature Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            {
              icon: Zap,
              title: "Zero Traffic Loss",
              desc: "Instant HTTP 302 routing with strict no-cache headers. 100% visits reach Adsterra.",
              color: "text-amber-400",
            },
            {
              icon: Shield,
              title: "FB Stealth Cloaking",
              desc: "Automated safe article delivery for Meta review crawlers. 0% ad rejection risk.",
              color: "text-indigo-400",
            },
            {
              icon: Wallet,
              title: "Instant Cashout",
              desc: "Minimum $5 withdrawal threshold in USDT (TRC-20, BEP-20, ERC-20).",
              color: "text-emerald-400",
            },
            {
              icon: Globe2,
              title: "SubID & Geo Split",
              desc: "Dynamic SubID forwarding and multi-offer A/B country rotation engine.",
              color: "text-purple-400",
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="rounded-3xl bg-card/60 border border-border/80 p-5 space-y-2 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2.5">
                <Icon className={`h-5 w-5 ${color}`} />
                <h4 className="font-bold text-sm text-foreground">{title}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Plan Cards Grid */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">Select Your Membership</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Choose the package that fits your campaign volume. Instant crypto activation.
            </p>
          </div>

          {pkgsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
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
        </div>

        {/* Crypto Payment Checkout Box */}
        <div className="rounded-3xl border-2 border-indigo-500/30 bg-card p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/70">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 font-black text-lg">
                <Sparkles className="h-5 w-5" /> Automated Self-Hosted Crypto Checkout
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Selected Plan:{" "}
                <strong className="text-foreground">
                  {selectedSlug === "premium_12m" ? "Premium — 12 Months ($100 USD)" : "Premium — 6 Months ($60 USD)"}
                </strong>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-2xl font-black text-foreground">
                {selectedSlug === "premium_12m" ? "$100.00" : "$60.00"}
              </span>
              <span className="text-xs text-muted-foreground block">USDT Equivalent</span>
            </div>
          </div>

          {/* Network Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              1. Choose Payment Network:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {NETWORKS.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNetwork(n.value)}
                  className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-4 transition-all text-left ${
                    network === n.value
                      ? "border-primary bg-primary/10 shadow-glow"
                      : "border-border bg-muted/20 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>{n.icon}</span> {n.label}
                    </span>
                    {network === n.value && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">{n.note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA Action */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => upgrade.mutate()}
              disabled={upgrade.isPending || !selectedSlug}
              className="w-full h-14 text-lg font-black bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 text-white hover:opacity-95 shadow-[0_0_30px_rgba(99,102,241,0.4)] rounded-2xl"
            >
              {upgrade.isPending ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mr-3" /> Generating Secure Invoice…
                </>
              ) : (
                <>
                  <Crown className="h-6 w-6 mr-3 stroke-[2.5]" />
                  Pay ${selectedSlug === "premium_12m" ? "100" : "60"} & Upgrade Instantly
                </>
              )}
            </Button>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Instant on-chain confirmation
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> No hidden fees
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> 100% automated activation
              </span>
            </div>
          </div>
        </div>

        {/* Feature Comparison Matrix */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-2xl font-black text-foreground">Detailed Plan Comparison</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Compare all features and facilities between Free and Premium plans.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground font-bold">
                  <th className="pb-4 pt-2 font-extrabold text-foreground">System Feature</th>
                  <th className="pb-4 pt-2 text-center w-36 sm:w-48">Free Plan</th>
                  <th className="pb-4 pt-2 text-center w-36 sm:w-48 text-indigo-400 font-extrabold">Premium 6M</th>
                  <th className="pb-4 pt-2 text-center w-36 sm:w-48 text-amber-400 font-black">Premium 12M 💎</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 font-semibold text-foreground">{row.feature}</td>
                    <td className="py-3.5 text-center text-muted-foreground">
                      {row.free.includes("Disabled") || row.free.includes("Not Available") ? (
                        <span className="inline-flex items-center gap-1 text-amber-500/90 font-medium">
                          <XCircle className="h-3.5 w-3.5" /> {row.free}
                        </span>
                      ) : (
                        row.free
                      )}
                    </td>
                    <td className="py-3.5 text-center font-bold text-indigo-300 bg-indigo-500/5">
                      {row.p6m}
                    </td>
                    <td className="py-3.5 text-center font-extrabold text-amber-300 bg-amber-500/5">
                      {row.p12m}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQs */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-xl font-extrabold text-foreground">Frequently Asked Questions</h3>
              <p className="text-xs text-muted-foreground">Everything you need to know about AdsPx memberships.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/80 bg-muted/20 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex items-center justify-between w-full p-4 text-left font-bold text-sm text-foreground hover:bg-muted/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      openFaq === i ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="p-4 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {invoiceResult && (
        <InvoicePanel result={invoiceResult} onClose={() => setInvoiceResult(null)} />
      )}
    </div>
  );
}
