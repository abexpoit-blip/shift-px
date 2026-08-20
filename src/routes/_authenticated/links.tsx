import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  Link2,
  Sparkles,
  Check,
  Flame,
  Zap,
  ExternalLink,
  Edit2,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

import {
  getDashboardData,
  refreshDashboardData,
  createLink,
  updateLink,
  deleteLink,
  toggleLink,
} from "@/lib/links.functions";
import { getPrimaryShortenerDomain } from "@/lib/shortener-domains.functions";
import { DEFAULT_SHORT_HOST, isFlaggedShortDomain } from "@/lib/short-domains";

export const Route = createFileRoute("/_authenticated/links")({
  head: () => ({
    meta: [
      { title: "Smart links — AdsPx" },
      {
        name: "description",
        content: "Create and manage your AdsPx smart links. Lifetime click totals are stored permanently.",
      },
    ],
  }),
  component: LinksPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-card border border-border/80 shadow-xl transition-all ${className}`}
    >
      {children}
    </div>
  );
}

function EditLinkModal({
  link,
  onClose,
  onSaved,
}: {
  link: { id: string; title: string | null; adsterra_url?: string | null; short_code: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(link.title || "");
  const [adsterra, setAdsterra] = useState(link.adsterra_url || "");
  const updateFn = useServerFn(updateLink);

  const editMut = useMutation({
    mutationFn: () => updateFn({ data: { id: link.id, title: title.trim() || undefined, adsterra_url: adsterra.trim() } }),
    onSuccess: () => {
      toast.success("Link updated successfully!");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update link"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!adsterra.trim()) {
      toast.error("Please enter a destination / Adsterra URL");
      return;
    }
    editMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Edit2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-foreground">Edit Link</h3>
              <p className="text-xs text-muted-foreground font-mono">/{link.short_code}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Link Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Facebook Campaign #1"
              className="w-full bg-muted/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Destination / Adsterra URL *</label>
            <input
              type="url"
              required
              value={adsterra}
              onChange={(e) => setAdsterra(e.target.value)}
              placeholder="https://..."
              className="w-full bg-muted/50 border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editMut.isPending}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 shadow-glow"
            >
              {editMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
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
  const [title, setTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [editingLink, setEditingLink] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (vars: { title?: string; adsterra_url: string }) => create({ data: vars }),
    onSuccess: () => {
      toast.success("Link created successfully!");
      setAdsterra("");
      setTitle("");
      setShowCreate(false);
      refreshMut.mutate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Link deleted");
      refreshMut.mutate();
    },
  });

  const togMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => refreshMut.mutate(),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!adsterra.trim()) return;
    createMut.mutate({
      title: title.trim() || undefined,
      adsterra_url: adsterra.trim(),
    });
  };

  const primaryFn = useServerFn(getPrimaryShortenerDomain);
  const primaryQ = useQuery({
    queryKey: ["primary-shortener-domain"],
    queryFn: () => primaryFn(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const rawPrimary = primaryQ.data?.domain ?? DEFAULT_SHORT_HOST;
  const primaryDomain =
    isFlaggedShortDomain(rawPrimary) || rawPrimary === "adspx.com"
      ? DEFAULT_SHORT_HOST
      : rawPrimary;

  const links = dashQ.data?.links ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l: any) =>
        (l.title ?? "").toLowerCase().includes(q) ||
        l.short_code.toLowerCase().includes(q) ||
        (l.adsterra_url ?? "").toLowerCase().includes(q),
    );
  }, [links, search]);

  const activeLinks = links.filter((l: any) => l.is_active).length;

  const copyLink = (url: string, code: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      toast.success("Short URL copied to clipboard!");
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  return (
    <div className="min-h-screen w-full text-foreground pb-12" style={display}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 mb-2">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Link Manager
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Link2 className="w-7 h-7 text-primary" /> Smart Short Links
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {activeLinks} Active · {links.length} Total · 100% human traffic redirection with Facebook review shield
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative min-w-[200px] sm:min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search links by code, title..."
                className="w-full bg-card border border-border/80 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
              />
            </div>
            <button
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
              title="Refresh links"
              className="w-10 h-10 rounded-xl border border-border/80 bg-card text-muted-foreground hover:text-primary hover:border-primary/50 flex items-center justify-center transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Link</span>
            </button>
          </div>
        </header>

        {/* Create Link Panel */}
        {showCreate && (
          <Panel className="p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">Create New Protected Link</h3>
                <p className="text-xs text-muted-foreground">Direct link in, protected short link out — bots never see your offer.</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Link Title (Optional)</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Meta Ads Campaign #1"
                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-xs sm:text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Destination / Offer URL *</label>
                  <input
                    required
                    type="url"
                    value={adsterra}
                    onChange={(e) => setAdsterra(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || !adsterra.trim()}
                  className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:opacity-90 shadow-glow"
                >
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Generate Short Link
                </button>
              </div>
            </form>
          </Panel>
        )}

        {/* Links Table (100% width, no horizontal scroll bar) */}
        <Panel className="p-0 overflow-hidden">
          <div className="w-full">
            <table className="w-full text-left text-xs sm:text-sm border-collapse table-auto">
              <thead>
                <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground font-bold">
                  <th className="px-4 sm:px-6 py-3.5 font-extrabold text-foreground">Campaign / Short URL</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center font-extrabold text-foreground">Human Clicks</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center font-extrabold text-foreground">Status</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right font-extrabold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-muted-foreground">
                      <Link2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="font-bold">No short links found</p>
                      <p className="text-xs mt-1">Create your first link above to start redirecting traffic and earning.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((l: any) => {
                    const shortUrl = `https://${primaryDomain}/${l.short_code}`;
                    const clicks = Number(l.clicks_count || 0);
                    const isHot = clicks >= 100;

                    return (
                      <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                        {/* Campaign & URL */}
                        <td className="px-4 sm:px-6 py-4">
                          <div className="space-y-1">
                            <div className="font-bold text-foreground text-sm flex items-center gap-2">
                              <span>{l.title || "Untitled Link"}</span>
                              {isHot && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.2 text-[10px] font-bold">
                                  <Flame className="h-3 w-3 fill-current" /> Hot
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-primary font-semibold">
                                /{l.short_code}
                              </span>
                              <button
                                onClick={() => copyLink(shortUrl, l.short_code)}
                                title="Copy Full Short URL"
                                className="h-6 px-2 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-mono flex items-center gap-1 transition-colors"
                              >
                                {copiedCode === l.short_code ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-500" />
                                    <span className="text-emerald-500 font-bold">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span>Copy URL</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Clicks */}
                        <td className="px-4 sm:px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 font-mono font-black text-base text-foreground">
                            {isHot && <Flame className="w-4 h-4 text-orange-500" />}
                            {clicks.toLocaleString()}
                          </span>
                        </td>

                        {/* Status Toggle Switch */}
                        <td className="px-4 sm:px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                            role="switch"
                            aria-checked={l.is_active}
                            className="inline-flex items-center gap-2 focus:outline-none"
                          >
                            <span
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                l.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                  l.is_active ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </span>
                            <span className={`text-xs font-bold uppercase ${l.is_active ? "text-emerald-500" : "text-muted-foreground"}`}>
                              {l.is_active ? "Active" : "Paused"}
                            </span>
                          </button>
                        </td>

                        {/* Action Buttons: Open, Edit, Delete */}
                        <td className="px-4 sm:px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* Open in new tab */}
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Test / Visit Short URL"
                              className="h-8 w-8 rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40 flex items-center justify-center transition-all shadow-sm"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            {/* Edit Link */}
                            <button
                              onClick={() => setEditingLink(l)}
                              title="Edit Link Details"
                              className="h-8 w-8 rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 flex items-center justify-center transition-all shadow-sm"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Link */}
                            <button
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this short link?")) {
                                  delMut.mutate(l.id);
                                }
                              }}
                              title="Delete Link"
                              className="h-8 w-8 rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-rose-500 hover:border-rose-500/40 flex items-center justify-center transition-all shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <p className="text-xs text-muted-foreground text-center">
          Storage policy: Link statistics and lifetime verified click totals are stored permanently in the platform ledger.
        </p>
      </div>

      {/* Edit Modal */}
      {editingLink && (
        <EditLinkModal
          link={editingLink}
          onClose={() => setEditingLink(null)}
          onSaved={() => refreshMut.mutate()}
        />
      )}
    </div>
  );
}
