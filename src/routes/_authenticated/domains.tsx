import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import {
  Globe,
  Plus,
  Check,
  X,
  Copy,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Crown,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  Sparkles,
  Loader2,
  Lock,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  listCustomDomains,
  addCustomDomain,
  verifyCustomDomain,
  deleteCustomDomain,
} from "@/lib/custom-domains.functions";

export const Route = createFileRoute("/_authenticated/domains")({
  head: () => ({ meta: [{ title: "Custom Domains — AdsPx" }] }),
  component: DomainsPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;
const CNAME_TARGET = "cname.adspx.com";

// Registrar quick-links
const REGISTRARS = [
  { id: "cloudflare", label: "Cloudflare", url: "https://dash.cloudflare.com/" },
  { id: "namecheap", label: "Namecheap", url: "https://ap.www.namecheap.com/domains/list/" },
  { id: "godaddy", label: "GoDaddy", url: "https://dcc.godaddy.com/manage/dns" },
  { id: "namesilo", label: "Namesilo", url: "https://www.namesilo.com/account_domains.php" },
  { id: "hostinger", label: "Hostinger", url: "https://hpanel.hostinger.com/domains" },
  { id: "google", label: "Google Domains", url: "https://domains.google.com/registrar" },
];

function DomainsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomDomains);
  const addFn = useServerFn(addCustomDomain);
  const verifyFn = useServerFn(verifyCustomDomain);
  const deleteFn = useServerFn(deleteCustomDomain);

  const q = useQuery({
    queryKey: ["custom-domains"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const [newDomain, setNewDomain] = useState("");
  const [autoPollId, setAutoPollId] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (domain: string) => addFn({ data: { domain } }),
    onSuccess: (res: any) => {
      setNewDomain("");
      toast.success("Domain added! CNAME record check initiated.");
      qc.invalidateQueries({ queryKey: ["custom-domains"] });
      setAutoPollId(res.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add domain"),
  });

  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: (res: any, id) => {
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      qc.invalidateQueries({ queryKey: ["custom-domains"] });
      if (res.ok && autoPollId === id) setAutoPollId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Verification failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Domain removed from your account");
      qc.invalidateQueries({ queryKey: ["custom-domains"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete domain"),
  });

  if (q.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
        <span>Loading custom domains…</span>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <div className="p-8 rounded-3xl bg-destructive/10 border border-destructive/20 text-destructive">
          <h2 className="font-bold mb-2">Could not load domains</h2>
          <p className="text-sm">{(q.error as Error)?.message ?? "Unknown error"}</p>
          <button
            onClick={() => q.refetch()}
            className="mt-4 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const data = q.data;
  if (!data) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-[1280px] mx-auto text-foreground" style={display}>
      {/* Page Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 mb-2">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              Domain Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
            Branded Custom Domains
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 max-w-2xl">
            Connect your personal shortener domains with automatic Cloudflare SSL and policy shields.
          </p>
        </div>

        {data.isPaid && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Premium Feature Unlocked</span>
          </div>
        )}
      </header>

      {/* If FREE user, show VIP Upgrade Gate */}
      {!data.isPaid ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/40 via-card to-purple-950/30 border border-primary/30 p-8 sm:p-12 shadow-2xl space-y-8">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>VIP Feature</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Connect Your Own Domains with Zero Ad-Reject Risk
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Custom Domains is an exclusive feature for Pro & Premium members. Run isolated campaigns on your own brand names without sharing reputation with other users.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-card/60 border border-border/80 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-foreground">100% Domain Isolation</h3>
              <p className="text-xs text-muted-foreground">Other users' traffic won't affect your domain reputation on Facebook or TikTok.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card/60 border border-border/80 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Instant Automatic SSL</h3>
              <p className="text-xs text-muted-foreground">Free Cloudflare Edge SSL certificate issued automatically within 30 seconds.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card/60 border border-border/80 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Meta Domain Verification</h3>
              <p className="text-xs text-muted-foreground">Verify in your Meta Business Suite for ultimate boost approval trust.</p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              to="/upgrade"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 shadow-xl shadow-indigo-500/25 hover:scale-[1.02] transition-all"
            >
              <Crown className="w-4 h-4" />
              <span>Upgrade to Premium to Unlock</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Quick guide */}
          <QuickGuide />

          {/* Add domain form */}
          <section className="p-6 sm:p-8 rounded-3xl bg-card border border-border/80 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-base font-extrabold tracking-tight">Add a New Custom Domain</h2>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newDomain.trim() && !add.isPending) add.mutate(newDomain);
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-muted/40 border border-border focus-within:border-primary transition">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="go.yourdomain.com or yourbrand.link"
                  className="bg-transparent flex-1 outline-none text-sm text-foreground placeholder:text-muted-foreground font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                disabled={!newDomain.trim() || add.isPending}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-all"
              >
                {add.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {add.isPending ? "Connecting…" : "Connect Domain"}
              </button>
            </form>
            <p className="text-xs text-muted-foreground">
              Tip: You can use a root domain (e.g. <span className="font-mono text-foreground">mydeal.link</span>) or a subdomain (e.g. <span className="font-mono text-foreground">go.mysite.com</span>).
            </p>
          </section>

          {/* List of Domains */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">
              Your Connected Domains ({data.domains.length})
            </h2>

            {data.domains.length === 0 ? (
              <div className="p-12 rounded-3xl bg-card border border-dashed border-border/80 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary">
                  <Globe className="w-6 h-6" />
                </div>
                <p className="font-bold text-foreground">No custom domains connected yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Add your first domain above and point the CNAME record to start creating branded short links.
                </p>
              </div>
            ) : (
              data.domains.map((dom: any) => (
                <DomainCard
                  key={dom.id}
                  dom={dom}
                  verifyFn={verifyFn}
                  autoPoll={autoPollId === dom.id}
                  onStopPoll={() => setAutoPollId(null)}
                  onVerified={() => qc.invalidateQueries({ queryKey: ["custom-domains"] })}
                  onManualVerify={() => verify.mutate(dom.id)}
                  onDelete={() => {
                    if (confirm(`Remove ${dom.domain}? Any active short links using this domain will fallback to default.`))
                      del.mutate(dom.id);
                  }}
                  manualVerifying={verify.isPending && verify.variables === dom.id}
                />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function QuickGuide() {
  const [copied, setCopied] = useState(false);

  const copyTarget = () => {
    navigator.clipboard.writeText(CNAME_TARGET);
    setCopied(true);
    toast.success("CNAME target copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl bg-card border border-border/80 p-6 space-y-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-foreground text-base">How to Connect in 2 Minutes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Simple 3-step setup with zero Cloudflare configuration</p>
          </div>
        </div>

        <button
          onClick={copyTarget}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-bold transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>Copy CNAME: <span className="font-mono">{CNAME_TARGET}</span></span>
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
            1
          </div>
          <h4 className="font-bold text-sm text-foreground">Add DNS Record</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            In your domain DNS manager (Namecheap/GoDaddy), add a <strong>CNAME</strong> record pointing to <span className="font-mono text-foreground font-bold">{CNAME_TARGET}</span>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
            2
          </div>
          <h4 className="font-bold text-sm text-foreground">Connect on AdsPx</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter your domain name in the box below and click <strong>Connect Domain</strong>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
            3
          </div>
          <h4 className="font-bold text-sm text-foreground">Automatic SSL & Live</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cloudflare issues a free SSL certificate automatically. Status turns <strong>Active ✅</strong> within 1–3 minutes.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-border/50">
        <span className="text-xs text-muted-foreground font-semibold mr-1">Direct DNS Links:</span>
        {REGISTRARS.map((r) => (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-muted/40 border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
          >
            <span>{r.label}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/60" />
          </a>
        ))}
      </div>
    </div>
  );
}

function DomainCard({
  dom,
  verifyFn,
  autoPoll,
  onStopPoll,
  onVerified,
  onManualVerify,
  onDelete,
  manualVerifying,
}: {
  dom: any;
  verifyFn: (args: any) => Promise<any>;
  autoPoll: boolean;
  onStopPoll: () => void;
  onVerified: () => void;
  onManualVerify: () => void;
  onDelete: () => void;
  manualVerifying: boolean;
}) {
  const [open, setOpen] = useState(!dom.verified);
  const [status, setStatus] = useState<{
    txtOk: boolean;
    cnameOk: boolean;
    provider?: any;
    message?: string;
  } | null>(null);
  const [polling, setPolling] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!autoPoll || dom.verified) return;
    setPolling(true);
    attemptsRef.current = 0;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      attemptsRef.current += 1;
      try {
        const res = await verifyFn({ data: { id: dom.id } });
        if (cancelled) return;
        setStatus({
          txtOk: res.txtOk,
          cnameOk: res.cnameOk,
          provider: res.provider,
          message: res.message,
        });
        if (res.ok) {
          setPolling(false);
          onVerified();
          onStopPoll();
          return;
        }
      } catch {}

      if (attemptsRef.current < 20 && !cancelled) {
        setTimeout(tick, 6000);
      } else {
        setPolling(false);
        onStopPoll();
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [autoPoll, dom.verified, dom.id]);

  const runManual = async () => {
    try {
      const res = await verifyFn({ data: { id: dom.id } });
      setStatus({
        txtOk: res.txtOk,
        cnameOk: res.cnameOk,
        provider: res.provider,
        message: res.message,
      });
      if (res.ok) {
        toast.success(res.message);
        onVerified();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    }
  };

  const cnameName = dom.domain.includes(".") && dom.domain.split(".").length > 2 ? dom.domain.split(".")[0] : "@";

  return (
    <div className="rounded-3xl bg-card border border-border/80 p-5 sm:p-6 shadow-xl space-y-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${dom.verified ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-mono font-bold text-foreground">{dom.domain}</h3>
              {dom.verified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                  <Check className="w-3 h-3" />
                  <span>Active & SSL Ready</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
                  <RefreshCw className={`w-3 h-3 ${polling ? "animate-spin" : ""}`} />
                  <span>Pending DNS</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Added on {new Date(dom.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-3.5 py-1.5 rounded-xl bg-muted/40 border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
          >
            {open ? "Hide Details" : "View Setup"}
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Delete domain"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="pt-4 border-t border-border/60 space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Required DNS Record
            </h4>
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/70 space-y-3">
              <DnsRow type="CNAME" name={cnameName} value={CNAME_TARGET} live={dom.verified || status?.cnameOk} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={runManual}
                disabled={manualVerifying || polling}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${manualVerifying || polling ? "animate-spin" : ""}`} />
                <span>{manualVerifying || polling ? "Checking Cloudflare DNS…" : dom.verified ? "Re-verify" : "Check Now"}</span>
              </button>
              {status?.message && !dom.verified && (
                <span className="text-xs text-amber-400 font-medium">
                  {status.message}
                </span>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Target Origin: <span className="font-mono text-foreground">{CNAME_TARGET}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DnsRow({
  type,
  name,
  value,
  live,
}: {
  type: string;
  name: string;
  value: string;
  live?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success(`Copied ${key === "name" ? "Name" : "Target"}!`);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border/80 text-xs font-mono">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-bold">
          {type}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase text-muted-foreground font-sans font-bold">Host:</span>
          <span className="text-foreground font-bold">{name}</span>
          <button onClick={() => copy("name", name)} className="p-1 text-muted-foreground hover:text-primary">
            {copied === "name" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase text-muted-foreground font-sans font-bold">Target:</span>
          <span className="text-foreground font-bold">{value}</span>
          <button onClick={() => copy("value", value)} className="p-1 text-muted-foreground hover:text-primary">
            {copied === "value" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div>
        {live ? (
          <span className="inline-flex items-center gap-1 text-emerald-400 font-sans font-bold text-xs">
            <Check className="w-3.5 h-3.5" /> Live & Protected
          </span>
        ) : (
          <span className="text-muted-foreground font-sans text-xs">
            Waiting for DNS propagation
          </span>
        )}
      </div>
    </div>
  );
}
