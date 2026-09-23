import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  generateGoogleShort,
  getGoogleShortsList,
  deleteGoogleShort,
  type GoogleShortItem,
} from "@/lib/google-link.functions";
import { listShortenerDomains } from "@/lib/shortener-domains.functions";
import { GoogleGIcon } from "@/components/GoogleGIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Copy,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  Zap,
  Flame,
  Globe,
  RefreshCw,
  Clock,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/google-shorts")({
  component: GoogleShortsPage,
});

function GoogleShortsPage() {
  const queryClient = useQueryClient();
  const getListFn = useServerFn(getGoogleShortsList);
  const generateFn = useServerFn(generateGoogleShort);
  const deleteFn = useServerFn(deleteGoogleShort);
  const listDomainsFn = useServerFn(listShortenerDomains);

  const { data: state, isLoading, isRefetching } = useQuery({
    queryKey: ["user-google-shorts-list"],
    queryFn: () => getListFn(),
  });

  const domainsQ = useQuery({
    queryKey: ["sd-list"],
    queryFn: () => listDomainsFn(),
    staleTime: 30_000,
  });

  const availableDomains = useMemo(() => {
    const fromDb = (domainsQ.data?.domains ?? [])
      .filter((d: any) => d.is_active)
      .map((d: any) => d.domain);
    const combined = ["adswapx.com", ...fromDb, "dovtv.com"];
    return Array.from(new Set(combined.filter(Boolean)));
  }, [domainsQ.data]);

  const [offerUrl, setOfferUrl] = useState("");
  const [domain, setDomain] = useState("adswapx.com");
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<{
    googleUrl: string;
    shareGoogleUrl?: string;
    destinationShortUrl: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string, labelText = "Link") => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
      setCopiedId(id);
      toast.success(`${labelText} copied!`);
      setTimeout(() => setCopiedId(null), 2200);
    } catch {
      toast.error("Clipboard copy failed");
    }
  };

  const fallbackCopy = (text: string) => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  };

  const generateMut = useMutation({
    mutationFn: (data: { offerUrl: string; domain?: string; notes?: string }) =>
      generateFn({ data }),
    onSuccess: (res: any) => {
      setResult({
        googleUrl: res.googleUrl,
        shareGoogleUrl: res.shareGoogleUrl,
        destinationShortUrl: res.destinationShortUrl,
      });
      setOfferUrl("");
      setLabel("");
      toast.success("Google Short Link generated successfully!");
      queryClient.invalidateQueries({ queryKey: ["user-google-shorts-list"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to generate Google Short"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Link deleted");
      queryClient.invalidateQueries({ queryKey: ["user-google-shorts-list"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete link"),
  });

  const links = state?.links ?? [];
  const totalCleanClicks = links.reduce((sum, l) => sum + (l.clicks_count || 0), 0);
  const totalShieldedBots = links.reduce((sum, l) => sum + (l.bot_clicks_count || 0), 0);
  const totalTraffic = totalCleanClicks + totalShieldedBots;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-2 sm:px-4 pb-12">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-400">
                <GoogleGIcon className="h-3.5 w-3.5" /> High Deliverability
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Smart Bot Shield Active
              </span>
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-bold text-purple-400">
                DA 100 Google Infrastructure
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-foreground flex items-center gap-3">
              <GoogleGIcon className="h-8 w-8 sm:h-9 sm:w-9" />
              <span>Google Shorts</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Create high-authority links backed by Google&apos;s global infrastructure. Designed for maximum click-through rates, clean preview cards on social networks, and zero traffic loss.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["user-google-shorts-list"] })}
              className="h-9 gap-1.5 text-xs font-semibold"
              disabled={isLoading || isRefetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh Stats
            </Button>
          </div>
        </div>
      </div>

      {/* Feature Highlights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-blue-400">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Globe className="h-4 w-4 text-blue-400" />
            </div>
            Social Reach Optimized
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Links originate from Google&apos;s high-authority domain, ensuring smooth link sharing and rich OpenGraph cards across Facebook, Instagram, and chat apps.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            Zero Traffic Loss
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Ultra-light bounce engine hands off verified visitors in &lt;50ms directly to your CPA destination offer with full referrer preservation.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-purple-400">
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
            </div>
            Auditor Protection
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Automated crawlers and review bots receive compliant safe content, shielding your direct campaigns from policy flags and link blocks.
          </p>
        </div>
      </div>

      {/* 1-Click Generator Form */}
      <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 via-card to-card p-6 sm:p-7 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-md shadow-emerald-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Create Google Short Link</h2>
              <p className="text-xs text-muted-foreground">Paste your destination CPA offer to generate a Google-powered link</p>
            </div>
          </div>
          <div className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Active Engine: {domain}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Destination URL */}
          <div className="md:col-span-6 space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Your Offer / CPA Direct Link</span>
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={offerUrl}
              onChange={(e) => setOfferUrl(e.target.value)}
              placeholder="https://your-cpa-network.com/direct-link or https://..."
              className="text-xs font-mono h-11 border-border/80 focus:border-emerald-500 bg-background/70"
            />
          </div>

          {/* Cloaking Domain */}
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Cloak Domain</Label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background/70 px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {availableDomains.map((d) => (
                <option key={d} value={d}>
                  {d} {d === "adswapx.com" ? "(Primary)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Label */}
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Campaign Name (Optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. VIP Ad Campaign #1"
              className="text-xs h-11 border-border/80 bg-background/70"
            />
          </div>
        </div>

        <Button
          className="w-full h-11 text-sm font-bold gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20 border-0"
          disabled={!offerUrl.trim() || generateMut.isPending}
          onClick={() =>
            generateMut.mutate({
              offerUrl: offerUrl.trim(),
              domain,
              notes: label.trim() || undefined,
            })
          }
        >
          {generateMut.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating Google Short...
            </>
          ) : (
            <>
              <GoogleGIcon className="h-4 w-4" /> Generate Google Short Link
            </>
          )}
        </Button>

        {/* Result Card */}
        {result && (
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-emerald-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Ready to Use on Facebook &amp; Social
              </span>
              <span className="text-[11px] font-mono text-emerald-300/80 font-bold">
                DA 100 Whitelisted Domain
              </span>
            </div>

            {/* Primary Google Link */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Official Google Domain Link:
              </span>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={result.googleUrl}
                  className="font-mono text-xs h-11 bg-background/80 text-emerald-300 border-emerald-500/40 select-all font-bold"
                />
                <Button
                  className="h-11 px-5 text-xs font-bold gap-2 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  onClick={() => copyToClipboard(result.googleUrl, "res-main", "Google Link")}
                >
                  {copiedId === "res-main" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedId === "res-main" ? "Copied!" : "Copy Google Link"}
                </Button>
              </div>
            </div>

            {/* Alternative share.google Link */}
            {result.shareGoogleUrl && (
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Alternative Google Link (share.google):
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={result.shareGoogleUrl}
                    className="font-mono text-xs h-10 bg-background/80 text-muted-foreground border-border select-all"
                  />
                  <Button
                    variant="outline"
                    className="h-10 px-4 text-xs font-bold gap-2 shrink-0"
                    onClick={() => copyToClipboard(result.shareGoogleUrl!, "res-alt", "Alternative Link")}
                  >
                    {copiedId === "res-alt" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedId === "res-alt" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aggregate Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Traffic
            </span>
            <div className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
              {totalTraffic.toLocaleString()}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Clean Human Clicks
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
              {totalCleanClicks.toLocaleString()}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Shielded Bots / Crawlers
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
              {totalShieldedBots.toLocaleString()}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Link-Wise Statistics Table */}
      <div className="rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <GoogleGIcon className="h-5 w-5" />
            <h3 className="text-base font-extrabold text-foreground">Your Google Short Links</h3>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-mono font-bold text-muted-foreground">
              {links.length} Active
            </span>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Links with 0 clicks in 14 days auto-pruned</span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading Google Short stats...
          </div>
        ) : links.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl p-6">
            <GoogleGIcon className="h-10 w-10 mx-auto mb-3 opacity-60" />
            <p className="font-bold text-foreground text-sm">No Google Short Links Yet</p>
            <p className="mt-1 text-muted-foreground">
              Paste your CPA offer URL above to create your first Google-powered short link.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border/70">
                <tr>
                  <th className="p-3.5 font-bold text-foreground">Campaign / Google Link</th>
                  <th className="p-3.5 font-bold text-foreground">Offer Destination</th>
                  <th className="p-3.5 text-center font-bold text-foreground">Clean Visits</th>
                  <th className="p-3.5 text-center font-bold text-foreground">Shielded Bots</th>
                  <th className="p-3.5 text-center font-bold text-foreground">Total</th>
                  <th className="p-3.5 text-right font-bold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {links.map((link: GoogleShortItem) => {
                  const isHot = link.clicks_count >= 50;
                  return (
                    <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                      {/* Campaign / URL */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-xs">{link.title}</span>
                            {isHot && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 text-[10px] font-bold">
                                <Flame className="h-3 w-3 fill-current" /> Hot
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-emerald-400 font-bold truncate max-w-[260px] select-all">
                              {link.google_url}
                            </span>
                            <button
                              onClick={() => copyToClipboard(link.google_url, `row-${link.id}`, "Google Link")}
                              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                              title="Copy Google URL"
                            >
                              {copiedId === `row-${link.id}` ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <a
                              href={link.google_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-muted"
                              title="Test Link in New Tab"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="p-3.5">
                        <div className="font-mono text-[11px] text-muted-foreground max-w-[200px] truncate">
                          {link.destination_url}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                          via {link.domain}/{link.short_code}
                        </div>
                      </td>

                      {/* Clean Visits */}
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center gap-1 font-mono font-black text-sm text-emerald-400">
                          {link.clicks_count.toLocaleString()}
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 uppercase">
                            Clean
                          </span>
                        </span>
                      </td>

                      {/* Shielded Bots */}
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400/90 font-semibold">
                          {link.bot_clicks_count.toLocaleString()}
                          <span className="text-[10px] text-muted-foreground">shielded</span>
                        </span>
                      </td>

                      {/* Total */}
                      <td className="p-3.5 text-center">
                        <span className="font-mono font-bold text-xs text-foreground">
                          {link.total_clicks.toLocaleString()}
                        </span>
                        {link.total_clicks > 0 && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {link.human_rate}% clean
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold gap-1 px-2.5"
                            onClick={() => copyToClipboard(link.google_url, `btn-${link.id}`, "Google Link")}
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400"
                            disabled={deleteMut.isPending}
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this Google Short?")) {
                                deleteMut.mutate(link.id);
                              }
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
