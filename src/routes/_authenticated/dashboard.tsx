import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Link2,
  Eye,
  ShieldCheck,
  Smartphone,
  Globe2,
  RefreshCw,
  Sparkles,
  Coins,
  Archive,
  Activity,
} from "lucide-react";

import { getDashboardData, refreshDashboardData } from "@/lib/links.functions";
import { EarningsStrip } from "@/components/EarningsStrip";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Adspx" },
      {
        name: "description",
        content: "Live traffic, verified visits and payout progress for your Adspx smart links.",
      },
      { property: "og:title", content: "Dashboard — Adspx" },
      {
        property: "og:description",
        content: "Live traffic, verified visits and payout progress for your Adspx smart links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function fmtCompact(n: number | null | undefined) {
  const num = Number(n ?? 0);
  if (Number.isNaN(num) || !Number.isFinite(num)) return "0";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "k";
  return Math.round(num).toLocaleString();
}

/** Smooth count-up for headline numbers. */
function useCountUp(target: number | null | undefined, ms = 900) {
  const safeTarget = Number.isNaN(Number(target)) || !Number.isFinite(Number(target)) ? 0 : Number(target);
  const [val, setVal] = useState(safeTarget);
  const from = useRef(safeTarget);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(a + (safeTarget - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = safeTarget;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safeTarget, ms]);
  return Number.isNaN(val) ? 0 : val;
}

