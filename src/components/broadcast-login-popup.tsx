import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Megaphone,
  Gift,
  AlertTriangle,
  Info,
  CheckCircle2,
  Crown,
  Zap,
  Rocket,
  Star,
  Trophy,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  ArrowRight,
} from "lucide-react";
import { listActiveBroadcasts, markBroadcastRead } from "@/lib/broadcasts.functions";
import { BroadcastMarkdown } from "@/components/broadcast-markdown";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  megaphone: Megaphone,
  gift: Gift,
  warning: AlertTriangle,
  info: Info,
  check: CheckCircle2,
  crown: Crown,
  zap: Zap,
  rocket: Rocket,
  star: Star,
  trophy: Trophy,
};

const TONE: Record<string, { badge: string; border: string; glow: string; text: string; bg: string }> = {
  premium: {
    badge: "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black",
    border: "border-amber-500/30",
    glow: "shadow-[0_0_50px_rgba(245,158,11,0.25)]",
    text: "text-amber-400",
    bg: "from-amber-500/10 via-card to-card",
  },
  info: {
    badge: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold",
    border: "border-indigo-500/30",
    glow: "shadow-[0_0_50px_rgba(99,102,241,0.25)]",
    text: "text-indigo-400",
    bg: "from-indigo-500/10 via-card to-card",
  },
  success: {
    badge: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold",
    border: "border-emerald-500/30",
    glow: "shadow-[0_0_50px_rgba(16,185,129,0.25)]",
    text: "text-emerald-400",
    bg: "from-emerald-500/10 via-card to-card",
  },
  warning: {
    badge: "bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold",
    border: "border-rose-500/30",
    glow: "shadow-[0_0_50px_rgba(244,63,94,0.25)]",
    text: "text-rose-400",
    bg: "from-rose-500/10 via-card to-card",
  },
};

const SESSION_FLAG = "adspx_login_notice_seen_v2";

export function BroadcastLoginPopup() {
  const list = useServerFn(listActiveBroadcasts);
  const mark = useServerFn(markBroadcastRead);

  const q = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => list(),
    staleTime: 60_000,
  });

  const unread = useMemo(() => (q.data?.items ?? []).filter((b: any) => !b.is_read), [q.data]);

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || unread.length === 0) return;
    try {
      if (sessionStorage.getItem(SESSION_FLAG)) return;
      sessionStorage.setItem(SESSION_FLAG, "1");
    } catch {}
    setIdx(0);
    setOpen(true);
  }, [mounted, unread.length]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open || unread.length === 0) return null;
  const current = unread[Math.min(idx, unread.length - 1)];
  if (!current) return null;

  const tone = TONE[current.tone] ?? TONE.info;
  const Icon = ICON_MAP[current.icon] ?? Sparkles;
  const total = unread.length;

  const goNext = async () => {
    try {
      await mark({ data: { broadcast_id: current.id } });
    } catch {}
    if (idx + 1 < total) setIdx(idx + 1);
    else close();
  };

  const goPrev = () => setIdx(Math.max(0, idx - 1));

  const close = async () => {
    try {
      await mark({ data: { broadcast_id: current.id } });
    } catch {}
    setOpen(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Dark Ambient Backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={close} />

      {/* Luxury Modal Card */}
      <div
        className={`relative w-full max-w-xl rounded-3xl bg-card border ${tone.border} ${tone.glow} overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200`}
      >
        {/* Ambient Top Glow Orbs */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className={`p-6 pb-4 bg-gradient-to-b ${tone.bg} border-b border-border/60 flex items-start justify-between gap-4 relative`}>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-inner">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full ${tone.badge}`}>
                  Official Announcement
                </span>
                {total > 1 && (
                  <span className="text-[11px] font-extrabold text-muted-foreground">
                    {idx + 1} of {total}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                {current.created_at ? new Date(current.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
              </span>
            </div>
          </div>

          <button
            onClick={close}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-4 max-h-[60vh] overflow-y-auto relative">
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
            {current.title}
          </h2>

          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed text-sm">
            <BroadcastMarkdown>{current.body}</BroadcastMarkdown>
          </div>
        </div>

        {/* Modal Footer / Navigation */}
        <div className="p-4 sm:p-5 bg-card/80 border-t border-border/60 flex items-center justify-between gap-3 relative">
          <div className="flex items-center gap-1.5">
            {total > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={idx === 0}
                  className="h-9 px-3 rounded-xl border border-border bg-card text-xs font-bold disabled:opacity-30 flex items-center gap-1 hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={goNext}
                  className="h-9 px-3.5 rounded-xl border border-border bg-card text-xs font-bold flex items-center gap-1 hover:bg-muted"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          <button
            onClick={close}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-xs font-black shadow-lg shadow-indigo-500/20 hover:opacity-95 flex items-center gap-1.5 transition-opacity"
          >
            Got it, thanks <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
