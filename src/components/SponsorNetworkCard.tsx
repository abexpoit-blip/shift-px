import { Sparkles, ShieldCheck, ArrowUpRight, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function SponsorNetworkCard() {
      const sponsors = [
    {
      name: "Monetag Publisher Partner",
      tier: "Official Monetization Sponsor",
      tag: "Verified Network",
      url: "https://monetag.com/?ref_id=adspx",
      accent: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-400",
    },
    {
      name: "Apex Media Exchange",
      tier: "Tier-1 Global DSP",
      tag: "Verified Partner",
      url: "https://monetag.com/?ref_id=adspx",
      accent: "from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30",
      dot: "bg-cyan-400",
    },
    {
      name: "CloudScale AdTech",
      tier: "Programmatic RTB",
      tag: "Active Sponsor",
      url: "https://monetag.com/?ref_id=adspx",
      accent: "from-indigo-500/20 to-purple-500/10 text-indigo-400 border-indigo-500/30",
      dot: "bg-indigo-400",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/60 to-primary/5 p-5 sm:p-6 backdrop-blur-xl shadow-xl shadow-primary/5">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left Side: Info & Headline */}
        <div className="max-w-xl space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Sponsor Revenue Pool
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Sponsor Funded
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
            Global Sponsor & Partner Advertising Network
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Your link rewards and free infrastructure are funded by our global ad tech sponsors and certified programmatic exchanges. We share promotion earnings directly with our verified creators.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1 text-foreground">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Verified Human Rate: <strong className="text-primary font-bold ml-1">$1.00 / 50k clicks</strong>
            </span>
            <span>·</span>
            <Link
              to="/terms"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline hover:text-primary/80 transition-colors"
            >
              Promotion Terms & Policy <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Side: Sponsor Partner Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 shrink-0 lg:w-72">
          {sponsors.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border bg-gradient-to-r ${s.accent} backdrop-blur-md hover:scale-[1.02] transition-all cursor-pointer`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse shrink-0`} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-foreground">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.tier}</div>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-background/50 border border-white/10 text-muted-foreground">
                {s.tag}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SponsorNetworkCard;
