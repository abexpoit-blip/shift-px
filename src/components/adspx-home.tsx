import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MonetagBanner } from "@/components/MonetagBanner";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  DollarSign,
  Link2,
  Wallet,
  TrendingUp,
  Globe2,
  ShieldCheck,
  Zap,
  Users,
  Sparkles,
  Check,
  Bitcoin,
  Banknote,
  ChevronDown,
} from "lucide-react";
import { AdspxMark } from "@/components/AdspxLogo";
import { makeRecentPayout } from "@/lib/publishers";
import { PARTNER_LOGOS } from "@/components/BrandLogos";

export function AdspxHome() {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Premium ambient background — layered gradients + soft orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Warm cream base wash */}
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_15%_-10%,hsl(28_90%_92%/0.55),transparent_60%),radial-gradient(1000px_600px_at_100%_10%,hsl(262_85%_92%/0.5),transparent_60%),radial-gradient(900px_600px_at_50%_110%,hsl(340_85%_93%/0.45),transparent_65%)]" />
        {/* Fine grain texture */}
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
        {/* Soft orbs */}
        <div className="orb orb-indigo fixed -top-32 -left-24 h-[30rem] w-[30rem] opacity-20" />
        <div
          className="orb orb-pink fixed top-1/2 -right-32 h-[32rem] w-[32rem] opacity-[0.18]"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="orb orb-indigo fixed -bottom-24 left-1/3 h-[26rem] w-[26rem] opacity-[0.12]"
          style={{ animationDelay: "-14s" }}
        />
      </div>

      <SiteHeader />
      <Hero />
      <PayoutBar />
      <SponsorPartnersSection />
      <HowItWorks />
      <EarningsCalculator />
      <Sponsors />
      <FeatureGrid />
      <RecentPayouts />
      <FaqStrip />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}

