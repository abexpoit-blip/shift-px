import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Bell, Sparkles, Megaphone, Gift, AlertTriangle, Info, CheckCircle2,
  Crown, Zap, Rocket, Star, Trophy, X,
} from "lucide-react";
import { listActiveBroadcasts, markBroadcastRead, markAllBroadcastsRead } from "@/lib/broadcasts.functions";

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

function getIcon(name: string) {
  return ICON_MAP[name] ?? Sparkles;
}

const TONE_STYLES: Record<string, { ring: string; iconBg: string; glow: string; badge: string }> = {
  premium: {
    ring: "from-[#FF7E5F] via-[#FEB47B] to-[#FFD4BB]",
    iconBg: "from-[#FF7E5F] to-[#FEB47B]",
    glow: "shadow-[0_8px_30px_-8px_rgba(255,126,95,0.45)]",
    badge: "bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white",
  },
  info: {
    ring: "from-blue-400 via-blue-500 to-blue-600",
    iconBg: "from-blue-500 to-blue-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(59,130,246,0.45)]",
    badge: "bg-blue-500 text-white",
  },
  success: {
    ring: "from-emerald-400 via-emerald-500 to-emerald-600",
    iconBg: "from-emerald-500 to-emerald-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(16,185,129,0.45)]",
    badge: "bg-emerald-500 text-white",
  },
  warning: {
    ring: "from-amber-400 via-orange-500 to-red-500",
    iconBg: "from-amber-500 to-orange-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(245,158,11,0.45)]",
    badge: "bg-amber-500 text-white",
  },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function BroadcastBell() {
  const list = useServerFn(listActiveBroadcasts);
  const mark = useServerFn(markBroadcastRead);
  const markAll = useServerFn(markAllBroadcastsRead);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  const q = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => list(),
    staleTime: 60_000,
    refetchInterval: 90_000,
  });

  const markMut = useMutation({
    mutationFn: (id: string) => mark({ data: { broadcast_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      // Use capture for scroll to ensure it works in nested scrolls
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
    }
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      // Don't close if clicking the toggle button or the dropdown itself
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const items = q.data?.items ?? [];
  const unread = q.data?.unread_count ?? 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`relative group w-10 h-10 rounded-xl border transition-all shadow-sm flex items-center justify-center z-10 ${
          open 
            ? "bg-[#FF7E5F] border-[#FF7E5F] text-white" 
            : "bg-[#FFF9F5] border-[#FFEDD5] text-[#7D6452] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40"
        }`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell className="w-4 h-4 group-hover:scale-110 transition-transform" />
        {unread > 0 && (
          <>
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF7E5F] text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-lg ring-1 ring-orange-500/20">
              {unread > 9 ? "9+" : unread}
            </span>
            <span className="absolute inset-0 rounded-xl ring-2 ring-[#FF7E5F]/30 animate-pulse pointer-events-none" />
          </>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div 
          ref={dropdownRef}
          style={{ 
            top: `${coords.top + 8}px`, 
            // On desktop we use calculated right, on mobile we use inset-x-4 via class
            right: window.innerWidth >= 640 ? `${coords.right}px` : undefined,
          }}
          className="fixed z-[9999] inset-x-4 sm:inset-auto sm:w-[380px] min-h-[120px] max-h-[calc(100vh-100px)] sm:max-h-[520px] rounded-3xl bg-white border border-[#FFEDD5] shadow-[0_20px_60px_-15px_rgba(255,126,95,0.3)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
        >
          {/* Header */}
          <div className="relative px-5 py-4 bg-gradient-to-r from-[#FFF9F5] to-[#FFEDD5]/40 border-b border-[#FFEDD5] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-md shadow-orange-500/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#2D1B0D]">Notifications</div>
                <div className="text-[10px] text-[#A38D7D]">
                  {unread > 0 ? `${unread} new` : "All caught up"}
                </div>
              </div>
            </div>
            {unread > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAllMut.mutate();
                }}
                className="text-[11px] font-bold text-[#FF7E5F] hover:text-[#E66D50] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[440px]">
            {q.isLoading && (
              <div className="px-5 py-10 text-center text-xs text-[#A38D7D]">Loading…</div>
            )}
            {!q.isLoading && items.length === 0 && (
              <div className="px-5 py-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFF9F5] border border-[#FFEDD5] flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-[#A38D7D]" />
                </div>
                <div className="text-sm font-bold text-[#2D1B0D]">No notices yet</div>
                <div className="text-[11px] text-[#A38D7D] mt-1">We'll notify you of important updates here.</div>
              </div>
            )}

            {items.map((b) => {
              const Icon = getIcon(b.icon);
              const tone = TONE_STYLES[b.tone] ?? TONE_STYLES.premium;
              return (
                <button
                  key={b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!b.is_read) markMut.mutate(b.id);
                  }}
                  className={`w-full text-left px-4 py-3.5 border-b border-[#FFEDD5]/70 last:border-0 hover:bg-[#FFF9F5]/70 transition-colors ${
                    !b.is_read ? "bg-gradient-to-r from-[#FFF9F5] to-transparent" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Premium icon w/ animated ring */}
                    <div className="relative shrink-0">
                      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${tone.ring} blur-sm opacity-50`} />
                      <div className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${tone.iconBg} flex items-center justify-center ${tone.glow}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13px] font-extrabold text-[#2D1B0D] leading-snug">
                          {b.title}
                        </div>
                        {!b.is_read && (
                          <span className="shrink-0 mt-1 w-2 h-2 rounded-full bg-[#FF7E5F] shadow-[0_0_6px_rgba(255,126,95,0.9)]" />
                        )}
                      </div>
                      <div className="text-[11.5px] text-[#7D6452] mt-1 leading-relaxed line-clamp-3">
                        {b.body}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {b.tone === "premium" && (
                          <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${tone.badge} shadow-sm tracking-wide uppercase`}>
                            ✨ Premium
                          </span>
                        )}
                        <span className="text-[10px] text-[#A38D7D] font-medium">{timeAgo(b.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
