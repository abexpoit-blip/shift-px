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
} from "lucide-react";

import { getLeaderboard } from "@/lib/earnings.functions";
import { demoLeaderboard, currentSlot, LEADERBOARD_SLOT_MS } from "@/lib/leaderboard-demo";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Adspx" },
      {
        name: "description",
        content: "See the top Adspx earners of the last 30 days, ranked by verified human traffic.",
      },
      { property: "og:title", content: "Leaderboard — Adspx" },
      { property: "og:description", content: "Top Adspx earners of the last 30 days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toLocaleString();
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[380px] h-[380px] -top-28 left-1/4" />
        <span className="orb orb-pink w-[320px] h-[320px] top-56 -right-20" />
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 py-8 max-w-4xl space-y-6">
        {/* HEADER */}
        <header className="anim-rise text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            <Flame className="h-3.5 w-3.5" /> Global rankings
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Publisher <span className="text-gradient">Leaderboard</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Top earners over the last 30 days{yourRank ? ` · your rank: #${yourRank}` : ""}.
          </p>
          <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-primary" /> Next shuffle in{" "}
            <span className="font-bold tabular-nums text-foreground">{countdown}</span>
          </p>
        </header>

        {/* SUMMARY STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryCard
            className="anim-rise d-1"
            icon={Users}
            label="Ranked publishers"
            value={String(rows.length)}
          />
          <SummaryCard
            className="anim-rise d-2"
            icon={Sparkles}
            label="Verified visits"
            value={fmt(totalVisits)}
          />
          <SummaryCard
            className="anim-rise d-3 col-span-2 sm:col-span-1"
            icon={Coins}
            label="Board earnings"
            value={`$${totalPaid.toFixed(2)}`}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* PODIUM */}
            {podium.length === 3 && (
              <section className="anim-rise d-2 grid grid-cols-3 gap-3 items-end">
                <PodiumCard row={podium[1]} place={2} />
                <PodiumCard row={podium[0]} place={1} />
                <PodiumCard row={podium[2]} place={3} />
              </section>
            )}

            {/* TABLE */}
            <section className="anim-rise d-3 rounded-2xl glass-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" /> Full ranking
                </h2>
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Top {rows.length}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {rest.map((e, i) => (
                  <li
                    key={`${e.rank}-${e.name}`}
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                    className={`anim-fade flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-colors hover:bg-primary/5 ${
                      e.isYou ? "bg-primary/8 ring-1 ring-inset ring-primary/25" : ""
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-card/70 text-xs font-extrabold tabular-nums text-muted-foreground">
                      {e.rank}
                    </span>
                    <RankDelta rank={e.rank} prevRank={e.prevRank} />
                    <Avatar name={e.name} country={e.country} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm truncate ${e.isYou ? "font-bold text-primary" : "font-semibold"}`}
                      >
                        {e.name}
                        {e.isYou && (
                          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                            you
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 w-24 sm:w-40 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bar-fill"
                            style={{
                              width: `${Math.max(6, (e.humanClicks / (rows[0]?.humanClicks || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                          {fmt(e.humanClicks)} visits
                        </span>
                      </div>
                    </div>
                    <span className="rounded-lg bg-primary/8 px-2 py-1 text-sm font-extrabold tabular-nums text-foreground">
                      ${e.earnings.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* STICKY YOUR POSITION */}
        <div className="sticky bottom-3 z-20">
          <div className="rounded-2xl border border-primary/35 bg-card/85 backdrop-blur-xl shadow-xl shadow-glow px-4 py-3 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-gradient text-white text-xs font-extrabold shadow-glow">
              {you ? `#${you.rank}` : "—"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Your position
              </div>
              {you ? (
                <div className="mt-0.5 flex items-center gap-2 text-sm font-bold truncate">
                  {you.name}
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                    {fmt(you.humanClicks)} visits
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Not ranked yet — bring verified human visits to enter the board.
                </div>
              )}
            </div>
            {you && <RankDelta rank={you.rank} prevRank={you.prevRank} />}
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-extrabold tabular-nums text-primary">
              ${(you?.earnings ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Ranking is based on verified human visits only — bot traffic never counts. Earnings shown
          at the standard rate of $1 per 50,000 verified visits.
        </p>
      </div>
    </main>
  );
}

/* ───────────────── components ───────────────── */

function SummaryCard({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: any;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl glass-card p-4 ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-extrabold tabular-nums">{value}</div>
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
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-gradient text-white text-xs font-extrabold shadow-glow">
        {initial}
      </span>
      {country && (
        <img
          src={`https://flagcdn.com/${country}.svg`}
          alt={country.toUpperCase()}
          loading="lazy"
          className="absolute -bottom-1 -right-1 h-3.5 w-5 rounded-[3px] border border-card object-cover shadow"
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
        up ? "rank-up bg-emerald-500/12 text-emerald-600" : "rank-down bg-rose-500/12 text-rose-600"
      }`}
    >
      {up ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      {diff}
    </span>
  );
}

const PLACE_STYLE: Record<number, { ring: string; badge: string; medal: string; h: string }> = {
  1: {
    ring: "ring-2 ring-amber-400/70",
    badge: "from-amber-400 to-amber-600 text-white",
    medal: "text-amber-500",
    h: "pt-7 pb-8",
  },
  2: {
    ring: "ring-1 ring-slate-400/60",
    badge: "from-slate-400 to-slate-600 text-white",
    medal: "text-slate-500",
    h: "pt-5 pb-5",
  },
  3: {
    ring: "ring-1 ring-orange-700/50",
    badge: "from-orange-600 to-amber-800 text-white",
    medal: "text-orange-700",
    h: "pt-5 pb-5",
  },
};

function PodiumCard({ row, place }: { row: Row; place: 1 | 2 | 3 }) {
  const s = PLACE_STYLE[place];
  return (
    <div
      className={`anim-pop relative rounded-2xl glass-card px-3 ${s.h} text-center ${s.ring} ${
        place === 1 ? "sheen shadow-glow" : ""
      }`}
      style={{ animationDelay: `${place * 70}ms` }}
    >
      {place === 1 && (
        <Crown className="crown-glow absolute -top-4 left-1/2 -translate-x-1/2 h-7 w-7 text-amber-400" />
      )}
      <div className="relative mx-auto w-fit">
        <span
          className={`grid ${place === 1 ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm"} place-items-center rounded-2xl bg-primary-gradient text-white font-extrabold shadow-glow ${
            place === 1 ? "pulse-ring" : ""
          }`}
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
            className="absolute -bottom-1 -right-1 h-4 w-6 rounded-[3px] border border-card object-cover shadow"
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        <Medal className={`h-4 w-4 ${s.medal}`} />
        <span
          className={`inline-block rounded-full bg-gradient-to-r ${s.badge} px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow-sm`}
        >
          #{place}
        </span>
      </div>

      <div className="mt-2 text-[13px] sm:text-sm font-bold truncate text-foreground">
        {row.name}
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground tabular-nums">
        {fmt(row.humanClicks)} visits
      </div>
      <div
        className={`mt-2 inline-block rounded-lg border border-primary/20 bg-primary/8 px-2.5 py-1 font-extrabold tabular-nums ${
          place === 1 ? "text-xl text-primary" : "text-base text-foreground"
        }`}
      >
        ${row.earnings.toFixed(2)}
      </div>
      <div className="mt-2 flex justify-center">
        <RankDelta rank={row.rank} prevRank={row.prevRank} />
      </div>
    </div>
  );
}