/* ─────────────────────────────────────────────── HEADER */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <AdspxMark className="h-8 w-8" />
          <span className="font-display font-bold text-lg tracking-tight">
            Ads<span className="text-gradient">Px</span>
          </span>
          <span className="ml-2 hidden md:inline rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
            Earn
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#calculator" className="hover:text-foreground transition-colors">
            Calculator
          </a>
          <a href="/statistics" className="hover:text-foreground transition-colors">
            Statistics
          </a>
          <a href="/leaderboard" className="hover:text-foreground transition-colors">
            Leaderboard
          </a>
          <a href="#payouts" className="hover:text-foreground transition-colors">
            Payouts
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" className="btn-premium rounded-lg" asChild>
            <Link to="/signup">
              Start earning <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────── HERO — Kinetic pixel bento */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Blueprint grid wireframe backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hero-smallgrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="oklch(0.55 0.22 280)"
                strokeWidth="0.5"
              />
            </pattern>
            <pattern id="hero-grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#hero-smallgrid)" />
              <path
                d="M 100 0 L 0 0 0 100"
                fill="none"
                stroke="oklch(0.55 0.22 280)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
      </div>

      {/* Soft aurora ribbons — premium editorial accents */}
      <div aria-hidden className="bg-ribbon" style={{ top: "-60px", left: "-180px" }} />
      <div
        aria-hidden
        className="bg-ribbon bg-ribbon-alt"
        style={{ top: "260px", right: "-220px" }}
      />

      {/* Pixel-dot motif backgrounds */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-16 h-72 w-72 opacity-[0.14]"
        style={{
          backgroundImage: "radial-gradient(oklch(0.55 0.22 280) 2px, transparent 2px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 right-8 h-56 w-56 opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(oklch(0.72 0.20 340) 2px, transparent 2px)",
          backgroundSize: "14px 14px",
        }}
      />

      {/* Twinkling pixel accent dots */}
      <span
        aria-hidden
        className="pixel-dot indigo"
        style={{ top: "18%", left: "48%", animationDelay: "0s" }}
      />
      <span
        aria-hidden
        className="pixel-dot"
        style={{ top: "62%", left: "8%", animationDelay: "1.2s" }}
      />
      <span
        aria-hidden
        className="pixel-dot cyan"
        style={{ top: "30%", right: "12%", animationDelay: "2.1s" }}
      />
      <span
        aria-hidden
        className="pixel-dot"
        style={{ top: "78%", right: "28%", animationDelay: "0.6s" }}
      />

      {/* Editorial meta tag */}
      <div aria-hidden className="hidden lg:block absolute top-10 right-6 z-10">
        <span className="meta-tag">ADSPX · 001 / 2026</span>
      </div>

      <div className="container mx-auto px-4 sm:px-6 pt-10 pb-14 md:pt-20 md:pb-20 relative">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT — headline + copy + CTAs */}
          <div className="lg:col-span-7 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-semibold tracking-widest uppercase text-primary mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live payouts · $284K+ paid in 2026
            </div>

            <h1 className="font-display font-extrabold tracking-tight text-5xl sm:text-6xl lg:text-7xl xl:text-[5.25rem] leading-[0.92] text-foreground">
              Turn clicks
              <br />
              <span className="text-gradient">into capital.</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              AdsPx is the short-link platform built for creators. Share on
              <strong className="text-foreground"> Facebook</strong>, Telegram or YouTube and earn
              <strong className="text-foreground"> $1 per 50,000 visits</strong>. Withdraw in
              <strong className="text-foreground"> USDT</strong> from just $10.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="btn-premium rounded-2xl px-7 h-12 font-bold" asChild>
                <Link to="/signup">
                  Start earning now <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <div className="inline-flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-5 h-12 font-semibold text-sm">
                <span className="flex -space-x-2">
                  <span className="h-6 w-6 rounded-full bg-primary border-2 border-card" />
                  <span className="h-6 w-6 rounded-full bg-primary-glow border-2 border-card" />
                  <span className="h-6 w-6 rounded-full bg-success border-2 border-card" />
                </span>
                42,180+ active publishers
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> Free to join
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> No referral required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> Min $10 withdrawal
              </span>
            </div>
          </div>

          {/* RIGHT — Pixel-machine link mockup with neo-brutalist offset shadow */}
          <div className="lg:col-span-5 relative">
            {/* Floating coin card (behind, top-left) */}
            <div
              className="hidden sm:flex absolute -top-4 -left-4 z-0 items-center gap-2 rounded-2xl bg-card border-2 border-foreground/90 px-4 py-2.5 shadow-[6px_6px_0_0_oklch(0.72_0.20_340)] rotate-[-6deg]"
              aria-hidden
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground text-xs font-black">
                $
              </div>
              <div className="text-xs">
                <div className="font-bold leading-tight">+$4.20</div>
                <div className="text-muted-foreground leading-tight">420 clicks</div>
              </div>
            </div>

            {/* Main pixel-machine card */}
            <div
              className="relative z-10 bg-card rounded-[2rem] p-6 sm:p-7 border-[3px] border-foreground/90 overflow-hidden"
              style={{ boxShadow: "14px 14px 0 0 oklch(0.55 0.22 280)" }}
            >
              {/* Pixel dots — top-right */}
              <div className="absolute top-4 right-4 grid grid-cols-3 gap-1" aria-hidden>
                <span className="h-2 w-2 bg-primary-glow" />
                <span className="h-2 w-2 bg-transparent" />
                <span className="h-2 w-2 bg-primary-glow" />
                <span className="h-2 w-2 bg-transparent" />
                <span className="h-2 w-2 bg-primary-glow" />
                <span className="h-2 w-2 bg-transparent" />
              </div>

              {/* Original URL */}
              <div className="rounded-xl bg-muted border border-dashed border-border p-4">
                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">
                  Original URL
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  youtube.com/watch?v=your-viral-video
                </div>
              </div>

              {/* Down arrow */}
              <div className="flex justify-center my-4">
                <div className="h-10 w-10 grid place-items-center bg-primary rounded-full text-primary-foreground">
                  <ChevronDown className="h-5 w-5" />
                </div>
              </div>

              {/* Shortened link */}
              <div className="rounded-xl p-4 bg-primary-gradient shadow-glow">
                <div className="text-[10px] uppercase tracking-widest font-bold text-primary-foreground/80 mb-1.5">
                  AdsPx short link
                </div>
                <div className="text-lg font-black text-primary-foreground font-mono">
                  adspx.co/reward-291
                </div>
              </div>

              {/* Footer stat */}
              <div className="mt-6 pt-5 border-t border-border flex justify-between items-end">
                <div>
                  <div className="font-display text-2xl font-black">$2,481.00</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    Total user payouts today
                  </div>
                </div>
                <div className="h-9 w-9 rounded-lg bg-accent grid place-items-center text-accent-foreground">
                  <Bitcoin className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Floating "verified click" chip (front, bottom-right) */}
            <div
              className="hidden sm:flex absolute -bottom-5 -right-3 z-20 items-center gap-2 rounded-2xl bg-foreground text-background px-4 py-2.5 rotate-[4deg] shadow-elegant"
              aria-hidden
            >
              <ShieldCheck className="h-4 w-4 text-success" />
              <span className="text-xs font-bold">Real click verified</span>
            </div>
          </div>
        </div>

        {/* URL shortener input — full-width under the split */}
        <form
          className="relative max-w-2xl mx-auto pt-14 md:pt-20"
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = "/signup";
          }}
        >
          <div className="glass-deep rounded-2xl p-1.5 flex flex-col sm:flex-row gap-1.5">
            <Input
              type="url"
              required
              aria-label="Paste your long URL"
              placeholder="Paste your long URL here…"
              className="h-12 text-base bg-transparent border-0 shadow-none focus-visible:ring-0 px-4 flex-1"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 px-6 btn-premium rounded-xl font-semibold"
            >
              Shorten & earn <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── PAYOUT BAR */
