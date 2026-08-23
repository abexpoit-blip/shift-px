import { Sparkles, ShieldCheck, ArrowUpRight, Zap, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function SponsorNetworkCard() {
  const sponsors = [
    {
      name: "Monetag Publisher Network",
      tier: "Official Monetization Sponsor",
      tag: "Verified Network",
      url: "https://monetag.com/?ref_id=adspx",
      badgeCls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      cardCls: "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-card to-emerald-500/5 hover:border-emerald-500",
      dot: "bg-emerald-500",
    },
    {
      name: "Apex Media Exchange",
      tier: "Tier-1 Global DSP Partner",
      tag: "Verified Partner",
      url: "https://adspx.com/#sponsors",
      badgeCls: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
      cardCls: "border-cyan-500/40 bg-gradient-to-r from-cyan-500/10 via-card to-cyan-500/5 hover:border-cyan-500",
      dot: "bg-cyan-500",
    },
    {
      name: "CloudScale AdTech",
      tier: "Programmatic RTB Exchange",
      tag: "Active Sponsor",
      url: "https://adspx.com/#sponsors",
      badgeCls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
      cardCls: "border-indigo-500/40 bg-gradient-to-r from-indigo-500/10 via-card to-indigo-500/5 hover:border-indigo-500",
      dot: "bg-indigo-500",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-primary/20 bg-card/90 p-5 sm:p-6 backdrop-blur-xl shadow-lg">
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
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Sponsor Funded
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
            Global Sponsor &amp; Partner Advertising Network
          </h3>
          <p className="text-xs sm:text-sm text-foreground/80 dark:text-muted-foreground leading-relaxed font-medium">
            Your link rewards and free infrastructure are funded by our global ad tech sponsors and certified programmatic exchanges. We share promotion earnings directly with our verified creators.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-semibold text-foreground/70 dark:text-muted-foreground">
            <span className="flex items-center gap-1 text-foreground font-bold">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Verified Human Rate: <strong className="text-primary font-black ml-1">$1.00 / 50k clicks</strong>
            </span>
            <span>·</span>
            <Link
              to="/terms"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline transition-colors"
            >
              Promotion Terms &amp; Policy <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Side: Sponsor Partner Badges with full text visibility */}
        <div className="grid grid-cols-1 gap-2.5 shrink-0 lg:w-80">
          {sponsors.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${s.cardCls} backdrop-blur-md hover:scale-[1.02] transition-all cursor-pointer shadow-sm`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full ${s.dot} animate-pulse shrink-0`} />
                <div className="min-w-0">
                  <div className="text-xs font-black text-foreground">{s.name}</div>
                  <div className="text-[11px] font-semibold text-foreground/60 dark:text-muted-foreground">{s.tier}</div>
                </div>
              </div>
              <span className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${s.badgeCls}`}>
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
