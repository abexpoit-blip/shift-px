import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Loader2 } from "lucide-react";

import { getLeaderboard } from "@/lib/earnings.functions";

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

function LeaderboardPage() {
  const fn = useServerFn(getLeaderboard);
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard"], queryFn: () => fn({}) });

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl space-y-5 sm:space-y-7">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Top earners over the last 30 days{data?.yourRank ? ` · your rank: #${data.yourRank}` : ""}.
        </p>
      </header>

      <section className="rounded-2xl glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (data?.entries.length ?? 0) === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No earnings recorded yet — be the first on the board.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data!.entries.map((e) => (
              <li
                key={e.rank}
                className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${e.isYou ? "bg-primary/5" : ""}`}
              >
                <span className="w-8 shrink-0 text-center font-semibold tabular-nums">
                  {e.rank <= 3 ? <Medal className={`h-5 w-5 mx-auto ${MEDALS[e.rank - 1]}`} /> : e.rank}
                </span>
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
