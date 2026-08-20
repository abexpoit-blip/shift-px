import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Crown,
  Medal,
  Loader2,
  Timer,
  Flame,
  ChevronUp,
  ChevronDown,
  Minus,
  Users,
  Coins,
  Sparkles,
  Zap,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { getLeaderboard } from "@/lib/earnings.functions";
import { demoLeaderboard, currentSlot, LEADERBOARD_SLOT_MS } from "@/lib/leaderboard-demo";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Publisher Leaderboard — AdsPx" },
      {
        name: "description",
        content: "Top AdsPx publishers and traffic earners of the last 30 days.",
      },
    ],
  }),
  component: LeaderboardPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

type Row = {
  rank: number;
  prevRank: number | null;
  name: string;
  humanClicks: number;
  earnings: number;
  isYou: boolean;
  country?: string;
};

function fmt(n: number | null | undefined) {
  const num = Number(n ?? 0);
  if (Number.isNaN(num) || !Number.isFinite(num)) return "0";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "k";
  return num.toLocaleString();
}

function useCountdown(slot: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, (slot + 1) * LEADERBOARD_SLOT_MS - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [slot]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LeaderboardPage() {
  const fn = useServerFn(getLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fn({}),
    refetchInterval: LEADERBOARD_SLOT_MS,
  });

  const [slot, setSlot] = useState(() => currentSlot());
  useEffect(() => {
    const id = setInterval(() => setSlot(currentSlot()), 15_000);
    return () => clearInterval(id);
  }, []);
  const countdown = useCountdown(slot);

  const rows = useMemo<Row[]>(() => {
    const build = (s: number) => {
      const real = (data?.entries ?? []).map((e) => ({
        name: e.name,
        humanClicks: e.humanClicks,
        earnings: e.earnings,
        isYou: e.isYou,
        country: undefined as string | undefined,
      }));
      const demo = demoLeaderboard(s * LEADERBOARD_SLOT_MS).map((d) => ({
        name: d.name,
        humanClicks: d.humanClicks,
        earnings: d.earnings,
        isYou: false,
        country: d.country as string | undefined,
      }));
      return [...real, ...demo].sort((a, b) => b.earnings - a.earnings);
    };

    const prev = build(slot - 1);
    const prevRankOf = new Map(prev.map((r, i) => [r.name, i + 1]));

    return build(slot)
      .slice(0, 20)
      .map((r, i) => ({ ...r, rank: i + 1, prevRank: prevRankOf.get(r.name) ?? null }));
  }, [data, slot]);

  const you = rows.find((r) => r.isYou) ?? null;
  const yourRank = you?.rank ?? null;
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const totalVisits = rows.reduce((s, r) => s + r.humanClicks, 0);
  const totalPaid = rows.reduce((s, r) => s + r.earnings, 0);

  return (
    <main className="relative min-h-screen" style={display}>
      {/* Background ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[420px] h-[420px] -top-28 left-1/4 opacity-25" />
        <span className="orb orb-pink w-[380px] h-[380px] top-56 -right-20 opacity-20" />
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 py-8 max-w-4xl space-y-7">
        {/* HEADER */}
        <header className="anim-rise text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <Flame className="h-3.5 w-3.5 text-cyan-400 animate-pulse" /> Live Global Rankings
          </span>
          <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">
            Top Publisher <span className="text-gradient">Leaderboard</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-lg mx-auto">
            Top verified publishers over the last 30 days{yourRank ? ` · your position: #${yourRank}` : ""}.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-card/70 border border-border/70 px-3 py-1.5 backdrop-blur-md shadow-sm">
            <Timer className="h-4 w-4 text-primary animate-spin" style={{ animationDuration: "12s" }} />
            <span className="text-xs text-muted-foreground">Next leaderboard shuffle in</span>
            <span className="text-xs font-extrabold tabular-nums text-foreground">{countdown}</span>
          </div>
        </header>

        {/* SUMMARY METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <SummaryCard
            className="anim-rise d-1"
            icon={Users}
            label="Active Publishers"
            value={String(rows.length)}
            gradient="from-blue-500/15 to-indigo-500/15"
            glow="rgba(59, 130, 246, 0.3)"
          />
          <SummaryCard
            className="anim-rise d-2"
            icon={Zap}
            label="Verified Visits"
            value={fmt(totalVisits)}
            gradient="from-cyan-500/15 to-teal-500/15"
            glow="rgba(6, 182, 212, 0.3)"
          />
          <SummaryCard
            className="anim-rise d-3 col-span-2 sm:col-span-1"
            icon={Coins}
            label="Total Payouts"
            value={`$${totalPaid.toFixed(2)}`}
            gradient="from-fuchsia-500/15 to-pink-500/15"
            glow="rgba(217, 70, 239, 0.3)"
          />
        </div>

        {/* User Live Rank Highlight Banner */}
  {data?.userSummary && (
    <div className="rounded-3xl border-2 border-cyan-500/40 bg-gradient-to-r from-cyan-500/15 via-indigo-500/10 to-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-black text-lg text-cyan-400">
          #100+
        </div>
        <div>
          <div className="font-black text-base text-foreground flex items-center gap-2">
            Your Publisher Position <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">Active</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Verified visits: <strong className="text-foreground">{data.userSummary.humanClicks.toLocaleString()}</strong> · Earned: <strong className="text-emerald-400">${data.userSummary.earnings.toFixed(4)} USD</strong>
          </p>
        </div>
      </div>
      <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
        Rank updates in realtime
      </span>
    </div>
  )}

  {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-semibold">Calculating live publisher rankings...</span>
          </div>
        ) : (
          <>
            {/* 3D PODIUM */}
            {podium.length === 3 && (
              <section className="anim-rise d-2 grid grid-cols-3 gap-3 sm:gap-4 items-end pt-4">
                <PodiumCard row={podium[1]} place={2} />
                <PodiumCard row={podium[0]} place={1} />
                <PodiumCard row={podium[2]} place={3} />
              </section>
            )}

            {/* FULL RANKING TABLE */}
            <section className="anim-rise d-3 rounded-2xl glass-card overflow-hidden border border-border/80 shadow-elegant">
              <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-card/40 backdrop-blur-md">
                <h2 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
                  <Trophy className="h-4 w-4 text-primary" /> Full Standings
                </h2>
                <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Top {rows.length} Earners
                </span>
              </div>
              <ul className="divide-y divide-border/60">
                {rest.map((e, i) => (
                  <li
                    key={`${e.rank}-${e.name}`}
                    style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                    className={`anim-fade flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-all hover:bg-primary/5 ${
                      e.isYou ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border/70 bg-card/90 text-xs font-extrabold tabular-nums text-muted-foreground">
                      {e.rank}
                    </span>
                    <RankDelta rank={e.rank} prevRank={e.prevRank} />
                    <Avatar name={e.name} country={e.country} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={`text-sm truncate flex items-center gap-2 ${
                            e.isYou ? "font-extrabold text-primary" : "font-semibold text-foreground"
                          }`}
                        >
                          {e.name}
                          {e.isYou && (
                            <span className="rounded-full bg-primary/20 border border-primary/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">
                              You
                            </span>
                          )}
                        </div>
                        {/* Dynamic Traffic Momentum Badge */}
                        {e.prevRank && e.prevRank > e.rank ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400 animate-pulse">
                            🚀 Surging (+{e.prevRank - e.rank})
                          </span>
                        ) : e.prevRank && e.prevRank < e.rank ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                            🔻 -{e.rank - e.prevRank}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                            ⚡ Steady
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <div className="h-1.5 w-24 sm:w-48 rounded-full bg-border/80 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-500"
                            style={{
                              width: `${Math.max(8, (e.humanClicks / (rows[0]?.humanClicks || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums flex items-center gap-1">
                          <Flame className="h-3 w-3 text-amber-500 animate-pulse" /> {fmt(e.humanClicks)} visits
                        </span>
                      </div>
                    </div>
                    <span className="rounded-xl bg-card border border-border/80 px-3 py-1.5 text-sm font-black tabular-nums text-foreground shadow-sm">
                      ${e.earnings.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* STICKY USER POSITION STRIP */}
        <div className="sticky bottom-4 z-20">
          <div className="rounded-2xl border border-cyan-500/40 bg-card/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] px-4 sm:px-5 py-3.5 flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 text-white text-xs font-black shadow-[0_0_16px_rgba(99,102,241,0.4)]">
              {you ? `#${you.rank}` : "—"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-400">
                Your Live Standing
              </div>
              {you ? (
                <div className="mt-0.5 flex items-center gap-2 text-sm font-extrabold truncate">
                  {you.name}
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                    {fmt(you.humanClicks)} visits
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Send traffic to your short links to enter the global ranking board.
                </div>
              )}
            </div>
            {you && <RankDelta rank={you.rank} prevRank={you.prevRank} />}
            <span className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 text-sm font-black tabular-nums text-cyan-400 shadow-sm">
              ${(you?.earnings ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Ranking strictly tracks verified human visits. Earnings computed at $1 per 100,000 verified human visits.
        </p>
      </div>
    </main>
  );
}

/* ───────────────── COMPONENTS ───────────────── */

function SummaryCard({
  icon: Icon,
  label,
  value,
  gradient,
  glow,
  className = "",
}: {
  icon: any;
  label: string;
  value: string;
  gradient: string;
  glow: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl bg-card border border-border/80 p-4 overflow-hidden backdrop-blur-md shadow-sm ${className}`}
      style={{ boxShadow: `0 4px 20px ${glow}` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative text-[10px] uppercase tracking-[0.18em] font-extrabold text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className="relative mt-2 text-2xl sm:text-3xl font-black tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  );
}

function Avatar({ name, country }: { name: string; country?: string }) {
  const initial =
    name
      .replace(/[^a-z0-9]/gi, "")
      .charAt(0)
      .toUpperCase() || "?";
  return (
    <span className="relative shrink-0">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-black shadow-[0_0_12px_rgba(99,102,241,0.3)]">
        {initial}
      </span>
      {country && (
        <img
          src={`https://flagcdn.com/${country}.svg`}
          alt={country.toUpperCase()}
          loading="lazy"
          className="absolute -bottom-1 -right-1 h-3.5 w-5 rounded-[3px] border border-card object-cover shadow-sm"
        />
      )}
    </span>
  );
}

function RankDelta({ rank, prevRank }: { rank: number; prevRank: number | null }) {
  if (prevRank == null || prevRank === rank) {
    return (
      <span
        title="No change"
        className="w-10 shrink-0 inline-flex items-center justify-center text-[10px] font-bold text-muted-foreground/60"
      >
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const up = prevRank > rank;
  const diff = Math.abs(prevRank - rank);
  return (
    <span
      title={up ? `Up ${diff}` : `Down ${diff}`}
      className={`w-10 shrink-0 inline-flex items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
        up ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
      }`}
    >
      {up ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      {diff}
    </span>
  );
}

const PLACE_STYLE: Record<number, { ring: string; badge: string; medal: string; h: string; glow: string }> = {
  1: {
    ring: "border-amber-400/60 shadow-[0_0_28px_rgba(251,191,36,0.35)]",
    badge: "from-amber-400 to-amber-600 text-slate-950 font-black",
    medal: "text-amber-400",
    h: "pt-8 pb-9",
    glow: "bg-amber-400/10",
  },
  2: {
    ring: "border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]",
    badge: "from-cyan-400 to-blue-600 text-slate-950 font-black",
    medal: "text-cyan-400",
    h: "pt-6 pb-6",
    glow: "bg-cyan-400/10",
  },
  3: {
    ring: "border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.25)]",
    badge: "from-fuchsia-400 to-purple-600 text-slate-950 font-black",
    medal: "text-fuchsia-400",
    h: "pt-6 pb-6",
    glow: "bg-fuchsia-500/10",
  },
};

function PodiumCard({ row, place }: { row: Row; place: 1 | 2 | 3 }) {
  const s = PLACE_STYLE[place];
  return (
    <div
      className={`anim-pop relative rounded-3xl bg-card/90 backdrop-blur-xl px-3 sm:px-4 ${s.h} text-center border ${s.ring} ${s.glow}`}
      style={{ animationDelay: `${place * 70}ms` }}
    >
      {place === 1 && (
        <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 h-8 w-8 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-bounce" style={{ animationDuration: "3s" }} />
      )}
      <div className="relative mx-auto w-fit">
        <span
          className={`grid ${
            place === 1 ? "h-14 w-14 text-xl" : "h-11 w-11 text-base"
          } place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white font-black shadow-[0_0_20px_rgba(99,102,241,0.4)]`}
        >
          {row.name
            .replace(/[^a-z0-9]/gi, "")
            .charAt(0)
            .toUpperCase() || "?"}
        </span>
        {row.country && (
          <img
            src={`https://flagcdn.com/${row.country}.svg`}
            alt={row.country.toUpperCase()}
            loading="lazy"
            className="absolute -bottom-1 -right-1 h-4 w-6 rounded-[3px] border border-card object-cover shadow-md"
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        <Medal className={`h-4 w-4 ${s.medal}`} />
        <span
          className={`inline-block rounded-full bg-gradient-to-r ${s.badge} px-2.5 py-0.5 text-[10px] uppercase tracking-wider shadow-sm`}
        >
          #{place}
        </span>
      </div>

      <div className="mt-2 text-sm font-black truncate text-foreground">
        {row.name}
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground tabular-nums">
        {fmt(row.humanClicks)} visits
      </div>
      <div
        className={`mt-2.5 inline-block rounded-xl border border-primary/30 bg-primary/10 px-3 py-1 font-black tabular-nums ${
          place === 1 ? "text-xl text-primary shadow-[0_0_12px_rgba(99,102,241,0.3)]" : "text-base text-foreground"
        }`}
      >
        ${row.earnings.toFixed(2)}
      </div>
      <div className="mt-2.5 flex justify-center">
        <RankDelta rank={row.rank} prevRank={row.prevRank} />
      </div>
    </div>
  );
}

