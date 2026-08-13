import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy, Trash2, Play, Pause, Plus, Search, ArrowRight, LifeBuoy,
  TrendingUp, Filter, RefreshCw, ChevronRight, Smartphone, Shield, ShieldCheck,
} from "lucide-react";


import { getDashboardData, refreshDashboardData, createLink, deleteLink, toggleLink } from "@/lib/links.functions";

import { getPrimaryShortenerDomain } from "@/lib/shortener-domains.functions";
import { DEFAULT_SHORT_HOST, DEFAULT_SHORT_ORIGIN, isFlaggedShortDomain } from "@/lib/short-domains";
import { getClickResetNotice, dismissClickResetNotice } from "@/lib/click-reset.functions";
import { BroadcastBell } from "@/components/broadcast-bell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button as UIButton } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { CountryShieldDialog } from "@/components/CountryShieldDialog";


import { EarningsStrip } from "@/components/EarningsStrip";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Adspx" }] }),
  component: DashboardPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function fmtCompact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toLocaleString();
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
    staleTime: Infinity,          // Hybrid: never auto-stale, cache-first from DB
    gcTime: 30 * 60_000,
    refetchInterval: false,       // No auto-refetch — user controls freshness
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
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
  const botPct = allTraffic > 0 ? ((botBlocked / allTraffic) * 100) : 0;

  // Free-for-all payout model: $1 per 50,000 verified human visits.
  const CLICKS_PER_DOLLAR = 50_000;
  const payoutEarned = totalClicks / CLICKS_PER_DOLLAR;
  const payoutProgress = totalClicks % CLICKS_PER_DOLLAR;
  const payoutRemaining = CLICKS_PER_DOLLAR - payoutProgress;
  const payoutPct = Math.min(100, Math.round((payoutProgress / CLICKS_PER_DOLLAR) * 100));


  // REAL chart data from clicks table
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
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : (total > 0 ? 100 : 0);
    let peakIdx = 0, troughIdx = 0;
    vals.forEach((v, i) => {
      if (v > vals[peakIdx]) peakIdx = i;
      if (v < vals[troughIdx]) troughIdx = i;
    });
    return { vals, total, delta, peakIdx, troughIdx, labels: slice };
  }, [stats, range]);

  // REAL country stats top 4
  const regionRows = useMemo(() => {
    const cs = stats?.countryStats ?? {};
    const entries = Object.entries(cs).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (total === 0) return [] as { name: string; pct: number; color: string }[];
    const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
    const top = entries.slice(0, 3);
    const otherCount = entries.slice(3).reduce((s, [, n]) => s + n, 0);
    const rows = top.map(([name, n], i) => ({ name, pct: Math.round((n / total) * 100), color: palette[i] }));
    if (otherCount > 0) rows.push({ name: "Other", pct: Math.round((otherCount / total) * 100), color: palette[3] });
    return rows;
  }, [stats]);

  const mobilePct = stats?.mobilePct ?? 0;

  return (
    <div className="min-h-screen w-full text-foreground" style={display}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* EARNINGS SUMMARY */}
        <EarningsStrip />


        {/* KPI ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="REAL VISITORS" value={fmtCompact(totalClicks)} sub={`Humans served — bots filtered out`} tone="muted" />
          <KpiCard label="ACTIVE LINKS" value={String(activeLinks)} sub={`${links.length} total`} tone="muted" />
          <KpiCard label="UNIQUE VISITORS" value={fmtCompact(uniqueVisitors)} sub="Last 30 days, humans only" tone="muted" />
          <KpiCard label="SHIELD BLOCKED ✓" value={`${botPct.toFixed(1)}%`} sub={`${fmtCompact(botBlocked)} scanners stopped`} tone="muted" />
        </div>


        {/* MAIN GRID: chart + side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT: chart + CTA + table */}
          <div className="lg:col-span-2 space-y-5">
            {/* Chart */}
            <Panel className="p-6">
              <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Clicks over {range === "7D" ? "7 days" : "30 days"}</p>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-3xl font-extrabold text-foreground tabular-nums" style={display}>{fmtCompact(chartData.total)}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${chartData.delta >= 0 ? "text-primary bg-border" : "text-muted-foreground bg-muted"}`}>
                      {chartData.delta >= 0 ? "+" : ""}{chartData.delta.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Tracking real-time traffic volume</p>
                </div>
                <div className="flex gap-1 bg-border/60 p-1 rounded-xl">
                  {(["7D", "30D"] as const).map((r) => (
                    <button key={r} onClick={() => setRange(r)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${range === r ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-muted-foreground"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <BarSparkChart vals={chartData.vals} peakIdx={chartData.peakIdx} troughIdx={chartData.troughIdx} labels={chartData.labels} />
            </Panel>

            {/* MANAGE LINKS CTA */}
            <Link
              to="/links"
              className="w-full group relative overflow-hidden rounded-2xl bg-primary-gradient p-5 flex items-center gap-4 shadow-xl shadow-glow hover:shadow-2xl transition-all"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 blur-3xl rounded-full pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-white font-bold text-[15px]" style={display}>Create & manage smart links</h4>
                <p className="text-white/85 text-xs mt-0.5">{links.length} link{links.length === 1 ? "" : "s"} · {activeLinks} active</p>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 bg-white text-primary px-4 py-2 rounded-lg font-bold text-xs group-hover:scale-105 transition-transform">
                Open Links <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* LIFETIME DATA NOTE */}
            <Panel className="p-5">
              <h4 className="text-base font-bold text-foreground" style={display}>Lifetime data is safe</h4>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Raw per-click logs are trimmed weekly so the platform stays fast at any scale, but your
                lifetime click totals, country stats and earnings are archived permanently — no weekly reset,
                no lost balance.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/60 border border-border p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-bold">Lifetime visits</div>
                  <div className="text-xl font-extrabold tabular-nums mt-1">{fmtCompact(totalClicks)}</div>
                </div>
                <div className="rounded-xl bg-muted/60 border border-border p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-bold">Bots filtered</div>
                  <div className="text-xl font-extrabold tabular-nums mt-1">{fmtCompact(botBlocked)}</div>
                </div>
              </div>
            </Panel>
          </div>

          {/* RIGHT COLUMN: payout progress + region */}
          <div className="space-y-5">
            {/* Payout progress — $1 per 50,000 verified human visits */}
            <Panel className="p-6">
              <h4 className="text-base font-bold text-foreground" style={display}>Payout progress</h4>
              <p className="text-xs text-muted-foreground mt-1">$1 for every 50,000 verified human visits.</p>
              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Verified visits</span>
                <span className="font-bold text-foreground tabular-nums">{fmtCompact(totalClicks)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Estimated earnings</span>
                <span className="font-bold text-foreground tabular-nums">${payoutEarned.toFixed(2)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Next $1 milestone</span>
                <span className="font-bold text-foreground tabular-nums">{fmtCompact(payoutRemaining)} visits left</span>
              </div>
              <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary-gradient shadow-glow" style={{ width: `${payoutPct}%` }} />
              </div>
            </Panel>


            {/* Traffic by Region + Mobile Gauge */}
            <Panel className="p-6">
              <h4 className="text-base font-bold text-foreground" style={display}>Traffic by Region</h4>
              <div className="mt-4 space-y-3">
                {regionRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No traffic yet.</p>
                ) : (
                  regionRows.map((r) => <RegionRow key={r.name} color={r.color} name={r.name} pct={r.pct} />)
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-border flex flex-col items-center">
                <MobileGauge pct={mobilePct} />
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" /> Mobile Traffic
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
  return (
    <div className={"rounded-2xl glass-card " + className}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "up" | "muted" }) {
  return (
    <div className="rounded-2xl glass-card p-4 hover:-translate-y-0.5 hover:shadow-glow transition-all">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="text-2xl lg:text-3xl font-extrabold text-foreground mt-2 tabular-nums" style={display}>{value}</div>
      <div className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${tone === "up" ? "text-emerald-600" : "text-primary"}`}>
        {tone === "up" && <TrendingUp className="w-3 h-3" />}
        {sub}
      </div>
    </div>
  );
}

function BarSparkChart({ vals, peakIdx, troughIdx, labels }: { vals: number[]; peakIdx: number; troughIdx: number; labels: string[] }) {
  const max = Math.max(1, ...vals);
  const sw = 800, sh = 70;
  const pts = vals.length > 1
    ? vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * sw;
        const y = sh - (v / max) * (sh - 12) - 6;
        return [x, y] as const;
      })
    : [[0, sh / 2], [sw, sh / 2]] as const;
  const path = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const peak = pts[Math.min(peakIdx, pts.length - 1)];
  const trough = pts[Math.min(troughIdx, pts.length - 1)];
  const fmtLabel = (k: string) => {
    if (!k) return "";
    const d = new Date(k);
    if (isNaN(d.getTime())) return k.slice(-5);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return (
    <div className="space-y-4">
      {/* Sparkline strip with floating peak/trough indicators */}
      <div className="relative w-full" style={{ height: 80 }}>
        <svg viewBox={`0 0 ${sw} ${sh}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="dashSpark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="primary-glow" />
              <stop offset="100%" stopColor="primary" />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke="url(#dashSpark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 2px 6px rgba(255,126,95,0.35))" }} />
          {/* Peak indicator */}
          <g>
            <circle cx={peak[0]} cy={peak[1]} r="5" fill="primary" stroke="white" strokeWidth="2"
                    style={{ filter: "drop-shadow(0 0 8px rgba(255,126,95,0.6))" }} />
          </g>
          {/* Trough indicator (subtle) */}
          {vals.length > 1 && peakIdx !== troughIdx && (
            <circle cx={trough[0]} cy={trough[1]} r="3.5" fill="white" stroke="primary" strokeWidth="2" />
          )}
        </svg>
        {/* Floating peak label */}
        <div className="absolute pointer-events-none -translate-x-1/2 -translate-y-full"
             style={{ left: `${(peak[0] / sw) * 100}%`, top: `${(peak[1] / sh) * 100}%`, marginTop: -6 }}>
          <div className="bg-foreground text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap" style={display}>
            {fmtCompact(vals[peakIdx] ?? 0)}
            <span className="block text-[8px] font-normal text-white/60 leading-none mt-0.5">{fmtLabel(labels[peakIdx] ?? "")}</span>
          </div>
        </div>
      </div>

      {/* Bar distribution with hover */}
      <div className="flex items-end gap-[3px] h-28">
        {vals.map((v, i) => {
          const isPeak = i === peakIdx;
          const pct = (v / max) * 100;
          return (
            <div key={i} className="group relative flex-1 flex items-end h-full">
              <div
                className={`w-full rounded-t-md transition-all duration-300 cursor-pointer ${isPeak ? "bg-primary shadow-[0_4px_14px_rgba(255,126,95,0.5)]" : "bg-border hover:bg-primary hover:shadow-[0_6px_18px_rgba(255,126,95,0.55)] hover:scale-y-105 origin-bottom"}`}
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-foreground text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap" style={display}>
                  {fmtCompact(v)}
                  <span className="block text-[8px] font-normal text-white/60 leading-none mt-0.5">{fmtLabel(labels[i] ?? "")}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels (sparse) */}
      <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
        {labels.length > 0 && (
          <>
            <span>{fmtLabel(labels[0])}</span>
            {labels.length > 6 && <span>{fmtLabel(labels[Math.floor(labels.length / 2)])}</span>}
            <span className="text-primary">{fmtLabel(labels[labels.length - 1])}</span>
          </>
        )}
      </div>
    </div>
  );
}

function MiniSpark({ up }: { up: boolean }) {
  const w = 80, h = 28;
  const pts = up
    ? [[0, 20], [15, 18], [30, 14], [45, 16], [60, 10], [80, 6]]
    : [[0, 10], [15, 14], [30, 12], [45, 18], [60, 16], [80, 22]];
  const path = "M" + pts.map(([x, y]) => `${x},${y}`).join(" L");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <path d={path} fill="none" stroke={up ? "oklch(0.62 0.16 158)" : "var(--primary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RegionRow({ color, name, pct }: { color: string; name: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-sm text-foreground flex-1">{name}</span>
      <span className="text-sm font-bold text-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

function MobileGauge({ pct }: { pct: number }) {
  const size = 120, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="border" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#mg)" strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
                style={{ filter: "drop-shadow(0 0 6px rgba(255,126,95,0.5))" }} />
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="primary" />
            <stop offset="100%" stopColor="primary-glow" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-muted-foreground font-semibold">Mobile</span>
        <span className="text-2xl font-extrabold text-foreground tabular-nums" style={display}>{pct}%</span>
      </div>
    </div>
  );
}

const fieldCls = "w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-card transition-all";

function Field({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

