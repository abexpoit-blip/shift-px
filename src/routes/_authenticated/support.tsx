import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  LifeBuoy,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { createSupportTicket, listMyTickets, getSupportStatus } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support — Adspx" }] }),
  component: SupportPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function SupportPage() {
  const qc = useQueryClient();
  const status = useServerFn(getSupportStatus);
  const list = useServerFn(listMyTickets);
  const create = useServerFn(createSupportTicket);

  const statusQ = useQuery({
    queryKey: ["support-status"],
    queryFn: () => status(),
    staleTime: 60_000,
  });
  const ticketsQ = useQuery({ queryKey: ["my-tickets"], queryFn: () => list(), staleTime: 30_000 });

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const createMut = useMutation({
    mutationFn: (d: { subject: string; message: string }) => create({ data: d }),
    onSuccess: () => {
      toast.success("Message sent — we'll reply soon");
      setSubject("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  const enabled = statusQ.data?.enabled !== false;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return toast.error("Subject and message required");
    if (message.length > 4000) return toast.error("Message too long (max 4000 chars)");
    createMut.mutate({ subject: subject.trim(), message: message.trim() });
  }

  const tickets = ticketsQ.data ?? [];

  return (
    <div className="min-h-screen text-foreground" style={display}>
      <div className="fixed top-[-20%] left-[-10%] w-[55%] h-[55%] bg-[var(--primary)]/12 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-15%] w-[55%] h-[55%] bg-[var(--primary-glow)]/15 blur-[160px] rounded-full pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top bar */}
        <div className="rounded-2xl glass-card px-5 py-3 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="w-9 h-9 rounded-xl bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-gradient flex items-center justify-center shadow-md shadow-primary/10">
              <LifeBuoy className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[var(--foreground)] leading-tight">
                Support
              </h1>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Get help from the Adspx team
              </p>
            </div>
          </div>
        </div>

        {!enabled && (
          <div className="rounded-2xl glass-card p-5 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-foreground mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-foreground text-sm">
                Support is temporarily disabled
              </div>
              <div className="text-xs text-foreground mt-1">
                Our team has paused new tickets. Please check back later.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Send form */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl glass-card overflow-hidden">
              <div className="px-5 py-4 bg-primary/5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                  <h2 className="text-sm font-extrabold">Send a message</h2>
                </div>
                <p className="text-[10.5px] text-[var(--muted-foreground)] mt-1">
                  We typically reply within 24 hours.
                </p>
              </div>
              <form onSubmit={submit} className="p-5 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wide">
                    Subject
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Cannot create new link"
                    disabled={!enabled}
                    className="mt-1.5 w-full bg-muted/70 border border-border rounded-xl py-2.5 px-3 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]/50 focus:bg-card transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wide">
                      Message
                    </label>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {message.length}/4000
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
                    rows={8}
                    placeholder="Describe your issue in detail…"
                    disabled={!enabled}
                    className="mt-1.5 w-full bg-muted/70 border border-border rounded-xl py-2.5 px-3 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]/50 focus:bg-card transition-all resize-none disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!enabled || createMut.isPending}
                  className="w-full bg-primary-gradient text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-glow hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {createMut.isPending ? "Sending…" : "Send message"}
                </button>
              </form>
            </div>
          </div>

          {/* My tickets */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl glass-card overflow-hidden">
              <div className="px-5 py-4 bg-primary/5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[var(--primary)]" />
                  <h2 className="text-sm font-extrabold">My tickets</h2>
                </div>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {tickets.length} total
                </span>
              </div>

              <div className="divide-y divide-[var(--border)]/70 max-h-[640px] overflow-y-auto">
                {ticketsQ.isLoading && (
                  <div className="p-8 text-center text-xs text-[var(--muted-foreground)]">
                    Loading…
                  </div>
                )}
                {!ticketsQ.isLoading && tickets.length === 0 && (
                  <div className="p-10 text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center mb-3">
                      <MessageCircle className="w-6 h-6 text-[var(--muted-foreground)]" />
                    </div>
                    <div className="text-sm font-bold">No tickets yet</div>
                    <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      Your messages will appear here.
                    </div>
                  </div>
                )}
                {tickets.map((t) => (
                  <details key={t.id} className="group">
                    <summary className="px-5 py-4 cursor-pointer hover:bg-[var(--muted)]/70 list-none flex items-start gap-3">
                      <StatusBadge status={t.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[var(--foreground)] truncate">
                          {t.subject}
                        </div>
                        <div className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 mt-0.5">
                          {t.message}
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)] mt-1">
                          {timeAgo(t.created_at)}
                        </div>
                      </div>
                    </summary>
                    <div className="px-5 pb-5 pt-1 space-y-3">
                      <div className="rounded-xl bg-muted/60 border border-border p-3.5">
                        <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">
                          Your message
                        </div>
                        <div className="text-[12.5px] text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                          {t.message}
                        </div>
                      </div>
                      {t.admin_reply ? (
                        <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 p-3.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                              Adspx team reply
                            </span>
                            {t.replied_at && (
                              <span className="text-[10px] text-emerald-600/70 ml-auto">
                                {timeAgo(t.replied_at)}
                              </span>
                            )}
                          </div>
                          <div className="text-[12.5px] text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                            {t.admin_reply}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-muted/60 border border-border/70 p-3 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-foreground" />
                          <span className="text-[11px] text-foreground font-medium">
                            Awaiting reply from our team…
                          </span>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "replied") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[9.5px] font-extrabold uppercase tracking-wide">
        <CheckCircle2 className="w-3 h-3" /> Replied
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--muted-foreground)] text-[9.5px] font-extrabold uppercase tracking-wide">
        <XCircle className="w-3 h-3" /> Closed
      </span>
    );
  }
  return (
    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground text-[9.5px] font-extrabold uppercase tracking-wide">
      <Clock className="w-3 h-3" /> Open
    </span>
  );
}
