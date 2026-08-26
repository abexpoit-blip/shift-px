import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  LifeBuoy,
  Send,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Sparkles,
  HelpCircle,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { createSupportTicket, listMyTickets, getSupportStatus } from "@/lib/support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "VIP Support & Help Center — AdsPx" },
      { name: "description", content: "24/7 Priority publisher support, ticket desk and technical assistance." }
    ],
  }),
  component: SupportPage,
});

const FAQS = [
  {
    q: "How does the $1.00 per 50,000 visits payout rate work?",
    a: "You earn a flat $0.02 for every 1,000 verified human clicks ($1.00 per 50,000 visits). All valid visits are automatically tallied into your balance in real time with zero country tier deductions."
  },
  {
    q: "How fast are Litecoin (LTC) crypto withdrawals processed?",
    a: "Withdrawals are processed directly over the Litecoin network. Once approved, the LTC transaction confirms within 2 to 5 minutes with virtually zero blockchain network fees."
  },
  {
    q: "How does the anti-bot cloaking shield protect my Facebook and Google ads?",
    a: "When Facebook or Google ad review crawlers inspect your short link, our shield delivers a 200 OK OpenGraph-compliant editorial news article with zero redirects, guaranteeing 100% ad approval."
  },
  {
    q: "Are sub-IDs and UTM tracking parameters preserved on redirect?",
    a: "Yes! All parameters including fbclid, gclid, ttclid, and utm_campaign are automatically forwarded and mapped directly to Adsterra and CPA network subids."
  }
];

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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const createMut = useMutation({
    mutationFn: (d: { subject: string; message: string }) => create({ data: d }),
    onSuccess: () => {
      toast.success("Support ticket submitted! Our team will respond shortly.");
      setSubject("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send ticket"),
  });

  const enabled = statusQ.data?.enabled !== false;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return toast.error("Please fill in both Subject and Message");
    if (message.length > 4000) return toast.error("Message is too long (max 4000 characters)");
    createMut.mutate({ subject: subject.trim(), message: message.trim() });
  }

  const tickets = ticketsQ.data ?? [];

  return (
    <div className="relative min-h-screen text-foreground space-y-8 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Ambient Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[450px] h-[450px] -top-20 -left-20 opacity-25" />
        <span className="orb orb-purple w-[400px] h-[400px] top-96 -right-20 opacity-20" />
      </div>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
            <LifeBuoy className="w-3 h-3" /> VIP Helpdesk
          </span>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mt-2 text-foreground">
            Publisher Support & Assistance
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            24/7 dedicated support desk, live ticket management and platform guides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Desk Online (Avg response &lt; 2h)
          </span>
        </div>
      </header>

      {/* Support Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 relative">
        {/* Ticket Submission Card */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl bg-card border border-border/80 p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-border/60">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-foreground">Create Support Ticket</h2>
                <p className="text-xs text-muted-foreground">Submit a direct inquiry to our technical team</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Subject / Topic</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Question regarding link redirection or payout"
                  disabled={!enabled}
                  className="rounded-xl h-11 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Message Details</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{message.length}/4000</span>
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
                  rows={6}
                  placeholder="Describe your issue or question in detail. Include any relevant short codes or URLs..."
                  disabled={!enabled}
                  className="rounded-xl text-sm font-medium resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={createMut.isPending || !enabled}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Send className="h-4 w-4" />
                {createMut.isPending ? "Submitting ticket..." : "Submit Ticket"}
              </Button>
            </form>
          </div>

          {/* Ticket History */}
          <div className="rounded-3xl bg-card border border-border/80 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Your Tickets & Conversations
              </h3>
              <span className="text-xs font-bold text-muted-foreground">{tickets.length} total</span>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs font-medium space-y-2">
                <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <p>No tickets submitted yet. Any inquiries you send will appear here with live admin replies.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((t: any) => {
                  const isReplied = t.status === "replied" || !!t.admin_reply;
                  const isClosed = t.status === "closed";

                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isReplied
                          ? "bg-card border-indigo-500/30 shadow-lg shadow-indigo-500/5"
                          : isClosed
                            ? "bg-muted/20 border-border/50 opacity-80"
                            : "bg-muted/10 border-border/80"
                      }`}
                    >
                      {/* Ticket Header Bar */}
                      <div className="p-4.5 bg-muted/20 border-b border-border/40 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-foreground">
                              {t.subject}
                            </span>
                            {isReplied ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Official Reply Ready</span>
                              </span>
                            ) : isClosed ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                                <XCircle className="w-3 h-3" />
                                <span>Closed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                                <Clock className="w-3 h-3" />
                                <span>Awaiting Response</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground block">
                            Ticket ID: <span className="font-mono text-foreground/80">{t.id.slice(0, 8)}</span> • Submitted {t.created_at ? new Date(t.created_at).toLocaleString() : "recently"}
                          </span>
                        </div>
                      </div>

                      {/* Ticket Body / Conversation */}
                      <div className="p-4.5 space-y-4">
                        {/* 1. User Question Box */}
                        <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                            <span className="flex items-center gap-1.5 text-foreground/90">
                              <MessageCircle className="w-3.5 h-3.5 text-primary" /> Your Inquiry:
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {t.message}
                          </p>
                        </div>

                        {/* 2. Admin Official Reply Box */}
                        {t.admin_reply ? (
                          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-blue-500/10 border border-indigo-500/30 space-y-3 relative overflow-hidden shadow-inner">
                            <div className="flex items-center justify-between gap-2 border-b border-indigo-500/20 pb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-indigo-500/30">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <span className="font-black text-xs text-indigo-300 uppercase tracking-wide">
                                    AdsPx Official Support Desk
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {t.replied_at ? new Date(t.replied_at).toLocaleString() : "Official Answer"}
                              </span>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap font-sans">
                              {t.admin_reply}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-400">
                            <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                            <span>Your inquiry is in queue. A dedicated support specialist is reviewing your request.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Help & FAQ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Support Card */}
          <div className="rounded-3xl bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-indigo-500/25 p-6 space-y-4 shadow-xl relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center gap-2.5 text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
              <Zap className="h-4 w-4" /> Instant Assistance
            </div>
            <h3 className="font-black text-lg text-foreground leading-snug">
              Need immediate priority onboarding?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our direct support managers are available around the clock to assist high-volume publishers with custom domains, CPA configurations, and payouts.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Guaranteed 100% Link Uptime
              </span>
            </div>
          </div>

          {/* Quick FAQs */}
          <div className="rounded-3xl bg-card border border-border/80 p-6 space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2 pb-2 border-b border-border/60">
              <HelpCircle className="h-4 w-4 text-primary" /> Frequently Asked Questions
            </h3>

            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div key={i} className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 space-y-2">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between text-left gap-2 text-xs font-bold text-foreground"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/40 animate-in fade-in duration-150">
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
