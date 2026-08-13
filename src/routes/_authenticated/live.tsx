import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Activity, Bot, User, Globe2, MapPin, Zap, RefreshCw } from "lucide-react";
import { getLiveFeed } from "@/lib/live-feed.functions";
import { Flag, DeviceIcon, BrowserIcon } from "@/components/StatIcons";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({ meta: [{ title: "Live Feed — Sleepox" }] }),
  component: LiveFeedPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function LiveFeedPage() {
  const feed = useServerFn(getLiveFeed);
  const [paused, setPaused] = useState(false);

  const q = useQuery({
    queryKey: ["live-feed"],
    queryFn: () => feed(),
    refetchInterval: paused ? false : 3_000,
    refetchOnWindowFocus: false,
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const data = q.data;

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto" style={font}>
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-white/80 text-emerald-600 text-[10px] font-bold uppercase tracking-widest shadow-sm mb-3">
            <span className={`w-2 h-2 rounded-full ${paused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`} />
            {paused ? "Paused" : "Streaming · 3s"}
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-[#2D1B0D]">Live Click Feed</h1>
          <p className="text-sm text-[#7D6452] mt-2 max-w-2xl">Real-time stream of every click hitting your links — country, device, browser & verdict.</p>
        </div>
        <button onClick={() => setPaused(p => !p)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-white border border-[#FFEDD5] text-[#2D1B0D] hover:bg-[#FFEDD5]/40 shadow-sm">
          {paused ? <><Activity className="w-4 h-4" /> Resume</> : <><RefreshCw className="w-4 h-4" /> Pause</>}
        </button>
      </header>

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Clicks / 5 min" value={data?.cps5m?.toLocaleString() ?? "0"} icon={Zap} tone="orange" />
        <Stat label="Humans (1h)" value={data?.humans1h?.toLocaleString() ?? "0"} icon={User} tone="green" />
        <Stat label="Bots Blocked (1h) ✓" value={data?.bots1h?.toLocaleString() ?? "0"} icon={Bot} tone="green" />
        <Stat label="Unique countries" value={(data?.countries?.length ?? 0).toLocaleString()} icon={Globe2} tone="blue" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* LEFT: Live event stream */}
        <div className="lg:col-span-2 rounded-2xl border border-[#FFEDD5] bg-white overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-[#FFEDD5] flex items-center justify-between bg-gradient-to-r from-[#FFF9F5] to-white">
            <h3 className="text-sm font-bold text-[#2D1B0D]">Last 50 clicks</h3>
            <span className="text-[11px] text-[#A38D7D]">{data?.events?.length ?? 0} events</span>
          </div>
          {q.isLoading && <div className="p-12 text-center text-sm text-[#A38D7D]">Loading…</div>}
          {!q.isLoading && (data?.events?.length ?? 0) === 0 && (
            <div className="p-12 text-center text-sm text-[#7D6452]">No clicks yet — share a link to see them appear live.</div>
          )}
          <ul className="divide-y divide-[#FFEDD5] max-h-[640px] overflow-y-auto">
            {data?.events?.map(e => {
              const age = Math.floor((now - new Date(e.created_at).getTime()) / 1000);
              const ageStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`;
              return (
                <li key={e.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#FFF9F5] transition-colors">
                  <Flag code={e.country} large />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#2D1B0D]">{e.countryName}</span>
                      <span className="text-[10px] text-[#A38D7D]">·</span>
                      <span className="text-xs text-[#7D6452] font-mono">/r/{e.short_code}</span>
                      {e.referrer_source && (
                        <>
                          <span className="text-[10px] text-[#A38D7D]">·</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFEDD5] text-[#FF7E5F] font-bold uppercase tracking-wider">{e.referrer_source}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FFF5EE] ring-1 ring-[#FFEDD5]">
                        <DeviceIcon name={e.device} os={e.deviceOs} />
                        <span className="text-[10px] font-semibold text-[#7D6452]">{e.deviceOs || e.device}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FFF5EE] ring-1 ring-[#FFEDD5]">
                        <BrowserIcon slug={e.browserSlug} color={e.browserColor} title={e.browser} />
                        <span className="text-[10px] font-semibold text-[#7D6452]">{e.browser}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                      e.is_bot ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                    }`}>
                      {e.is_bot ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {e.is_bot ? "BOT" : "HUMAN"}
                    </span>
                    <div className="text-[10px] text-[#A38D7D] mt-1 tabular-nums">{ageStr} ago</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT: Country breakdown + Cohort */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#FFEDD5] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#2D1B0D] mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#FF7E5F]" /> Top countries (24h)</h3>
            <div className="space-y-2.5">
              {data?.countries?.length ? data.countries.slice(0, 10).map(c => (
                <div key={c.code}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-2 text-[#2D1B0D] font-semibold">
                      <Flag code={c.code} small />
                      <span>{c.name}</span>
                    </span>
                    <span className="font-bold tabular-nums text-[#2D1B0D]">{c.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#FFEDD5] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B]" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              )) : <p className="text-xs text-[#A38D7D]">No data yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-[#FFEDD5] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#2D1B0D] mb-1 flex items-center gap-2"><Globe2 className="w-4 h-4 text-[#FF7E5F]" /> Cohort by source (24h)</h3>
            <p className="text-[11px] text-[#A38D7D] mb-3">Which referrer brings the cleanest traffic?</p>
            <div className="space-y-2.5">
              {data?.cohorts?.length ? data.cohorts.map(c => (
                <div key={c.source} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#2D1B0D] capitalize truncate">{c.source}</div>
                    <div className="text-[10px] text-[#A38D7D]">{c.total.toLocaleString()} clicks</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-extrabold tabular-nums ${c.humanRate >= 80 ? "text-emerald-600" : c.humanRate >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                      {c.humanRate}%
                    </span>
                    <div className="text-[10px] text-[#A38D7D]">human rate</div>
                  </div>
                </div>
              )) : <p className="text-xs text-[#A38D7D]">No cohorts yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Activity; tone: "orange" | "green" | "rose" | "blue" }) {
  const cfg = {
    orange: { grad: "from-[#FF7E5F] to-[#FEB47B]", ring: "ring-[#FFEDD5]", glow: "shadow-[0_8px_24px_-8px_rgba(255,126,95,0.55)]" },
    green:  { grad: "from-emerald-500 to-emerald-300", ring: "ring-emerald-100", glow: "shadow-[0_8px_24px_-8px_rgba(16,185,129,0.55)]" },
    rose:   { grad: "from-rose-500 to-rose-300", ring: "ring-rose-100", glow: "shadow-[0_8px_24px_-8px_rgba(244,63,94,0.55)]" },
    blue:   { grad: "from-sky-500 to-sky-300", ring: "ring-sky-100", glow: "shadow-[0_8px_24px_-8px_rgba(14,165,233,0.55)]" },
  }[tone];
  return (
    <div className={`relative rounded-2xl border border-[#FFEDD5] bg-white p-4 flex items-center gap-3 ring-1 ${cfg.ring} shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${cfg.grad} ${cfg.glow}`}>
        <Icon className="w-5 h-5 text-white drop-shadow-sm" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#A38D7D]">{label}</p>
        <p className="text-xl font-extrabold text-[#2D1B0D] tabular-nums">{value}</p>
      </div>
    </div>
  );
}
