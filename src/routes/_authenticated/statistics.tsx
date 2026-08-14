import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Users,
  Bot,
  Globe2,
  Loader2,
  Activity,
  Share2,
  Link2,
  TrendingUp,
  Smartphone,
  Monitor,
  Tablet,
  Chrome,
  Coins,
  ChevronRight,
  X,
} from "lucide-react";

import { getStatistics, getLinkStats } from "@/lib/statistics.functions";

export const Route = createFileRoute("/_authenticated/statistics")({
  head: () => ({
    meta: [
      { title: "Statistics — Adspx" },
      {
        name: "description",
        content:
          "Traffic analytics for your Adspx links: verified human visits, countries and traffic sources over the last 30 days.",
      },
      { property: "og:title", content: "Statistics — Adspx" },
      {
        property: "og:description",
        content: "Traffic analytics for your Adspx links over the last 30 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatisticsPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function fmt(n: number) {
  return (n ?? 0).toLocaleString();
}
function fmtCompact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return Math.round(n).toLocaleString();
}

function useCountUp(target: number, ms = 900) {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(a + (target - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

const ACCENTS: Record<string, string> = {
  indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-600",
  violet: "from-violet-500/15 to-violet-500/0 text-violet-600",
  pink: "from-pink-500/15 to-pink-500/0 text-pink-600",
  emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-600",
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "indigo",
  className = "",
}: {
  icon: any;
  label: string;
  value: number;
  hint?: string;
  accent?: keyof typeof ACCENTS;
  className?: string;
}) {
  const v = useCountUp(value);
  return (
    <div className={`group relative overflow-hidden rounded-2xl glass-card p-4 ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none ${ACCENTS[accent]}`}
      />
      <div className="relative flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span
          className={`grid h-8 w-8 place-items-center rounded-xl border border-border bg-card/80 shadow-sm ${ACCENTS[
            accent
          ]
            .split(" ")
            .pop()} group-hover:scale-110 transition-transform`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div
        className="relative mt-2 text-2xl lg:text-3xl font-extrabold tabular-nums"
        style={display}
      >
        {fmtCompact(v)}
      </div>
      {hint && (
        <div className="relative mt-1 text-[11px] font-semibold text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl glass-card ${className}`}>{children}</section>;
}

/** Premium stacked column chart: humans + bots per day with hover tooltip. */
function TrafficChart({
  series,
}: {
  series: Array<{ day: string; humans: number; bots: number }>;
}) {
  const max = Math.max(1, ...series.map((d) => d.humans + d.bots));
  const [hover, setHover] = useState<number | null>(null);
  const label = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none">
        {[1, 0.75, 0.5, 0.25, 0].map((g) => (
          <div key={g} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right text-[10px] font-bold text-muted-foreground/70 tabular-nums">
              {fmtCompact(max * g)}
            </span>
            <span className="h-px flex-1 bg-border/70" style={{ backgroundImage: "none" }} />
          </div>
        ))}
      </div>

      <div className="relative pl-12">
        <div className="flex items-end gap-[3px] h-[240px]">
          {series.map((d, i) => {
            const total = d.humans + d.bots;
            const h = (total / max) * 100;
            const hp = total > 0 ? (d.humans / total) * 100 : 0;
            const active = hover === i;
            return (
              <div
                key={d.day}
                className="group relative flex-1 h-full flex items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full rounded-t-md overflow-hidden flex flex-col justify-end transition-all duration-300 ${
                    active ? "shadow-glow" : ""
                  }`}
                  style={{ height: `${Math.max(3, h)}%` }}
                >
                  <div
                    className="w-full bg-muted-foreground/25"
                    style={{ height: `${100 - hp}%` }}
                  />
                  <div className="w-full bg-primary-gradient" style={{ height: `${hp}%` }} />
                </div>
                {active && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10">
                    <div
                      className="rounded-lg bg-foreground text-background px-2.5 py-1.5 text-[10px] font-bold shadow-lg whitespace-nowrap"
                      style={display}
                    >
                      {label(d.day)}
                      <span className="block font-semibold opacity-90">{fmt(d.humans)} humans</span>
                      <span className="block font-normal opacity-70">{fmt(d.bots)} bots</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>{series.length ? label(series[0].day) : ""}</span>
          <span>{series.length > 6 ? label(series[Math.floor(series.length / 2)].day) : ""}</span>
          <span className="text-primary">
            {series.length ? label(series[series.length - 1].day) : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function Donut({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const tones = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--primary-glow)",
  ];
  let acc = 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="16" />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = `${frac * c} ${c}`;
            const offset = -acc * c;
            acc += frac;
            return (
              <circle
                key={d.name}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={tones[i % tones.length]}
                strokeWidth="16"
                strokeDasharray={dash}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dasharray .8s ease" }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-lg font-extrabold tabular-nums" style={display}>
              {fmtCompact(total)}
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
              visits
            </div>
          </div>
        </div>
      </div>
      <ul className="flex-1 min-w-[160px] space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: tones[i % tones.length] }}
            />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="font-bold tabular-nums text-xs">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HBar({
  rows,
  icons,
}: {
  rows: Array<{ name: string; value: number }>;
  icons?: Record<string, any>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s2, r) => s2 + r.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const Icon = icons?.[r.name] ?? icons?.["_"] ?? null;
        return (
          <li key={r.name} className="flex items-center gap-3">
            {Icon && (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-card/70 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="w-24 shrink-0 truncate text-xs font-bold">{r.name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary-gradient transition-[width] duration-700"
                style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
              />
            </div>
            <span className="w-12 text-right text-xs font-bold tabular-nums text-muted-foreground">
              {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const DEVICE_ICONS: Record<string, any> = {
  Mobile: Smartphone,
  Desktop: Monitor,
  Tablet: Tablet,
  _: Smartphone,
};

/** Drill-down panel for one link. */
function LinkDrilldown({ linkId, onClose }: { linkId: string; onClose: () => void }) {
  const fn = useServerFn(getLinkStats);
  const { data, isLoading } = useQuery({
    queryKey: ["link-stats", linkId],
    queryFn: () => fn({ data: { linkId } }),
  });

  return (
    <Panel className="p-5 sm:p-6 anim-rise">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" /> Link drill-down
          </p>
          <h3 className="mt-1 text-lg font-extrabold truncate">
            {data ? data.title || `/${data.shortCode}` : "Loading…"}
          </h3>
          {data && <p className="font-mono text-xs text-muted-foreground">/{data.shortCode}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close drill-down"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card/70 text-muted-foreground hover:text-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl surface-soft p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Humans · 30d
              </div>
              <div className="mt-1 text-xl font-extrabold tabular-nums">
                {fmtCompact(data.totals.humans)}
              </div>
            </div>
            <div className="rounded-xl surface-soft p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Bots filtered
              </div>
              <div className="mt-1 text-xl font-extrabold tabular-nums">
                {fmtCompact(data.totals.bots)}
              </div>
            </div>
            <div className="rounded-xl surface-soft p-3 col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Earned
              </div>
              <div className="mt-1 text-xl font-extrabold tabular-nums text-primary">
                ${(data.totals.humans / 50000).toFixed(2)}
              </div>
            </div>
          </div>

          <TrafficChart series={data.series} />

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Top countries
              </h4>
              {data.countries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <HBar
                  rows={data.countries.map((c) => ({ name: c.code.toUpperCase(), value: c.total }))}
                />
              )}
            </div>
            <div>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Devices
              </h4>
              {data.devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <HBar rows={data.devices} icons={DEVICE_ICONS} />
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function StatisticsPage() {
  const statsFn = useServerFn(getStatistics);
  const { data, isLoading } = useQuery({ queryKey: ["statistics"], queryFn: () => statsFn({}) });

  const [openLink, setOpenLink] = useState<string | null>(null);

  const forecast = useMemo(() => {
    const series = data?.series ?? [];
    const last7 = series.slice(-7);
    const avg = last7.length ? last7.reduce((s2, d) => s2 + d.humans, 0) / last7.length : 0;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate();
    const monthSoFar = series
      .filter((d) => d.day.slice(0, 7) === now.toISOString().slice(0, 7))
      .reduce((s2, d) => s2 + d.humans, 0);
    const projectedVisits = monthSoFar + avg * daysLeft;
    return {
      avg,
      daysLeft,
      monthSoFar,
      projectedVisits,
      earnedSoFar: monthSoFar / 50000,
      projectedEarnings: projectedVisits / 50000,
    };
  }, [data]);

  const humanShare = useMemo(() => {
    if (!data || data.totalClicks === 0) return 0;
    return Math.round((data.humanClicks / data.totalClicks) * 100);
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const maxCountry = Math.max(1, ...data.countries.map((c) => c.total));

  return (
    <main className="relative min-h-screen text-foreground" style={display}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[420px] h-[420px] -top-32 -left-24" />
        <span className="orb orb-pink w-[340px] h-[340px] top-48 -right-24" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="anim-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            <Activity className="h-3.5 w-3.5" /> Last 30 days
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Traffic <span className="text-gradient">statistics</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Verified human visits, bot filtering, countries and traffic sources across all your
            links.
          </p>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            className="anim-rise d-1"
            icon={BarChart3}
            label="Total visits"
            value={data.totalClicks}
            hint="All recorded traffic"
            accent="indigo"
          />
          <StatCard
            className="anim-rise d-2"
            icon={Users}
            label="Verified humans"
            value={data.humanClicks}
            hint={`${humanShare}% of traffic · counted for earnings`}
            accent="violet"
          />
          <StatCard
            className="anim-rise d-3"
            icon={Bot}
            label="Bots filtered"
            value={data.botClicks}
            hint="Blocked, never paid"
            accent="emerald"
          />
          <StatCard
            className="anim-rise d-4"
            icon={Globe2}
            label="Countries"
            value={data.countriesSeen}
            hint="Unique visitor regions"
            accent="pink"
          />
        </section>

        <Panel className="p-5 sm:p-6 anim-rise d-2">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Daily traffic
              </p>
              <div className="mt-1 text-3xl font-extrabold tabular-nums">
                {fmtCompact(data.totalClicks)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Humans and bots, day by day</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary-gradient" /> Humans
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/30" /> Bots
              </span>
            </div>
          </div>
          <TrafficChart series={data.series} />
        </Panel>

        <div className="grid lg:grid-cols-2 gap-5">
          <Panel className="p-5 sm:p-6 anim-rise d-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2 mb-4">
              <Globe2 className="h-4 w-4 text-primary" /> Top countries
            </h2>
            {data.countries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No country data yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.countries.slice(0, 8).map((c) => (
                  <li key={c.code} className="flex items-center gap-3">
                    <img
                      src={`https://flagcdn.com/${c.code}.svg`}
                      alt={c.code.toUpperCase()}
                      loading="lazy"
                      className="h-4 w-6 rounded-[3px] border border-border object-cover shrink-0"
                    />
                    <span className="w-8 text-xs font-bold uppercase text-muted-foreground">
                      {c.code}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-gradient transition-[width] duration-700"
                        style={{ width: `${Math.max(4, (c.total / maxCountry) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-16 text-right">
                      {fmtCompact(c.humans)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-5 sm:p-6 anim-rise d-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2 mb-4">
              <Share2 className="h-4 w-4 text-primary" /> Traffic sources
            </h2>
            {data.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source data yet.</p>
            ) : (
              <Donut data={data.sources} />
            )}
          </Panel>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <Panel className="p-5 sm:p-6 anim-rise d-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2 mb-4">
              <Smartphone className="h-4 w-4 text-primary" /> Devices
            </h2>
            {data.devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No device data yet.</p>
            ) : (
              <HBar rows={data.devices} icons={DEVICE_ICONS} />
            )}
          </Panel>

          <Panel className="p-5 sm:p-6 anim-rise d-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2 mb-4">
              <Chrome className="h-4 w-4 text-primary" /> Browsers
            </h2>
            {data.browsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No browser data yet.</p>
            ) : (
              <HBar rows={data.browsers} />
            )}
          </Panel>

          <Panel className="relative overflow-hidden p-5 sm:p-6 anim-rise d-4 border-primary/25">
            <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
            <h2 className="relative text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2 mb-4">
              <Coins className="h-4 w-4 text-primary" /> Earnings forecast
            </h2>
            <div className="relative">
              <div className="text-3xl font-extrabold tabular-nums text-primary">
                ${forecast.projectedEarnings.toFixed(2)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Projected month-end at your current pace ({fmtCompact(forecast.avg)} humans/day).
              </p>
              <div className="mt-4 h-2 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-gradient transition-[width] duration-700"
                  style={{
                    width: `${Math.min(100, forecast.projectedEarnings > 0 ? (forecast.earnedSoFar / forecast.projectedEarnings) * 100 : 0)}%`,
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Earned so far
                  </div>
                  <div className="text-base font-extrabold tabular-nums">
                    ${forecast.earnedSoFar.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Days left
                  </div>
                  <div className="text-base font-extrabold tabular-nums">{forecast.daysLeft}</div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {openLink && <LinkDrilldown linkId={openLink} onClose={() => setOpenLink(null)} />}

        <Panel className="p-5 sm:p-6 anim-rise d-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2 mb-4">
            <Link2 className="h-4 w-4 text-primary" /> Top links
            <span className="ml-auto text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/80">
              Click a link for drill-down
            </span>
          </h2>
          {data.topLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.topLinks.map((l, i) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setOpenLink(openLink === l.id ? null : l.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-primary/5 ${
                      openLink === l.id ? "bg-primary/8" : ""
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-card/70 text-[11px] font-extrabold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {l.title || l.short_code}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        /{l.short_code}
                      </div>
                    </div>
                    <span className="text-sm font-extrabold tabular-nums">{fmt(l.clicks)}</span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        openLink === l.id ? "rotate-90 text-primary" : ""
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </main>
  );
}