function PayoutBar() {
  const stats = [
    { label: "Active publishers", value: "42,180+" },
    { label: "Clicks served", value: "2.4B+" },
    { label: "Paid in 2026", value: "$284K+" },
    { label: "Min payout", value: "$10" },
  ];
  return (
    <section className="border-y border-border/60 bg-card/40">
      <div className="container mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-display text-3xl md:text-4xl font-bold text-gradient">
              {s.value}
            </div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


/* ─────────────────────────────────────────────── SPONSOR & AD NETWORK PARTNERS */
function SponsorPartnersSection() {
  const sponsors = [
    { name: "Monetag Publisher Partner", type: "Official Monetization Sponsor", badge: "Verified Network", url: "https://monetag.com/?ref_id=adspx" },
    { name: "Apex Media Exchange", type: "Tier-1 DSP", badge: "Certified Partner", url: "https://monetag.com/?ref_id=adspx" },
    { name: "CloudScale AdTech", type: "Programmatic RTB", badge: "Global Sponsor", url: "https://monetag.com/?ref_id=adspx" },
    { name: "HyperSync Media", type: "Ad Exchange", badge: "Verified Network", url: "https://monetag.com/?ref_id=adspx" },
  ];

  return (
    <section className="border-b border-border/60 bg-gradient-to-b from-card/20 to-card/60 py-10 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 mb-2">
            <Sparkles className="w-3 h-3 text-primary" />
            Ecosystem Sponsor Network
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Backed by leading global ad exchanges and programmatic media sponsors.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 max-w-4xl mx-auto mb-8">
          {sponsors.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-4 rounded-2xl border border-border/80 bg-card/60 hover:bg-card hover:border-emerald-500/40 backdrop-blur-md transition-all flex flex-col items-center justify-center text-center shadow-sm hover:shadow-glow/10 hover:scale-[1.02]"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 mb-2 group-hover:scale-125 transition-transform animate-pulse" />
              <div className="font-extrabold text-xs sm:text-sm text-foreground tracking-tight">{s.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.type}</div>
              <span className="mt-2.5 inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {s.badge}
              </span>
            </a>
          ))}
        </div>

        {/* DIRECT MONETAG BANNER AD ON HOMEPAGE */}
        <div className="max-w-4xl mx-auto">
          <MonetagBanner variant="home" />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── HOW IT WORKS — Bento path */
function HowItWorks() {
  return (
    <section id="how" className="container mx-auto px-4 sm:px-6 py-14 md:py-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
          The path to <span className="text-gradient italic">profit.</span>
        </h2>
        <p className="text-muted-foreground font-medium">Simple mechanics. Massive potential.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* 01 — Shorten */}
        <div className="md:col-span-4 group relative overflow-hidden rounded-3xl bg-card border-2 border-border p-7 hover:border-primary/60 transition-colors">
          <div
            className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/10 group-hover:scale-150 transition-transform duration-500"
            aria-hidden
          />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground grid place-items-center font-black text-lg italic mb-6 shadow-lg shadow-primary/20">
              01
            </div>
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4">
              <Link2 className="h-5 w-5" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-2">Shorten any link</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Paste your URL — YouTube video, blog post, anything. Get a clean AdsPx short link in 2
              seconds.
            </p>
          </div>
        </div>

        {/* 02 — Share (hero bento card) */}
        <div className="md:col-span-8 relative overflow-hidden rounded-3xl p-7 md:p-8 text-primary-foreground bg-primary-gradient">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1.5px, transparent 1.5px)",
              backgroundSize: "18px 18px",
            }}
            aria-hidden
          />
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-white grid place-items-center font-black text-lg italic mb-6">
              02
            </div>
            <h3 className="font-display text-2xl md:text-3xl font-bold mb-3">Share everywhere</h3>
            <p className="text-white/85 text-base md:text-lg max-w-xl leading-relaxed">
              Drop it on Facebook, Telegram channels, Twitter, your blog. Every real human visit
              adds to your balance — our shield filters out bots automatically.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Facebook", "Telegram", "YouTube", "Twitter", "Discord"].map((s) => (
                <span
                  key={s}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 border border-white/25 text-[11px] font-bold tracking-wide"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 03 — Cash out (dark) */}
        <div className="md:col-span-7 rounded-3xl bg-foreground text-background p-7 md:p-8 relative">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <div className="flex-1">
              <div className="w-12 h-12 rounded-xl bg-primary-glow text-white grid place-items-center font-black text-lg italic mb-6 shadow-lg shadow-primary-glow/30">
                03
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-bold mb-3">Collect USDT</h3>
              <p className="text-background/70 leading-relaxed text-sm md:text-base">
                Hit the <span className="text-background font-bold">$25 threshold</span> and cash
                out directly to your wallet in USDT (TRC20 / BEP20). Processed within 24 hours.
              </p>
            </div>
            <div className="shrink-0 w-28 h-28 rounded-2xl bg-background/5 border border-background/10 grid place-items-center">
              <div className="text-center">
                <Wallet className="h-8 w-8 mx-auto text-primary-glow" />
                <div className="text-[10px] text-primary-glow font-bold uppercase mt-2 tracking-widest">
                  Ready
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 04 — Rate stat (neo-brutalist) */}
        <div className="md:col-span-5 rounded-3xl bg-card border-2 border-foreground p-7 flex flex-col justify-center items-center text-center">
          <div className="font-display text-5xl md:text-6xl font-black text-gradient">$1.00</div>
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Per 50,000 clicks
          </div>

          <div className="mt-5 grid grid-cols-8 gap-1" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className="h-3 w-3"
                style={{
                  background:
                    i < 6
                      ? "linear-gradient(135deg, oklch(0.55 0.22 280), oklch(0.72 0.20 340))"
                      : "oklch(0.90 0.01 270)",
                }}
              />
            ))}
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground">
            Flat global rate · no hidden tiers
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── EARNINGS CALCULATOR */
function EarningsCalculator() {
  const [daily, setDaily] = useState(5000);
  // $1 per 50,000 clicks
  const rate = 1 / 50000;

  const dailyEarn = daily * rate;
  const monthlyEarn = dailyEarn * 30;
  const yearlyEarn = dailyEarn * 365;

  return (
    <section id="calculator" className="container mx-auto px-6 py-12 md:py-20">
      <div className="text-center mb-12 max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          Earnings calculator
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
          See what your daily traffic is <span className="text-gradient">worth</span>
        </h2>
        <p className="text-muted-foreground text-sm">
          Move the slider to your daily visits — see live daily, monthly &amp; yearly revenue.
        </p>
      </div>

      <div className="max-w-3xl mx-auto rounded-3xl border border-primary/30 glass-deep p-5 sm:p-6 md:p-8 shadow-elegant">
        <label
          htmlFor="clicks-range"
          className="block text-sm font-medium text-muted-foreground mb-3"
        >
          Daily visits you can send
        </label>
        <input
          id="clicks-range"
          type="range"
          aria-label="Daily visits slider"
          min={500}
          max={200000}
          step={500}
          value={daily}
          onChange={(e) => setDaily(Number(e.target.value))}
          className="w-full h-2 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
        />

        <div className="flex justify-between text-xs text-muted-foreground mt-2 font-mono">
          <span>500</span>
          <span>50K</span>
          <span>200K</span>
        </div>

        <div className="mt-4 text-center">
          <div className="font-display text-3xl font-bold tracking-tight">
            {daily.toLocaleString()}{" "}
            <span className="text-base font-normal text-muted-foreground">visits / day</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="rounded-xl border border-border bg-background/40 p-5 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Daily</div>
            <div className="font-display text-3xl font-bold mt-1">${dailyEarn.toFixed(2)}</div>
          </div>
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 text-center">
            <div className="text-xs uppercase tracking-wider text-primary">Monthly</div>
            <div className="font-display text-3xl font-bold text-gradient mt-1">
              ${monthlyEarn.toFixed(2)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-5 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Yearly</div>
            <div className="font-display text-3xl font-bold mt-1">${yearlyEarn.toFixed(2)}</div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6 leading-relaxed">
          Flat rate: <strong className="text-foreground">$1 per 50,000 real visits</strong> ·
          Minimum withdrawal: <strong className="text-foreground">$10 USDT (TRC20 / BEP20)</strong>{" "}
          · Bot traffic auto-filtered.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── SPONSORS */
function Sponsors() {
  return (
    <section id="sponsors" className="container mx-auto px-6 py-12 md:py-20">
      <div className="text-center mb-12 max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          Built for ad networks
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
          Promote <span className="text-gradient">Adsterra</span> &amp; other offers on Facebook
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          AdsPx is engineered specifically for promoting{" "}
          <strong className="text-foreground">Adsterra</strong>, PropellerAds, Monetag and other
          ad-network links on <strong className="text-foreground">Facebook</strong>. We negotiate
          bulk deals with these networks at scale, then pass{" "}
          <strong className="text-foreground">most of the revenue back to you</strong> — that's how
          we can pay <strong className="text-foreground">$1 per 50,000 visits</strong> with zero
          hidden cuts.
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
        {PARTNER_LOGOS.map(({ name, Comp, note }) => (
          <div
            key={name}
            className="glass rounded-2xl px-5 py-6 border border-border/60 hover:border-primary/40 transition-colors flex flex-col items-center text-center gap-2"
          >
            <Comp className="h-7" />
            <span className="text-[11px] text-muted-foreground">{note}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground mt-8">
        Logos shown for reference — AdsPx works with any ad network that accepts paid traffic.
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────── FEATURES */
function FeatureGrid() {
  const features = [
    {
      icon: DollarSign,
      title: "$1 per 50k clicks",
      desc: "Flat global rate. No confusing country tiers, no hidden cuts. What you earn is what you see.",
    },

    {
      icon: Bitcoin,
      title: "Crypto withdrawals",
      desc: "Cash out in USDT (TRC20 or BEP20). Low network fees, fast settlement, no bank required.",
    },
    {
      icon: ShieldCheck,
      title: "Real-click protection",
      desc: "Built-in bot shield and click-fraud detection. Only genuine human visits add to your balance.",
    },
    {
      icon: TrendingUp,
      title: "Live earnings dashboard",
      desc: "Watch your balance grow in real time. Per-link, per-country, per-day analytics included.",
    },
    {
      icon: Globe2,
      title: "Worldwide acceptance",
      desc: "Earn from clicks in any country. Whether your audience is in BD, India, US, or UK — same rate.",
    },
    {
      icon: Zap,
      title: "Fast redirects",
      desc: "Sub-second short link redirects so visitors never bounce. Your earnings stay intact.",
    },
  ];
  return (
    <section className="container mx-auto px-6 py-12 md:py-20">
      <div className="text-center mb-14 max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          Why AdsPx
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
          Built for <span className="text-gradient">people who share links</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-card transition-all"
          >
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4 group-hover:bg-primary/20 transition-colors">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-base mb-1.5">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── RECENT PAYOUTS */
type Payout = import("@/lib/publishers").RecentPayout;
type CC = import("@/lib/publishers").CountryCode;

function formatWhen(min: number): string {
  if (min < 1) return "just now";
  if (min < 60) return `${Math.floor(min)} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

// Weighted country picker — used for client-side updates only (random ok after mount).
const OTHER_CCS: CC[] = [
  "us",
  "id",
  "ng",
  "br",
  "mx",
  "eg",
  "tr",
  "ph",
  "ma",
  "gb",
  "de",
  "sa",
  "ae",
  "ir",
];
function pickCountry(): CC | undefined {
  const r = Math.random();
  if (r < 0.42) return "in";
  if (r < 0.72) return "pk";
  if (r < 0.85) return "bd";
  return OTHER_CCS[Math.floor(Math.random() * OTHER_CCS.length)];
}

// Deterministic initial rows so SSR + client hydration match exactly.
// Hardcoded (no Math.random) — makeRecentPayout is used only for client-side updates.
const INITIAL_PAYOUTS: Payout[] = [
  { user: "arjun.k***", country: "in", amount: 42.5, method: "USDT TRC20", minutesAgo: 3 },
  { user: "hassan.a***", country: "pk", amount: 28.1, method: "USDT BEP20", minutesAgo: 11 },
  { user: "rakib.h***", country: "bd", amount: 55.0, method: "USDT TRC20", minutesAgo: 24 },
  { user: "michael.b***", country: "us", amount: 47.2, method: "USDT TRC20", minutesAgo: 47 },
  { user: "rahul.m***", country: "in", amount: 18.75, method: "USDT BEP20", minutesAgo: 82 },
  { user: "chinedu.o***", country: "ng", amount: 22.4, method: "USDT TRC20", minutesAgo: 130 },
  { user: "bilal.k***", country: "pk", amount: 34.9, method: "USDT BEP20", minutesAgo: 210 },
  { user: "budi.s***", country: "id", amount: 15.3, method: "USDT TRC20", minutesAgo: 340 },
];
function buildInitial(): Payout[] {
  return INITIAL_PAYOUTS;
}

function RecentPayouts() {
  // Deterministic initial state → SSR HTML matches first client render.
  const [payouts, setPayouts] = useState<Payout[]>(() => buildInitial());

  useEffect(() => {
    const id = setInterval(() => {
      setPayouts((prev) => {
        if (prev.length === 0) return prev;
        const aged = prev.map((p) => ({ ...p, minutesAgo: p.minutesAgo + 1 }));
        const fresh = makeRecentPayout(0, pickCountry());
        const trimmed = aged.slice(0, aged.length - 1);
        return [fresh, ...trimmed];
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const visible = payouts;

  return (
    <section id="payouts" className="container mx-auto px-6 py-12 md:py-20">
      <div className="text-center mb-10 max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Banknote className="h-3 w-3" /> Live payouts
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
          Real publishers. <span className="text-gradient">Real withdrawals.</span>
        </h2>
        <p className="text-muted-foreground text-sm">
          Publishers withdrawing from all around the world.
        </p>
      </div>

      <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card overflow-hidden shadow-card">
        <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <div>Publisher</div>
          <div>Method</div>
          <div className="text-right">Amount</div>
          <div className="text-right">When</div>
        </div>
        {visible.length === 0
          ? // Skeleton rows — server renders these; client swaps in real payouts after mount.
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="px-4 sm:px-5 py-3 border-b border-border/40 last:border-b-0"
              >
                <div className="h-4 rounded bg-muted/50 animate-pulse" />
              </div>
            ))
          : visible.map((p, i) => (
              <div
                key={`${p.user}-${i}`}
                className="px-4 sm:px-5 py-3 border-b border-border/40 last:border-b-0 text-sm"
              >
                {/* Mobile */}
                <div className="flex items-center gap-2.5 sm:hidden">
                  <img
                    src={`https://flagcdn.com/${p.country}.svg`}
                    alt={p.country.toUpperCase()}
                    loading="lazy"
                    className="h-3.5 w-5 rounded-[2px] border border-border/60 object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs truncate">{p.user}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Bitcoin className="h-3 w-3" />
                      {p.method} · {formatWhen(p.minutesAgo)}
                    </div>
                  </div>
                  <div className="text-right font-display font-semibold text-success shrink-0">
                    +${p.amount.toFixed(2)}
                  </div>
                </div>
                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={`https://flagcdn.com/${p.country}.svg`}
                      alt={p.country.toUpperCase()}
                      loading="lazy"
                      className="h-3.5 w-5 rounded-[2px] border border-border/60 object-cover shrink-0"
                    />
                    <span className="font-mono">{p.user}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Bitcoin className="h-3.5 w-3.5" />
                    {p.method}
                  </div>
                  <div className="text-right font-display font-semibold text-success">
                    +${p.amount.toFixed(2)}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {formatWhen(p.minutesAgo)}
                  </div>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── FAQ */
function FaqStrip() {
  const faqs = [
    {
      q: "How much do I really earn per click?",
      a: "We pay $1 for every 50,000 valid (human) visits ($0.02 / 1k). That's a flat global rate — no country tiers, no surprises.",
    },
    {
      q: "What's the minimum withdrawal?",
      a: "$25. Once your balance hits $25, you can request a withdrawal to your USDT crypto wallet (TRC20 or BEP20).",
    },
    {
      q: "How long does payment take?",
      a: "Most withdrawals are processed within 24 hours. You'll receive the USDT directly to your wallet address.",
    },
    {
      q: "Are bots and fake clicks counted?",
      a: "No. We filter datacenter IPs, known bot networks, and suspicious patterns automatically. Only real visits add to your balance.",
    },
    {
      q: "Where can I share my AdsPx links?",
      a: "Anywhere your audience is — Facebook, Telegram, Twitter/X, YouTube, blog, WhatsApp groups. No platform restrictions.",
    },
    {
      q: "Do I need an AdsPx referral to sign up?",
      a: "No, signup is open and free. There is a referral program if you want to earn from inviting friends, but it's optional.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="container mx-auto px-6 py-12 md:py-20">
      <div className="text-center mb-12 max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          FAQ
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
          Quick answers
        </h2>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {faqs.map((f, i) => (
          <button
            key={f.q}
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display font-semibold">{f.q}</h3>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                  open === i ? "rotate-180" : ""
                }`}
              />
            </div>
            {open === i && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">{f.a}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── FINAL CTA */
function FinalCta() {
  return (
    <section className="container mx-auto px-6 pb-24">
      <div className="relative rounded-3xl border border-primary/30 bg-card p-6 sm:p-8 md:p-12 text-center overflow-hidden shadow-elegant">
        <div className="absolute inset-0 bg-hero opacity-70 pointer-events-none" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 h-60 w-[600px] rounded-full bg-primary-gradient opacity-25 blur-3xl" />
        <div className="relative space-y-6 max-w-2xl mx-auto">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Start turning clicks into <span className="text-gradient">crypto today</span>
          </h2>
          <p className="text-muted-foreground">
            Free signup. No minimum traffic. Withdraw from $25 in USDT.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" className="bg-primary-gradient shadow-glow h-12 px-7" asChild>
              <a href="/signup">
                Create free account <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-7" asChild>
              <a href="#calculator">Calculate earnings</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────── FOOTER */
function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AdspxMark className="h-7 w-7" glow={false} />
              <span className="font-display font-bold">
                Ads<span className="text-gradient">Px</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Shorten links. Get paid per click. Cash out in crypto.
            </p>
          </div>
          {[
            { title: "Earn", links: ["How it works", "Calculator", "Payouts", "Referrals"] },
            { title: "Company", links: ["About", "Blog", "Contact", "Support"] },
            { title: "Legal", links: ["Terms", "Privacy", "Refund policy", "Cookies"] },
          ].map((col) => (
            <div key={col.title}>
              <div className="font-display font-semibold text-sm mb-3">{col.title}</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-foreground transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} AdsPx. All rights reserved.</div>
          <div>Built for creators worldwide ✦</div>
        </div>
      </div>
    </footer>
  );
}
