import { Sparkles, Zap, ShieldCheck, ExternalLink } from "lucide-react";

export function MonetagBanner({ variant = "default" }: { variant?: "default" | "compact" | "home" }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-teal-950/90 p-6 sm:p-7 backdrop-blur-2xl shadow-2xl shadow-emerald-500/10 transition-all hover:border-emerald-400">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl group-hover:bg-emerald-400/30 transition-all" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-teal-400/20 blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Side: Monetag Branding & Value Prop */}
        <div className="flex items-start sm:items-center gap-5">
          <div className="grid h-14 w-14 sm:h-16 sm:w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-xl shadow-emerald-500/30">
            <Zap className="h-7 w-7 sm:h-8 sm:w-8 text-slate-950 fill-slate-950" />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-400 text-slate-950 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-slate-950" /> Official Global Partner
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> High-CPM Publisher Network
              </span>
            </div>

            <h4 className="text-lg sm:text-xl font-black tracking-tight text-white">
              Monetag — Global Audience Monetization Platform
            </h4>
            <p className="text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed font-medium">
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
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-400/25 hover:shadow-emerald-400/40 transition-all hover:scale-105 active:scale-95"
          >
            <span>Explore Monetag</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default MonetagBanner;
