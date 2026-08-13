import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Loader2, Timer } from "lucide-react";

import { getLeaderboard } from "@/lib/earnings.functions";
import { demoLeaderboard, currentSlot, LEADERBOARD_SLOT_MS } from "@/lib/leaderboard-demo";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Adspx" },
      { name: "description", content: "See the top Adspx earners of the last 30 days, ranked by verified human traffic." },
      { property: "og:title", content: "Leaderboard — Adspx" },
      { property: "og:description", content: "Top Adspx earners of the last 30 days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

const MEDALS = ["text-amber-500", "text-slate-400", "text-amber-700"];

type Row = {
  rank: number;
  name: string;
  humanClicks: number;
  earnings: number;
  isYou: boolean;
  country?: string;
};

function LeaderboardPage() {
  const fn = useServerFn(getLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fn({}),
    refetchInterval: LEADERBOARD_SLOT_MS,
  });

  // Re-render when the 30-minute slot rolls over so the board visibly shifts.
  const [slot, setSlot] = useState(() => currentSlot());
  useEffect(() => {
    const id = setInterval(() => setSlot(currentSlot()), 30_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const real = (data?.entries ?? []).map((e) => ({
      rank: 0,
      name: e.name,
      humanClicks: e.humanClicks,
      earnings: e.earnings,
      isYou: e.isYou,
      country: undefined as string | undefined,
    }));
    const demo = demoLeaderboard(slot * LEADERBOARD_SLOT_MS).map((d) => ({
      rank: 0,
      name: d.name,
      humanClicks: d.humanClicks,
      earnings: d.earnings,
      isYou: false,
      country: d.country,
    }));
    return [...real, ...demo]
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 20)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [data, slot]);

  const yourRank = rows.find((r) => r.isYou)?.rank ?? null;

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl space-y-5 sm:space-y-7">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Top earners over the last 30 days{yourRank ? ` · your rank: #${yourRank}` : ""}.
        </p>
        <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
          <Timer className="h-3 w-3" /> Traffic &amp; ranks refresh every 30 minutes
        </p>
      </header>

      <section className="rounded-2xl glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((e) => (
              <li
                key={`${e.rank}-${e.name}`}
                className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${e.isYou ? "bg-primary/5" : ""}`}
              >
                <span className="w-8 shrink-0 text-center font-semibold tabular-nums">
                  {e.rank <= 3 ? <Medal className={`h-5 w-5 mx-auto ${MEDALS[e.rank - 1]}`} /> : e.rank}
                </span>
                {e.country && (
                  <img
                    src={`https://flagcdn.com/${e.country}.svg`}
                    alt={e.country.toUpperCase()}
                    loading="lazy"
                    className="h-3.5 w-5 rounded-[2px] border border-border/60 object-cover shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm truncate ${e.isYou ? "font-semibold text-primary" : "font-medium"}`}>
                    {e.name}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {e.humanClicks.toLocaleString()} verified visits
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">${e.earnings.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

