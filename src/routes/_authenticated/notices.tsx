import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Bell, Sparkles, Megaphone, Gift, AlertTriangle, Info, CheckCircle2,
  Crown, Zap, Rocket, Star, Trophy, CheckCheck, Clock
} from "lucide-react";
import { listActiveBroadcasts, markBroadcastRead, markAllBroadcastsRead } from "@/lib/broadcasts.functions";
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
};

const TONE_STYLES: Record<string, string> = {
  premium: "from-[var(--primary)] to-[var(--primary-glow)]",
  info: "from-blue-500 to-blue-600",
  success: "from-emerald-500 to-emerald-600",
  warning: "from-primary to-orange-600",
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-[10px] font-bold uppercase tracking-widest shadow-sm mb-3">
            <Bell className="w-3 h-3" /> Notifications
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--foreground)] tracking-tight">
            Broadcast <span className="text-[var(--primary)]">Inbox</span>
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Updates, announcements, and news from Adspx.</p>
        </div>
        {unreadCount > 0 && (
          <Button 
            onClick={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
            className="bg-card hover:bg-card/80 border-[var(--border)] text-[var(--muted-foreground)] shadow-sm font-bold text-xs h-10 px-4 rounded-xl gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {q.isLoading && (
          <div className="p-12 text-center text-[var(--muted-foreground)] animate-pulse font-medium">Loading inbox…</div>
        )}
        {!q.isLoading && items.length === 0 && (
          <div className="p-20 text-center bg-card/40 backdrop-blur-xl border border-border/60 rounded-[32px] shadow-sm shadow-primary/10">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--foreground)]">Your inbox is empty</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">We'll let you know when there's something new.</p>
          </div>
        )}

        {items.map((b) => {
          const Icon = ICON_MAP[b.icon] ?? Sparkles;
          const toneCls = TONE_STYLES[b.tone] ?? TONE_STYLES.premium;
          return (
            <div 
              key={b.id}
              onClick={() => !b.is_read && markMut.mutate(b.id)}
              className={`group relative overflow-hidden rounded-[28px] border transition-all duration-300 cursor-pointer ${
                !b.is_read 
                  ? "bg-card border-[var(--primary)]/20 shadow-lg shadow-primary/10 ring-1 ring-[var(--primary)]/5" 
                  : "bg-card/40 border-border/60 hover:bg-card/60"
              }`}
            >
              <div className="p-5 sm:p-6 flex gap-4 sm:gap-6">
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${toneCls} flex items-center justify-center text-primary-foreground shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  {!b.is_read && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--primary)] border-2 border-white shadow-md animate-pulse" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-2">
                    <h3 className={`text-base sm:text-lg font-extrabold truncate ${!b.is_read ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
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
                  
                  <div className="flex items-center gap-3">
                    {b.tone === "premium" && (
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full bg-gradient-to-r ${toneCls} text-primary-foreground shadow-sm uppercase tracking-wider`}>
                        ✨ Premium
                      </span>
                    )}
                    {!b.is_read && (
                      <span className="text-[10px] font-bold text-[var(--primary)] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                        New
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
