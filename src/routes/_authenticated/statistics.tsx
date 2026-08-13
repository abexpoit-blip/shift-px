import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Users, Bot, Globe2, Loader2 } from "lucide-react";

import { getStatistics } from "@/lib/statistics.functions";

export const Route = createFileRoute("/_authenticated/statistics")({
  head: () => ({
    meta: [
      { title: "Statistics — Adspx" },
      { name: "description", content: "Traffic analytics for your Adspx links: verified human visits, countries and traffic sources over the last 30 days." },
      { property: "og:title", content: "Statistics — Adspx" },
      { property: "og:description", content: "Traffic analytics for your Adspx links over the last 30 days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatisticsPage,
});

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary-glow)"];

function fmt(n: number) {
  return n.toLocaleString();
}

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums">{value}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function StatisticsPage() {
  const statsFn = useServerFn(getStatistics);
  const { data, isLoading } = useQuery({ queryKey: ["statistics"], queryFn: () => statsFn({}) });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const chartData = data.series.map((d) => ({
    ...d,
    label: new Date(`${d.day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl space-y-5 sm:space-y-7">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days of traffic across all your links.</p>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BarChart3} label="Total visits" value={fmt(data.totalClicks)} hint="All recorded visits" />
        <StatCard icon={Users} label="Verified humans" value={fmt(data.humanClicks)} hint="Counted for earnings" />
        <StatCard icon={Bot} label="Crawler previews" value={fmt(data.botClicks)} hint="Filtered, not paid" />
        <StatCard icon={Globe2} label="Countries" value={fmt(data.countriesSeen)} hint="Unique visitor regions" />
      </section>

      <section className="rounded-2xl glass-card p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Daily traffic</h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gHumans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gBots" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="humans" name="Humans" stroke="#6366f1" fill="url(#gHumans)" strokeWidth={2} />
              <Area type="monotone" dataKey="bots" name="Crawlers" stroke="#94a3b8" fill="url(#gBots)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl glass-card p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Top countries</h2>
          {data.countries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No country data yet.</p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.countries.slice(0, 8).map((c) => ({ ...c, code: c.code.toUpperCase() }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="code" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="humans" name="Humans" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl glass-card p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Traffic sources</h2>
          {data.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No source data yet.</p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.sources} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {data.sources.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-2">
            {data.sources.map((s, i) => (
              <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl glass-card p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Top links</h2>
        {data.topLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.topLinks.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{l.title || l.short_code}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">/{l.short_code}</div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{fmt(l.clicks)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