function formatRelativeTime(iso: string) {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DashboardPage() {
  const qc = useQueryClient();
  const dash = useServerFn(getDashboardData);
  const refreshDash = useServerFn(refreshDashboardData);

  const dashQ = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshDash(),
    onSuccess: (data) => {
      qc.setQueryData(["dashboard"], data);
      toast.success("Dashboard updated");
    },
    onError: (e: Error) => toast.error(e.message || "Refresh failed"),
  });

  const [range, setRange] = useState<"7D" | "30D">("7D");

  const links = dashQ.data?.links ?? [];
  const stats = dashQ.data?.stats;

  const totalClicks = links.reduce((s, l) => s + (l.clicks_count || 0), 0);
  const botBlocked = links.reduce((s, l) => s + (l.bot_clicks_count || 0), 0);
  const allTraffic = totalClicks + botBlocked;
  const activeLinks = links.filter((l) => l.is_active).length;
  const uniqueVisitors = stats?.uniqueVisitors ?? 0;
  const botPct = allTraffic > 0 ? (botBlocked / allTraffic) * 100 : 0;

  // Payout model: $1 per 50,000 verified human visits ($0.02 per 1k)
  const CLICKS_PER_DOLLAR = 50_000;
  const payoutEarned = totalClicks / CLICKS_PER_DOLLAR;
  const payoutProgress = totalClicks % CLICKS_PER_DOLLAR;
  const payoutRemaining = CLICKS_PER_DOLLAR - payoutProgress;
  const payoutPct = Math.min(100, Math.round((payoutProgress / CLICKS_PER_DOLLAR) * 100));

  const chartData = useMemo(() => {
    const byDay = stats?.clicksByDay ?? {};
    const keys = Object.keys(byDay).sort();
    const n = range === "7D" ? 7 : 30;
    const slice = keys.slice(-n);
    const prevSlice = keys.slice(-n * 2, -n);
    const vals = slice.map((k) => byDay[k] ?? 0);
    const prevVals = prevSlice.map((k) => byDay[k] ?? 0);
    const total = vals.reduce((s, v) => s + v, 0);
    const prevTotal = prevVals.reduce((s, v) => s + v, 0);
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : total > 0 ? 100 : 0;
    let peakIdx = 0,
      troughIdx = 0;
    vals.forEach((v, i) => {
      if (v > vals[peakIdx]) peakIdx = i;
      if (v < vals[troughIdx]) troughIdx = i;
    });
    return { vals, total, delta, peakIdx, troughIdx, labels: slice };
  }, [stats, range]);

  const regionRows = useMemo(() => {
    const cs = stats?.countryStats ?? {};
    const entries = Object.entries(cs).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (total === 0) return [] as { name: string; pct: number; tone: string }[];
    const tones = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
    const top = entries.slice(0, 3);
    const otherCount = entries.slice(3).reduce((s, [, n]) => s + n, 0);
    const rows = top.map(([name, n], i) => ({
      name,
      pct: Math.round((n / total) * 100),
      tone: tones[i],
    }));
    if (otherCount > 0)
      rows.push({ name: "Other", pct: Math.round((otherCount / total) * 100), tone: tones[3] });
    return rows;
  }, [stats]);

  const mobilePct = stats?.mobilePct ?? 0;
  const cachedAt = (dashQ.data as any)?._cachedAt as string | undefined;

  return (
    <div className="relative min-h-screen w-full text-foreground" style={display}>
      {/* ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[420px] h-[420px] -top-32 -left-24" />
        <span className="orb orb-pink w-[360px] h-[360px] top-40 -right-24" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── HERO HEADER ─────────────────────────── */}
        <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <span className="live-dot" /> Live overview
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight" style={display}>
              Your traffic, <span className="text-gradient">at a glance</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Verified human visits, shield activity and payout progress — all in real time.
              {cachedAt && (
                <span className="ml-1 text-muted-foreground/70">
                  Updated {formatRelativeTime(cachedAt)}.
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-border bg-card/70 p-1 backdrop-blur">
              {(["7D", "30D"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    range === r
                      ? "bg-primary-gradient text-white shadow-glow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
              title="Refresh data"
              className="w-10 h-10 rounded-xl border border-border bg-card/70 text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* EARNINGS SUMMARY */}
        <div className="anim-rise d-1">
          <EarningsStrip />
        </div>

        {/* ── KPI ROW ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            className="anim-rise d-1"
            icon={Users}
            label="Real visitors"
            value={totalClicks}
            sub="Humans served, bots filtered"
            accent="indigo"
          />
          <KpiCard
            className="anim-rise d-2"
            icon={Link2}
            label="Active links"
            value={activeLinks}
            sub={`${links.length} total campaigns`}
            accent="violet"
            plain
          />
          <KpiCard
            className="anim-rise d-3"
            icon={Eye}
            label="Unique visitors"
            value={uniqueVisitors}
            sub="Last 30 days, humans only"
            accent="pink"
          />
          <KpiCard
            className="anim-rise d-4"
            icon={ShieldCheck}
            label="Shield blocked"
            value={botPct}
            suffix="%"
            decimals={1}
            sub={`${fmtCompact(botBlocked)} scanners stopped`}
            accent="emerald"
            plain
          />
        </div>

        {/* ── MAIN GRID ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Chart */}
            <Panel className="p-6 anim-rise d-2">
              <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" /> Clicks over{" "}
                    {range === "7D" ? "7 days" : "30 days"}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <AnimatedNumber
                      value={chartData.total}
                      className="text-3xl font-extrabold tabular-nums"
                    />
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        chartData.delta >= 0
                          ? "text-emerald-600 bg-emerald-500/10"
                          : "text-rose-600 bg-rose-500/10"
                      }`}
                    >
                      {chartData.delta >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(chartData.delta).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compared with the previous period
                  </p>
                </div>
              </div>
              <AreaChart
                vals={chartData.vals}
                peakIdx={chartData.peakIdx}
                labels={chartData.labels}
              />
            </Panel>

            {/* MANAGE LINKS CTA (creation lives on /links) */}
            <Link
              to="/links"
              className="anim-rise d-3 sheen sheen-hover w-full group relative rounded-2xl bg-primary-gradient p-5 flex items-center gap-4 shadow-xl shadow-glow hover:-translate-y-0.5 transition-all"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 blur-3xl rounded-full pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 float-slow">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left relative">
                <h4 className="text-white font-bold text-[15px]" style={display}>
                  Manage your smart links
                </h4>
                <p className="text-white/85 text-xs mt-0.5">
                  {links.length} link{links.length === 1 ? "" : "s"} · {activeLinks} active · create
                  & edit in one place
                </p>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 bg-white text-primary px-4 py-2 rounded-lg font-bold text-xs group-hover:scale-105 transition-transform">
                Open Links <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* LIFETIME DATA */}
            <Panel className="p-5 anim-rise d-4">
              <h4 className="text-base font-bold flex items-center gap-2" style={display}>
                <Archive className="w-4 h-4 text-primary" /> Lifetime data is safe
              </h4>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Raw per-click logs are trimmed weekly so the platform stays fast at any scale, but
                your lifetime click totals, country stats and earnings are archived permanently — no
                weekly reset, no lost balance.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Lifetime visits" value={fmtCompact(totalClicks)} icon={Users} />
                <MiniStat label="Bots filtered" value={fmtCompact(botBlocked)} icon={ShieldCheck} />
              </div>
            </Panel>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* Payout progress */}
            <Panel className="p-6 anim-rise d-3 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <h4 className="text-base font-bold flex items-center gap-2" style={display}>
                <Coins className="w-4 h-4 text-primary" /> Payout progress
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                $1 for every 100,000 verified human visits.
              </p>

              <div className="mt-5 flex items-center justify-center">
                <ProgressRing
                  pct={payoutPct}
                  label={`$${payoutEarned.toFixed(2)}`}
                  caption="earned"
                />
              </div>

              <div className="mt-5 space-y-2 text-xs">
                <Row label="Verified visits" value={fmtCompact(totalClicks)} />
                <Row label="Next $1 milestone" value={`${fmtCompact(payoutRemaining)} left`} />
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-border overflow-hidden stripe-track">
                <div
                  className="h-full rounded-full bar-fill shadow-glow"
                  style={{ width: `${payoutPct}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" /> {payoutPct}% to your next dollar
              </p>
            </Panel>

            {/* Region + mobile */}
            <Panel className="p-6 anim-rise d-4">
              <h4 className="text-base font-bold flex items-center gap-2" style={display}>
                <Globe2 className="w-4 h-4 text-primary spin-slow" /> Traffic by region
              </h4>
              <div className="mt-4 space-y-3.5">
                {regionRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No traffic yet.</p>
                ) : (
                  regionRows.map((r, i) => <RegionRow key={r.name} {...r} delay={i * 90} />)
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-border flex flex-col items-center">
                <ProgressRing pct={mobilePct} label={`${mobilePct}%`} caption="mobile" size={116} />
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" /> Mobile traffic share
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ COMPONENTS ════════════════════ */

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"rounded-2xl glass-card " + className}>{children}</div>;
}

function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  className = "",
  compact = false,
}: {
  value: number | null | undefined;
  decimals?: number;
  suffix?: string;
  className?: string;
  compact?: boolean;
}) {
  const raw = Number(value ?? 0);
  const safe = Number.isNaN(raw) || !Number.isFinite(raw) ? 0 : raw;
  const v = useCountUp(safe);
  const text = compact && decimals === 0 ? fmtCompact(v) : (Number.isNaN(v) ? 0 : v).toFixed(decimals);
  return (
    <span className={className} style={display}>
      {text}
      {suffix}
    </span>
  );
}

const ACCENTS: Record<string, string> = {
  indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-600",
  violet: "from-violet-500/15 to-violet-500/0 text-violet-600",
  pink: "from-pink-500/15 to-pink-500/0 text-pink-600",
  emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-600",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  suffix,
  decimals = 0,
  plain = false,
  className = "",
}: {
  icon: any;
  label: string;
  value: number;
  sub: string;
  accent: keyof typeof ACCENTS | string;
  suffix?: string;
  decimals?: number;
  plain?: boolean;
  className?: string;
}) {
  return (
    <div className={`group rounded-2xl glass-card p-4 relative overflow-hidden ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none ${ACCENTS[accent] ?? ACCENTS.indigo}`}
      />
      <div className="relative flex items-start justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <span
          className={`grid h-8 w-8 place-items-center rounded-xl bg-card/80 border border-border shadow-sm ${(
            ACCENTS[accent] ?? ACCENTS.indigo
          )
            .split(" ")
            .pop()} group-hover:scale-110 transition-transform`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="relative mt-2">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          suffix={suffix}
          compact={!plain || decimals === 0}
          className="text-2xl lg:text-3xl font-extrabold tabular-nums"
        />
      </div>
      <div className="relative text-[11px] font-semibold mt-1 text-muted-foreground">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl surface-soft p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-bold flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-primary" /> {label}
      </div>
      <div className="text-xl font-extrabold tabular-nums mt-1" style={display}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function AreaChart({
  vals,
  peakIdx,
  labels,
}: {
  vals: number[];
  peakIdx: number;
  labels: string[];
}) {
  const max = Math.max(1, ...vals);
  const [hover, setHover] = useState<number | null>(null);
  const sw = 800,
    sh = 200;

  const pts =
    vals.length > 1
      ? vals.map((v, i) => {
          const x = (i / (vals.length - 1)) * sw;
          const y = sh - (v / max) * (sh - 30) - 14;
          return [x, y] as const;
        })
      : ([
          [0, sh / 2],
          [sw, sh / 2],
        ] as const);

  // smooth cubic path
  const line =
    pts.length > 1
      ? pts.reduce((d, [x, y], i, a) => {
          if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
          const [px, py] = a[i - 1];
          const cx = (px + x) / 2;
          return `${d} C${cx.toFixed(1)},${py.toFixed(1)} ${cx.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
        }, "")
      : `M0,${sh / 2} L${sw},${sh / 2}`;
  const area = `${line} L${sw},${sh} L0,${sh} Z`;

  const fmtLabel = (k: string) => {
    if (!k) return "";
    const d = new Date(k);
    if (isNaN(d.getTime())) return k.slice(-5);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const active = hover ?? peakIdx;
  const activePt = pts[Math.min(active, pts.length - 1)];

  return (
    <div className="space-y-3">
      <div className="relative flex gap-2">
        {/* y axis */}
        <div className="flex w-10 shrink-0 flex-col justify-between py-1 text-right text-[10px] font-bold tabular-nums text-muted-foreground/70">
          {[1, 0.66, 0.33, 0].map((g) => (
            <span key={g}>{fmtCompact(max * g)}</span>
          ))}
        </div>

        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${sw} ${sh}`}
            preserveAspectRatio="none"
            className="w-full h-[210px] overflow-visible"
          >
            <defs>
              <linearGradient id="dashLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--primary-glow)" />
                <stop offset="100%" stopColor="var(--primary)" />
              </linearGradient>
              <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.33, 0.66, 1].map((g) => (
              <line
                key={g}
                x1="0"
                x2={sw}
                y1={Math.max(1, sh * g)}
                y2={Math.max(1, sh * g)}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
            ))}
            <path d={area} fill="url(#dashArea)" />
            <path
              d={line}
              fill="none"
              stroke="url(#dashLine)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="anim-fade"
            />
            {activePt && (
              <>
                <line
                  x1={activePt[0]}
                  x2={activePt[0]}
                  y1={activePt[1]}
                  y2={sh}
                  stroke="var(--primary)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity="0.5"
                />
                <circle
                  cx={activePt[0]}
                  cy={activePt[1]}
                  r="5.5"
                  fill="var(--primary)"
                  stroke="var(--card)"
                  strokeWidth="2.5"
                />
              </>
            )}
          </svg>

          {/* hover hit-areas */}
          <div className="absolute inset-0 flex">
            {vals.map((_, i) => (
              <div
                key={i}
                className="flex-1 cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </div>

          {activePt && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(activePt[0] / sw) * 100}%`,
                top: `${(activePt[1] / sh) * 100}%`,
                marginTop: -10,
              }}
            >
              <div
                className="rounded-lg bg-foreground text-background px-2.5 py-1.5 text-[11px] font-bold shadow-lg whitespace-nowrap"
                style={display}
              >
                {fmtCompact(vals[active] ?? 0)} clicks
                <span className="block text-[9px] font-normal opacity-70 leading-none mt-0.5">
                  {fmtLabel(labels[active] ?? "")}
                </span>
              </div>
            </div>
          )}

          <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {labels.length > 0 && (
              <>
                <span>{fmtLabel(labels[0])}</span>
                {labels.length > 6 && (
                  <span>{fmtLabel(labels[Math.floor(labels.length / 2)])}</span>
                )}
                <span className="text-primary">{fmtLabel(labels[labels.length - 1])}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegionRow({
  name,
  pct,
  tone,
  delay = 0,
}: {
  name: string;
  pct: number;
  tone: string;
  delay?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 80 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tone }} />
        <span className="text-sm flex-1 truncate">{name}</span>
        <span className="text-sm font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${w}%`, background: tone }}
        />
      </div>
    </div>
  );
}

function ProgressRing({
  pct,
  label,
  caption,
  size = 132,
}: {
  pct: number;
  label: string;
  caption: string;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const t = setTimeout(() => setOffset(c - (Math.min(100, pct) / 100) * c), 120);
    return () => clearTimeout(t);
  }, [pct, c]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary-glow)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums" style={display}>
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          {caption}
        </span>
      </div>
    </div>
  );
}
