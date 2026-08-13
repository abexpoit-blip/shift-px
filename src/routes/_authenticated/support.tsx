import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  LifeBuoy, Send, Clock, CheckCircle2, XCircle, MessageCircle, ArrowLeft, Sparkles,
} from "lucide-react";
import {
  createSupportTicket, listMyTickets, getSupportStatus,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support — Sleepox" }] }),
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

  const statusQ = useQuery({ queryKey: ["support-status"], queryFn: () => status(), staleTime: 60_000 });
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
    <div className="min-h-screen bg-[#FFF9F5] text-[#2D1B0D]" style={display}>
      <div className="fixed top-[-20%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/12 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-15%] w-[55%] h-[55%] bg-[#FEB47B]/15 blur-[160px] rounded-full pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top bar */}
        <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-sm shadow-orange-900/5 px-5 py-3 flex items-center gap-3">
          <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-[#FFF9F5] border border-[#FFEDD5] flex items-center justify-center text-[#7D6452] hover:text-[#FF7E5F]">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-md shadow-orange-500/30">
              <LifeBuoy className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[#2D1B0D] leading-tight">Support</h1>
              <p className="text-[11px] text-[#A38D7D]">Get help from the Sleepox team</p>
            </div>
          </div>
        </div>

        {!enabled && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-amber-900 text-sm">Support is temporarily disabled</div>
              <div className="text-xs text-amber-700 mt-1">Our team has paused new tickets. Please check back later.</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Send form */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white border border-[#FFEDD5] shadow-sm shadow-orange-900/5 overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-[#FFF9F5] to-[#FFEDD5]/40 border-b border-[#FFEDD5]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF7E5F]" />
                  <h2 className="text-sm font-extrabold">Send a message</h2>
                </div>
                <p className="text-[10.5px] text-[#A38D7D] mt-1">We typically reply within 24 hours.</p>
              </div>
              <form onSubmit={submit} className="p-5 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-[#7D6452] uppercase tracking-wide">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Cannot create new link"
                    disabled={!enabled}
                    className="mt-1.5 w-full bg-[#FFF9F5]/70 border border-[#FFEDD5] rounded-xl py-2.5 px-3 text-sm placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#7D6452] uppercase tracking-wide">Message</label>
                    <span className="text-[10px] text-[#A38D7D]">{message.length}/4000</span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
                    rows={8}
                    placeholder="Describe your issue in detail…"
                    disabled={!enabled}
                    className="mt-1.5 w-full bg-[#FFF9F5]/70 border border-[#FFEDD5] rounded-xl py-2.5 px-3 text-sm placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white transition-all resize-none disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!enabled || createMut.isPending}
                  className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {createMut.isPending ? "Sending…" : "Send message"}
                </button>
              </form>
            </div>
          </div>

          {/* My tickets */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white border border-[#FFEDD5] shadow-sm shadow-orange-900/5 overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-[#FFF9F5] to-[#FFEDD5]/40 border-b border-[#FFEDD5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#FF7E5F]" />
                  <h2 className="text-sm font-extrabold">My tickets</h2>
                </div>
                <span className="text-[10px] text-[#A38D7D]">{tickets.length} total</span>
              </div>

              <div className="divide-y divide-[#FFEDD5]/70 max-h-[640px] overflow-y-auto">
                {ticketsQ.isLoading && (
                  <div className="p-8 text-center text-xs text-[#A38D7D]">Loading…</div>
                )}
                {!ticketsQ.isLoading && tickets.length === 0 && (
                  <div className="p-10 text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFF9F5] border border-[#FFEDD5] flex items-center justify-center mb-3">
                      <MessageCircle className="w-6 h-6 text-[#A38D7D]" />
                    </div>
                    <div className="text-sm font-bold">No tickets yet</div>
                    <div className="text-[11px] text-[#A38D7D] mt-1">Your messages will appear here.</div>
                  </div>
                )}
                {tickets.map((t) => (
                  <details key={t.id} className="group">
                    <summary className="px-5 py-4 cursor-pointer hover:bg-[#FFF9F5]/70 list-none flex items-start gap-3">
                      <StatusBadge status={t.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#2D1B0D] truncate">{t.subject}</div>
                        <div className="text-[11px] text-[#7D6452] line-clamp-1 mt-0.5">{t.message}</div>
                        <div className="text-[10px] text-[#A38D7D] mt-1">{timeAgo(t.created_at)}</div>
                      </div>
                    </summary>
                    <div className="px-5 pb-5 pt-1 space-y-3">
                      <div className="rounded-xl bg-[#FFF9F5] border border-[#FFEDD5] p-3.5">
                        <div className="text-[10px] font-bold text-[#A38D7D] uppercase tracking-wide mb-1.5">Your message</div>
                        <div className="text-[12.5px] text-[#2D1B0D] whitespace-pre-wrap leading-relaxed">{t.message}</div>
                      </div>
                      {t.admin_reply ? (
                        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-50/30 border border-emerald-200 p-3.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Sleepox team reply</span>
                            {t.replied_at && <span className="text-[10px] text-emerald-600/70 ml-auto">{timeAgo(t.replied_at)}</span>}
                          </div>
                          <div className="text-[12.5px] text-[#2D1B0D] whitespace-pre-wrap leading-relaxed">{t.admin_reply}</div>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-amber-50/60 border border-amber-200/70 p-3 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-[11px] text-amber-700 font-medium">Awaiting reply from our team…</span>
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
      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9.5px] font-extrabold uppercase tracking-wide">
        <CheckCircle2 className="w-3 h-3" /> Replied
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFEDD5] text-[#7D6452] text-[9.5px] font-extrabold uppercase tracking-wide">
        <XCircle className="w-3 h-3" /> Closed
      </span>
    );
  }
  return (
    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9.5px] font-extrabold uppercase tracking-wide">
      <Clock className="w-3 h-3" /> Open
    </span>
  );
}
