import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy, Trash2, Play, Pause, Plus, Search, ArrowRight, Filter, RefreshCw,
  Shield, ShieldCheck, Link2, Sparkles, FileText,
} from "lucide-react";

import { getDashboardData, refreshDashboardData, createLink, deleteLink, toggleLink, updateSafeUrl } from "@/lib/links.functions";
import { getPrimaryShortenerDomain } from "@/lib/shortener-domains.functions";
import { DEFAULT_SHORT_HOST, isFlaggedShortDomain } from "@/lib/short-domains";
import { CountryShieldDialog } from "@/components/CountryShieldDialog";

export const Route = createFileRoute("/_authenticated/links")({
  head: () => ({
    meta: [
      { title: "Smart links — Adspx" },
      { name: "description", content: "Create, pause and manage your Adspx smart links. Lifetime click totals are stored forever." },
      { property: "og:title", content: "Smart links — Adspx" },
      { property: "og:description", content: "Create, pause and manage your Adspx smart links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LinksPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;
const fieldCls =
  "w-full bg-muted/70 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-card transition-all";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"rounded-2xl glass-card " + className}>{children}</div>;
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">{label}</label>
      {children}
    </div>
  );
}

function formatRelativeTime(iso: string) {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LinksPage() {
  const qc = useQueryClient();
  const dash = useServerFn(getDashboardData);
  const refreshDash = useServerFn(refreshDashboardData);
  const create = useServerFn(createLink);
  const remove = useServerFn(deleteLink);
  const toggle = useServerFn(toggleLink);

  const dashQ = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshDash(),
    onSuccess: (data) => {
      qc.setQueryData(["dashboard"], data);
      toast.success("Links updated");
    },
    onError: (e: Error) => toast.error(e.message || "Refresh failed"),
  });

  const [adsterra, setAdsterra] = useState("");
  const [safe, setSafe] = useState("");
  const [safeMode, setSafeMode] = useState<"auto" | "custom">("auto");
  const [title, setTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const createMut = useMutation({
    mutationFn: (vars: { title?: string; adsterra_url: string; safe_url?: string }) => create({ data: vars }),
    onSuccess: () => {
      toast.success("Link created");
      setAdsterra(""); setSafe(""); setTitle(""); setSafeMode("auto"); setShowCreate(false);
      refreshMut.mutate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refreshMut.mutate(); },
  });
  const togMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => refreshMut.mutate(),
  });

  const saveSafe = useServerFn(updateSafeUrl);
  const safeMut = useMutation({
    mutationFn: (v: { id: string; safe_url: string | null }) => saveSafe({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.safe_url ? "Safe page saved" : "Reverted to built-in article");
      setSafeFor(null);
      refreshMut.mutate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save safe page"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate({ title: title || undefined, adsterra_url: adsterra, safe_url: safeMode === "custom" && safe ? safe : undefined });
  };

  const primaryFn = useServerFn(getPrimaryShortenerDomain);
  const primaryQ = useQuery({
    queryKey: ["primary-shortener-domain"],
    queryFn: () => primaryFn(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const rawPrimary = primaryQ.data?.domain ?? DEFAULT_SHORT_HOST;
  const primaryDomain = isFlaggedShortDomain(rawPrimary) || rawPrimary === "adspx.com" ? DEFAULT_SHORT_HOST : rawPrimary;

  const [origin, setOrigin] = useState(`https://${primaryDomain}`);
  useEffect(() => { setOrigin(`https://${primaryDomain}`); }, [primaryDomain]);

  const links = dashQ.data?.links ?? [];
  const stats = dashQ.data?.stats;
  const profile = dashQ.data?.profile;
  const [shieldFor, setShieldFor] = useState<null | { id: string; title: string; initial: string[] }>(null);
  const [safeFor, setSafeFor] = useState<null | { id: string; title: string; current: string }>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        (l.title ?? "").toLowerCase().includes(q) ||
        l.short_code.toLowerCase().includes(q) ||
        (l.adsterra_url ?? "").toLowerCase().includes(q),
    );
  }, [links, search]);

  const activeLinks = links.filter((l) => l.is_active).length;

  return (
    <div className="min-h-screen w-full text-foreground" style={display}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2" style={display}>
              <Link2 className="w-6 h-6 text-primary" /> Smart links
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeLinks} active · {links.length} total · lifetime click totals are stored permanently.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search links..."
                className="w-full bg-muted/70 border border-border rounded-xl py-2.5 pl-11 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-card transition-all"
              />
            </div>
            <button
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
              title="Refresh links"
              className="w-10 h-10 rounded-xl border border-border text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* CTA */}
        <button onClick={() => setShowCreate((v) => !v)}
          className="w-full group relative overflow-hidden rounded-2xl bg-primary-gradient p-5 flex items-center gap-4 shadow-xl shadow-glow hover:shadow-2xl transition-all">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 blur-3xl rounded-full pointer-events-none" />
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-white font-bold text-[15px]" style={display}>Create new smart link</h4>
            <p className="text-white/85 text-xs mt-0.5">Setup advanced redirection & cloaking</p>
          </div>
          <span className="hidden sm:flex items-center gap-1.5 bg-white text-primary px-4 py-2 rounded-lg font-bold text-xs group-hover:scale-105 transition-transform">
            Quick Start <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>

        {showCreate && (
          <Panel className="overflow-hidden">
            <div className="relative px-6 py-5 border-b border-border overflow-hidden">
              <div className="absolute -top-16 -right-10 w-52 h-52 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary-gradient flex items-center justify-center shadow-lg shadow-glow">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight" style={display}>New smart link</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Direct link in, protected short link out — bots never see your offer.</p>
                </div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="p-6 grid gap-5 sm:grid-cols-2">
              <Field label="Title (optional)" full>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My ad campaign" className={fieldCls} />
              </Field>

              <Field label="Direct link *" full>
                <div className="relative">
                  <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  <input
                    type="url"
                    required
                    value={adsterra}
                    onChange={(e) => setAdsterra(e.target.value)}
                    placeholder="https://your-direct-link.com/..."
                    className={fieldCls + " pl-11"}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Paste any direct link (Adsterra, offer page, affiliate URL).</p>
              </Field>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">Your own safe page / landing page (optional)</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setSafeMode("auto"); setSafe(""); }}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      safeMode === "auto"
                        ? "border-primary/60 bg-primary/10 shadow-lg shadow-glow"
                        : "border-border bg-muted/50 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`w-4 h-4 ${safeMode === "auto" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-bold">Built-in safe article</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">We serve a real, indexable article page (200 OK) to crawlers automatically.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSafeMode("custom")}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      safeMode === "custom"
                        ? "border-primary/60 bg-primary/10 shadow-lg shadow-glow"
                        : "border-border bg-muted/50 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${safeMode === "custom" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-bold">My own article URL</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">Use your own safe page / blog article instead of ours.</p>
                  </button>
                </div>

                {safeMode === "custom" && (
                  <div className="mt-3">
                    <input
                      type="url"
                      required
                      value={safe}
                      onChange={(e) => setSafe(e.target.value)}
                      placeholder="https://yoursite.com/my-article"
                      className={fieldCls}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Must be a live page with real content — bots, Facebook/Meta reviewers and Google will land here.
                    </p>
                  </div>
                )}
                {safeMode === "auto" && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Leave empty and we rotate our built-in safe article pool for this link. You can add your own page later at any time.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-1">
                <button type="submit" disabled={createMut.isPending}
                  className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-primary-gradient shadow-lg shadow-glow hover:scale-[1.02] transition-transform disabled:opacity-50">
                  {createMut.isPending ? "Creating…" : "Create link"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground border border-border hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        )}


        <Panel className="overflow-hidden">
          <div className="p-5 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h4 className="text-lg font-bold text-foreground" style={display}>All links</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Showing {filtered.length} of {links.length}
                {(dashQ.data as any)?._cachedAt && (
                  <span className="ml-2 text-muted-foreground/70">· Updated {formatRelativeTime((dashQ.data as any)._cachedAt)}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {dashQ.isLoading && <div className="py-16 text-center text-sm text-muted-foreground">Loading links…</div>}
          {!dashQ.isLoading && filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {search ? "No links match." : "No links yet — click Create new smart link above."}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[480px] table-fixed">
                <colgroup>
                  <col className="w-[44px]" />
                  <col />
                  <col className="w-[80px]" />
                  <col className="hidden sm:table-column w-[90px]" />
                  <col className="w-[160px]" />
                </colgroup>
                <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-y border-border">
                  <tr>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all visible links"
                        checked={filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(new Set(filtered.map((l) => l.id)));
                          else setSelectedIds(new Set());
                        }}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </th>
                    <th className="px-3 sm:px-5 py-3 font-bold">Campaign</th>
                    <th className="px-3 py-3 font-bold">Clicks</th>
                    <th className="hidden sm:table-cell px-3 py-3 font-bold">Status</th>
                    <th className="px-3 sm:px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((l) => {
                    const shortUrl = `${origin}/${l.short_code}`;
                    const isSelected = selectedIds.has(l.id);
                    return (
                      <tr key={l.id} className={`hover:bg-muted transition-colors ${isSelected ? "bg-muted" : ""}`}>
                        <td className="px-3 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Select ${l.title || l.short_code}`}
                            checked={isSelected}
                            onChange={() => toggleSelect(l.id)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-3 sm:px-5 py-4 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate" style={display}>{l.title || l.short_code}</p>
                          <button onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                            className="text-[11px] text-primary hover:text-primary flex items-center gap-1 mt-0.5 font-mono truncate max-w-full">
                            <span className="truncate">{primaryDomain}/{l.short_code}</span> <Copy className="w-3 h-3 shrink-0" />
                          </button>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm font-bold text-foreground tabular-nums" style={display}>
                            {(l.clicks_count || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-4">
                          <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                            className={l.is_active
                              ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"
                              : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"}>
                            {l.is_active ? "ACTIVE" : "PAUSED"}
                          </button>
                        </td>
                        <td className="px-3 sm:px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-0.5 sm:gap-1">
                            <button
                              title="Country Shield"
                              onClick={() => setShieldFor({ id: l.id, title: l.title || l.short_code, initial: (l as any).blocked_countries ?? [] })}
                              className={`relative p-1.5 rounded-lg hover:bg-border/60 shrink-0 ${
                                (l as any).blocked_countries?.length > 0 ? "text-primary" : "text-muted-foreground hover:text-primary"
                              }`}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              title={(l as any).safe_url ? "Custom safe page set" : "Safe page (built-in article)"}
                              onClick={() => setSafeFor({ id: l.id, title: l.title || l.short_code, current: (l as any).safe_url ?? "" })}
                              className={`p-1.5 rounded-lg hover:bg-border/60 shrink-0 ${
                                (l as any).safe_url ? "text-amber-500" : "text-muted-foreground hover:text-primary"
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <a href={shortUrl} target="_blank" rel="noopener noreferrer"
                              title={`Verify ${primaryDomain}/${l.short_code}`}
                              className="text-muted-foreground hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 shrink-0">
                              <ShieldCheck className="w-4 h-4" />
                            </a>
                            <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                              className="text-muted-foreground hover:text-primary p-1.5 rounded-lg hover:bg-border/60 shrink-0">
                              {l.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}
                              className="text-muted-foreground hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="text-xs text-muted-foreground">
          Storage policy: raw per-click logs are trimmed weekly to keep the platform fast, but every link's
          lifetime click and earning totals are archived permanently — nothing you earned is ever lost.
        </p>
      </div>

      {shieldFor && (
        <CountryShieldDialog
          open={!!shieldFor}
          onOpenChange={(o) => { if (!o) setShieldFor(null); }}
          linkId={shieldFor.id}
          linkTitle={shieldFor.title}
          initial={shieldFor.initial}
          planSlug={(profile as any)?.plan_slug}
        />
      )}

      {safeFor && <SafePageDialog entry={safeFor} onClose={() => setSafeFor(null)} pending={safeMut.isPending} onSave={(url) => safeMut.mutate({ id: safeFor.id, safe_url: url })} />}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-2xl bg-foreground text-background shadow-2xl border border-primary/40 max-w-[95vw] flex-wrap justify-center">
          <span className="text-xs font-bold whitespace-nowrap">{selectedIds.size} selected</span>
          <button
            onClick={() => {
              const urls = links.filter((l) => selectedIds.has(l.id)).map((l) => `https://${primaryDomain}/${l.short_code}`).join("\n");
              navigator.clipboard.writeText(urls);
              toast.success(`Copied ${selectedIds.size} short URL${selectedIds.size === 1 ? "" : "s"}`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-gradient text-white font-bold text-xs shadow-lg hover:opacity-90"
          >
            <Copy className="w-3.5 h-3.5" /> Copy URLs
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[11px] font-bold opacity-70 hover:opacity-100 px-2 py-1">
            Clear
          </button>
        </div>
      )}

      {stats == null && null}
    </div>
  );
}

function SafePageDialog({
  entry, onClose, onSave, pending,
}: {
  entry: { id: string; title: string; current: string };
  onClose: () => void;
  onSave: (url: string | null) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState(entry.current);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl glass-card p-6 space-y-4" onClick={(e) => e.stopPropagation()} style={display}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-gradient flex items-center justify-center shadow-lg shadow-glow">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold tracking-tight truncate">Safe page</h3>
            <p className="text-[11px] text-muted-foreground truncate">{entry.title}</p>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            Your own safe page / landing page (optional)
          </label>
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://yoursite.com/my-article"
            className={fieldCls}
          />
          <p className="text-[11px] text-muted-foreground mt-2">
            When set, every bot — including Facebook/Meta crawlers and ad reviewers — lands on this exact page,
            so the link preview and the reviewer see the same content. Leave empty to use our built-in rotating article.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            disabled={pending || !value.trim()}
            onClick={() => onSave(value.trim())}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-primary-gradient shadow-lg shadow-glow disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save safe page"}
          </button>
          <button
            disabled={pending}
            onClick={() => onSave(null)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground border border-border hover:bg-muted disabled:opacity-50"
          >
            Use built-in article
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
