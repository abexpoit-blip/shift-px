import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Users, Bot, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { getEarningsOverview } from "@/lib/earnings.functions";

/** Compact free-tier earnings summary shown on top of the dashboard. */
export function EarningsStrip() {
  const fn = useServerFn(getEarningsOverview);
  const { data } = useQuery({
    queryKey: ["earnings-overview"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });

  const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
  const num = (n: number) => (n ?? 0).toLocaleString();

  const cards = [
    {
      icon: Wallet,
      label: "Available balance",
      value: money(data?.balanceAvailable ?? 0),
      accent: true,
    },
    { icon: TrendingUp, label: "Earned today", value: money(data?.todayEarned ?? 0) },
    { icon: Users, label: "Human Visit", value: num(data?.humanClicks ?? 0) },
    { icon: Bot, label: "Bots filtered", value: num(data?.botClicks ?? 0) },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border p-4 backdrop-blur-xl ${
            c.accent
              ? "border-primary/30 bg-gradient-to-br from-primary/12 to-white/70"
              : "glass-card"
          }`}
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
            <c.icon className="w-3.5 h-3.5" />
            {c.label}
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{c.value}</div>
          {c.accent && (
            <Link
              to="/withdraw"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline"
            >
              Withdraw (Service Off) <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      ))}
      <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
        <span className="font-bold text-rose-400 flex items-center gap-1.5">
          ⛔ Earning System: Service Off
        </span>
        <span className="text-[11px] text-muted-foreground">
          Platform operates exclusively as high-speed shortener, safe cloaking & traffic routing.
        </span>
      </div>
    </div>
  );
}

export default EarningsStrip;
