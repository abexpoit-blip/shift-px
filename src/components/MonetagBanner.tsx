import { Sparkles, ArrowRight, Zap, ShieldCheck } from "lucide-react";

export function MonetagBanner({ variant = "default" }: { variant?: "default" | "compact" | "home" }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-card/90 to-teal-950/30 p-5 sm:p-6 backdrop-blur-xl shadow-xl shadow-emerald-500/5 transition-all hover:border-emerald-500/50">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl group-hover:bg-emerald-500/25 transition-all" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left Side: Monetag Branding & Value Prop */}
        <div className="flex items-start sm:items-center gap-4">
          <div className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
            <Zap className="h-6 w-6 sm:h-7 sm:w-7 text-white fill-white" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Official Global Partner
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400/90">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> High-CPM Publisher Network
              </span>
            </div>

            <h4 className="text-base sm:text-lg font-black tracking-tight text-foreground">
              Monetag — Global Audience Monetization Platform
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Monetize 100% of your worldwide traffic with AI-optimized smart formats, instant multi-tag delivery, and ultra-high CPMs.
            </p>
          </div>
        </div>

        {/* Right Side: CTA Button directly to Monetag */}
        <div className="shrink-0 flex items-center gap-3">
          <a
            href="https://monetag.com/?ref_id=adspx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Explore Monetag</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default MonetagBanner;
