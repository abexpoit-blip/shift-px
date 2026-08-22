import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
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
  CheckCheck,
  Clock,
  ShieldCheck,
  Coins,
  Globe2,
  Activity,
  Flame,
} from "lucide-react";
import {
  listActiveBroadcasts,
  markBroadcastRead,
  markAllBroadcastsRead,
} from "@/lib/broadcasts.functions";
import { Button } from "@/components/ui/button";
import { BroadcastMarkdown } from "@/components/broadcast-markdown";

export const Route = createFileRoute("/_authenticated/notices")({
  head: () => ({ meta: [{ title: "Notices — Adspx" }] }),
  component: NoticesPage,
});

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
  shield: ShieldCheck,
  coins: Coins,
  globe: Globe2,
  activity: Activity,
  flame: Flame,
};

const TONE_STYLES: Record<string, string> = {
  premium: "from-[var(--primary)] to-[var(--primary-glow)]",
  info: "from-blue-500 to-blue-600",
  success: "from-emerald-500 to-emerald-600",
  warning: "from-primary to-primary-glow",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NoticesPage() {
  const list = useServerFn(listActiveBroadcasts);
  const mark = useServerFn(markBroadcastRead);
  const markAll = useServerFn(markAllBroadcastsRead);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => list(),
  });

  const markMut = useMutation({
    mutationFn: (id: string) => mark({ data: { broadcast_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });

  const items = q.data?.items ?? [];
  const unreadCount = q.data?.unread_count ?? 0;

  return (
    <div className="relative z-10 p-5 sm:p-8 lg:p-12 space-y-8 max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-[28px] glass-card p-6 sm:p-8">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-[var(--primary)]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-[10px] font-bold uppercase tracking-widest mb-3">
              <Bell className="w-3 h-3" /> Notifications
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Broadcast <span className="text-[var(--primary)]">Inbox</span>
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Updates, announcements and news from Adspx.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-2xl bg-[var(--muted)]/60 border border-[var(--border)]">
              <div className="text-xl font-black leading-none">{items.length}</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mt-1">
                Total
              </div>
            </div>
            <div className="text-center px-4 py-2 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/25">
              <div className="text-xl font-black leading-none text-[var(--primary)]">
                {unreadCount}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--primary)]/80 mt-1">
                Unread
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                onClick={() => markAllMut.mutate()}
                disabled={markAllMut.isPending}
                className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground border-0 font-bold text-xs h-11 px-4 rounded-2xl gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="relative space-y-4">
        {q.isLoading && (
          <div className="p-12 text-center text-[var(--muted-foreground)] animate-pulse font-medium">
            Loading inbox…
          </div>
        )}
        {!q.isLoading && items.length === 0 && (
          <div className="p-20 text-center glass-card rounded-[32px]">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-lg font-bold">Your inbox is empty</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              We'll let you know when there's something new.
            </p>
          </div>
        )}

        {items.map((b) => {
          const Icon = ICON_MAP[b.icon] ?? Sparkles;
          const toneCls = TONE_STYLES[b.tone] ?? TONE_STYLES.premium;
          return (
            <div
              key={b.id}
              onClick={() => !b.is_read && markMut.mutate(b.id)}
              className={`group relative overflow-hidden rounded-[26px] glass-card transition-all duration-300 cursor-pointer hover:-translate-y-0.5 ${
                !b.is_read
                  ? "ring-1 ring-[var(--primary)]/25 shadow-lg shadow-primary/10"
                  : "opacity-80 hover:opacity-100"
              }`}
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${toneCls}`} />
              <div className="p-5 sm:p-6 pl-6 sm:pl-7 flex gap-4 sm:gap-6">
                <div className="relative shrink-0">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${toneCls} flex items-center justify-center text-primary-foreground shadow-lg group-hover:scale-110 transition-transform duration-500`}
                  >
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  {!b.is_read && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--card)] animate-pulse" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-2">
                    <h3
                      className={`text-base sm:text-lg font-extrabold truncate ${!b.is_read ? "" : "text-[var(--muted-foreground)]"}`}
                    >
                      {b.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)] shrink-0">
                      <Clock className="w-3 h-3" />
                      {timeAgo(b.created_at)}
                    </div>
                  </div>

                  <div className="mb-4">
                    <BroadcastMarkdown muted={b.is_read}>{b.body}</BroadcastMarkdown>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9.5px] font-black px-2.5 py-1 rounded-full bg-gradient-to-r ${toneCls} text-primary-foreground uppercase tracking-wider`}
                    >
                      {b.tone}
                    </span>
                    {!b.is_read ? (
                      <span className="text-[10px] font-bold text-[var(--primary)] flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" /> New — tap
                        to mark read
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[var(--muted-foreground)] flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" /> Read
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
