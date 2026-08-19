import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Link2,
  MousePointerClick,
  Sparkles,
  Settings2,
  ShieldCheck,
  CreditCard,
  Bot,
  Target,
  Zap,
  Calendar,
  DollarSign,
  TrendingUp,
  Globe,
  Package,
  Ban,
  RotateCcw,
  Trash2,
  Plus,
  Search,
  X,
  Eye,
  Check,
  Star,
  RefreshCw,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Send,
  Power,
  PowerOff,
  Clock,
  CheckCircle2,
  Crown,
  Gift,
  AlertTriangle,
  Info,
  Rocket,
  Trophy,
  KeyRound,
  LayoutDashboard,
  Radar,
  Server,
  Wrench,
  Inbox,
  Activity,
  ShieldAlert,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats,
  adminListUsers,
  adminBanUser,
  adminBulkBan,
  adminResetUserQuota,
  adminBulkSetPlan,
  adminListPackages,
  adminSetUserPlan,
  adminClicksTimeseries,
  adminTopCountries,
  adminTopUsers,
  adminListLinks,
  adminToggleLink,
  adminUpdateLink,
  adminDeleteLink,
  adminListBotRules,
  adminUpsertBotRule,
  adminDeleteBotRule,
  adminListCloakingRules,
  adminUpsertCloakingRule,
  adminDeleteCloakingRule,
  adminListCountryTiers,
  adminUpsertCountryTier,
  adminDeleteCountryTier,
  adminUserDetail,
  adminImpersonate,
  adminFixUnlimitedMonthly,
  adminListErrors,
  adminErrorStats,
  adminResolveError,
  adminDeleteError,
  adminClearResolvedErrors,
  adminGetInactiveUsers,
  adminGetDormantUsers,
  adminRunMaintenance,
  adminDeleteUsers,
  adminTrafficSnapshot,
  adminGetPurgeStatus,
  adminPurgeBatch,
  adminResetAllClicks,
  adminTestQuotaSync,
  adminQuotaSyncStatus,
} from "@/lib/admin.functions";
import { startImpersonation } from "@/lib/impersonation";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings.functions";
import {
  listShortenerDomains,
  addShortenerDomain,
  verifyShortenerDomain,
  setPrimaryShortenerDomain,
  toggleShortenerDomainActive,
  deleteShortenerDomain,
} from "@/lib/shortener-domains.functions";
import {
  getSupportStatus,
  toggleSupport,
  adminListTickets,
  adminReplyTicket,
  adminCloseTicket,
  adminDeleteTicket,
} from "@/lib/support.functions";
import {
  adminListBroadcasts,
  adminCreateBroadcast,
  adminToggleBroadcast,
  adminDeleteBroadcast,
} from "@/lib/broadcasts.functions";
import { BroadcastMarkdown } from "@/components/broadcast-markdown";
import {
  listMonitoredDomains,
  addMonitoredDomain,
  toggleMonitoredDomain,
  deleteMonitoredDomain,
  syncOfferDomainsFromLinks,
  scanMonitoredDomain,
  scanAllMonitoredDomains,
} from "@/lib/domain-monitor.functions";
import { LeakMonitorTab } from "@/components/leak-monitor-tab";

export const Route = createFileRoute("/_authenticated/control-panel")({
  head: () => ({ meta: [{ title: "Control Panel — Adspx" }] }),
  component: AdminPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;
const PIE_COLORS = [
  "var(--primary)",
  "var(--primary-glow)",
  "var(--border)",
  "var(--muted-foreground)",
  "var(--border)",
  "var(--foreground)",
  "var(--muted-foreground)",
  "var(--muted-foreground)",
];

function AdminPage() {
  const navigate = useNavigate();
  const [adminChecked, setAdminChecked] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        navigate({ to: "/sx-vault-9k2m7x" });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!mounted) return;
      if (!data) {
        navigate({ to: "/dashboard" });
        return;
      }
      setAdminEmail(user.email ?? "");
      setAdminChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (!adminChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--muted)] text-[var(--muted-foreground)] text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen bg-[var(--muted)] text-[var(--muted-foreground)]"
      style={font}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <span className="orb orb-indigo w-[520px] h-[520px] -top-40 -left-32" />
        <span className="orb orb-pink w-[420px] h-[420px] bottom-0 -right-24" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <AdminNav tab={tab} setTab={setTab} adminEmail={adminEmail} />

          <div className="min-w-0 flex-1 space-y-6">
            <Header />
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsContent value="overview">
                <OverviewTab />
              </TabsContent>
              <TabsContent value="users">
                <UsersTab />
              </TabsContent>
              <TabsContent value="links">
                <LinksTab />
              </TabsContent>
              <TabsContent value="traffic">
                <TrafficTab />
              </TabsContent>
              <TabsContent value="domains">
                <DomainsTab />
              </TabsContent>
              <TabsContent value="user_domains">
                <UserDomainsTab />
              </TabsContent>
              <TabsContent value="leaks">
                <LeakMonitorTab />
              </TabsContent>
              <TabsContent value="support">
                <SupportTab />
              </TabsContent>
              <TabsContent value="broadcasts">
                <BroadcastsTab />
              </TabsContent>
              <TabsContent value="errors">
                <ErrorsTab />
              </TabsContent>
              <TabsContent value="maintenance">
                <MaintenanceTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ value: string; label: string; icon: any }>;
}> = [
  {
    label: "Insights",
    items: [
      { value: "overview", label: "Overview", icon: LayoutDashboard },
      { value: "traffic", label: "Traffic", icon: Activity },
    ],
  },
  {
    label: "Manage",
    items: [
      { value: "users", label: "Users", icon: Users },
      { value: "links", label: "Links", icon: Link2 },
      { value: "domains", label: "Domain pool", icon: Globe },
      { value: "user_domains", label: "User domains", icon: Server },
    ],
  },
  {
    label: "Protect",
    items: [
      { value: "leaks", label: "Leak monitor", icon: Radar },
      { value: "errors", label: "Errors", icon: ShieldAlert },
      { value: "maintenance", label: "Maintenance", icon: Wrench },
    ],
  },
  {
    label: "Engage",
    items: [
      { value: "support", label: "Support", icon: Inbox },
      { value: "broadcasts", label: "Broadcasts", icon: Megaphone },
    ],
  },
];

function AdminNav({
  tab,
  setTab,
  adminEmail,
}: {
  tab: string;
  setTab: (v: string) => void;
  adminEmail: string;
}) {
  return (
    <aside className="lg:sticky lg:top-4 w-full lg:w-64 shrink-0 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-3 shadow-lg">
      <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-border bg-card/70 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-[var(--foreground)]">
            {adminEmail || "Admin"}
          </div>
          <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-primary">
            Administrator
          </div>
        </div>
      </div>

      <nav className="space-y-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="px-2 pb-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/70">
              {g.label}
            </div>
            <div className="space-y-1">
              {g.items.map((it) => {
                const active = tab === it.value;
                return (
                  <button
                    key={it.value}
                    type="button"
                    onClick={() => setTab(it.value)}
                    style={active ? { backgroundImage: "var(--gradient-primary)" } : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      active
                        ? "border-primary/30 text-primary-foreground shadow-glow"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <it.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function Header() {
  const statsFn = useServerFn(adminStats);
  const { data: s } = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });

  const chips = [
    { icon: Users, label: "Users", value: (s?.users ?? 0).toLocaleString() },
    { icon: Link2, label: "Links", value: (s?.links ?? 0).toLocaleString() },
    { icon: MousePointerClick, label: "Clicks", value: (s?.clicks ?? 0).toLocaleString() },
    { icon: Bot, label: "Bots blocked", value: (s?.bots ?? 0).toLocaleString() },
  ];

  return (
    <header className="anim-rise relative overflow-hidden rounded-3xl border border-border/80 bg-card/70 backdrop-blur-xl p-6 sm:p-8 shadow-xl">
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
            <span className="live-dot" /> Admin · live
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
            Control <span className="text-gradient">Panel</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            Users, links, traffic routing, payouts and platform health — one console.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {chips.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card/70 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                <c.icon className="h-3 w-3 text-primary" /> {c.label}
              </div>
              <div className="mt-0.5 text-lg font-extrabold tabular-nums text-[var(--foreground)]">
                {c.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

// ===================== OVERVIEW =====================
function OverviewTab() {
  const statsFn = useServerFn(adminStats);
  const tsFn = useServerFn(adminClicksTimeseries);
  const ctyFn = useServerFn(adminTopCountries);
  const topUsersFn = useServerFn(adminTopUsers);
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const ts = useQuery({ queryKey: ["admin-ts"], queryFn: () => tsFn() });
  const cty = useQuery({ queryKey: ["admin-cty"], queryFn: () => ctyFn() });
  const top = useQuery({ queryKey: ["admin-top-users"], queryFn: () => topUsersFn() });

  const s = stats.data;
  const botPct = s && s.clicks ? ((s.bots / s.clicks) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={Users}
          label="Users"
          value={s?.users ?? "…"}
          sub={`${s?.banned_users ?? 0} banned`}
        />
        <Kpi
          icon={Link2}
          label="Links"
          value={s?.links ?? "…"}
          sub={`${s?.active_links ?? 0} active`}
        />
        <Kpi
          icon={MousePointerClick}
          label="Total clicks"
          value={(s?.clicks ?? 0).toLocaleString()}
          sub={`${botPct}% bots`}
        />
        <Kpi
          icon={DollarSign}
          label="MRR (30d)"
          value={`$${(s?.mrr_30d ?? 0).toFixed(2)}`}
          sub={`$${(s?.total_revenue ?? 0).toFixed(2)} all-time`}
          accent
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={Zap}
          label="Ours rotations"
          value={(s?.ours ?? 0).toLocaleString()}
          sub="Quota + Injection"
        />
        <Kpi
          icon={Target}
          label="Offer clicks"
          value={(s?.offer ?? 0).toLocaleString()}
          sub="User destinations"
        />
        <Kpi
          icon={Bot}
          label="Bots blocked"
          value={(s?.bots ?? 0).toLocaleString()}
          sub="Shield active"
        />
        <Kpi
          icon={Calendar}
          label="Today ours/total"
          value={`${(s?.today_ours ?? 0).toLocaleString()} / ${(s?.today_total ?? 0).toLocaleString()}`}
          sub="Target: 100 per 1k (10%)"
          accent
        />
      </div>

      <Panel
        icon={TrendingUp}
        title="Clicks · last 14 days"
        subtitle="Daily breakdown of routing & bot traffic"
      >
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={ts.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} />
              <Line type="monotone" dataKey="ours" stroke="var(--primary-glow)" strokeWidth={2} />
              <Line type="monotone" dataKey="offer" stroke="var(--foreground)" strokeWidth={2} />
              <Line
                type="monotone"
                dataKey="bots"
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel icon={Globe} title="Top countries · 7d">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={cty.data ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis
                  dataKey="country"
                  type="category"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel icon={Users} title="Top users · by clicks">
          <div className="space-y-2">
            {(top.data ?? []).map((u, i) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2 rounded-lg bg-card/60 border border-[var(--border)]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">{u.email}</div>
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                      {u.plan_slug}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-[var(--primary)]">
                  {(u.clicks_used ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
            {!top.data?.length && (
              <div className="text-sm text-[var(--muted-foreground)] p-4 text-center">
                No data yet.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel icon={Bot} title="Bot vs Human · all-time">
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={[
                  { name: "Human (ours)", value: s?.ours ?? 0 },
                  { name: "Human (offer)", value: s?.offer ?? 0 },
                  { name: "Bots", value: s?.bots ?? 0 },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label
              >
                {PIE_COLORS.slice(0, 3).map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

// ===================== USERS =====================
function UsersTab() {
  const qc = useQueryClient();
  const usersFn = useServerFn(adminListUsers);
  const packagesFn = useServerFn(adminListPackages);
  const banFn = useServerFn(adminBanUser);
  const planFn = useServerFn(adminSetUserPlan);
  const bulkBanFn = useServerFn(adminBulkBan);
  const bulkPlanFn = useServerFn(adminBulkSetPlan);
  const resetFn = useServerFn(adminResetUserQuota);
  const detailFn = useServerFn(adminUserDetail);
  const impersonateFn = useServerFn(adminImpersonate);
  const navigate = useNavigate();
  const [imperBusyId, setImperBusyId] = useState<string | null>(null);

  const handleImpersonate = async (u: { id: string; email: string | null }) => {
    if (
      !confirm(
        `Sign in as ${u.email ?? u.id}?\n\nYour admin session is saved and can be restored from the orange banner.`,
      )
    )
      return;
    setImperBusyId(u.id);
    try {
      const r = await impersonateFn({ data: { user_id: u.id } });
      await startImpersonation({ hashed_token: r.hashed_token, target: r.target });
      toast.success(`Now signed in as ${r.target.email}`);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImperBusyId(null);
    }
  };

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });
  const packages = useQuery({ queryKey: ["admin-packages"], queryFn: () => packagesFn() });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["admin-user-detail", detailId],
    queryFn: () => detailFn({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const filtered = useMemo(() => {
    const list = users.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) || u.id.includes(q) || u.plan_slug.includes(q),
    );
  }, [users.data, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const banMut = useMutation({
    mutationFn: (v: { id: string; is_banned: boolean }) => banFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const planMut = useMutation({
    mutationFn: (v: { user_id: string; package_slug: string }) => planFn({ data: v }),
    onSuccess: () => {
      toast.success("Plan updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bulkBanMut = useMutation({
    mutationFn: (v: { ids: string[]; is_banned: boolean }) => bulkBanFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Updated ${r.updated} users`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bulkPlanMut = useMutation({
    mutationFn: (v: { ids: string[]; package_slug: string }) => bulkPlanFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`${r.updated} users moved`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resetMut = useMutation({
    mutationFn: (v: { ids: string[] }) => resetFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Quota reset for ${r.updated}`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((u) => u.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };

  return (
    <Panel
      icon={Users}
      title="Users"
      subtitle="Search · bulk ban · reset quota · plan switch · per-user detail"
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, plan, id…"
            className={`${inputCls} pl-10`}
          />
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">{selected.size} selected</span>
        <Button
          size="sm"
          variant="outline"
          className="border-[var(--border)] ml-auto"
          onClick={async () => {
            if (
              !confirm(
                "Repair paid-plan quota mismatches from payment history? This will not renew plans or add days.",
              )
            )
              return;
            try {
              const r = await adminFixUnlimitedMonthly();
              toast.success(`Fixed ${r.fixed} of ${r.scanned} monthly users`);
              invalidate();
            } catch (e: any) {
              toast.error(e.message ?? "Failed");
            }
          }}
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Repair Quota Drift
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-[var(--primary)]/10 to-[var(--primary-glow)]/10 border border-[var(--border)] flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkBanMut.mutate({ ids: [...selected], is_banned: true })}
            className="border-[var(--border)]"
          >
            <Ban className="w-3 h-3 mr-1" />
            Ban
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkBanMut.mutate({ ids: [...selected], is_banned: false })}
            className="border-[var(--border)]"
          >
            Unban
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm(`Reset quota for ${selected.size} users?`))
                resetMut.mutate({ ids: [...selected] });
            }}
            className="border-[var(--border)]"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset quota
          </Button>
          <select
            value={bulkPlan}
            onChange={(e) => setBulkPlan(e.target.value)}
            className="bg-card/80 border border-[var(--border)] rounded-lg px-2 py-1 text-xs"
          >
            <option value="">Move to plan…</option>
            {packages.data?.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!bulkPlan}
            onClick={() => {
              bulkPlanMut.mutate({ ids: [...selected], package_slug: bulkPlan });
              setBulkPlan("");
            }}
            className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground border-0"
          >
            Apply
          </Button>
        </div>
      )}

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              <Th>
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                />
              </Th>
              <Th>Email</Th>
              <Th>Plan</Th>
              <Th>Change</Th>
              <Th>Links</Th>
              <Th>Clicks</Th>
              <Th>Ours</Th>
              <Th>Started</Th>
              <Th>Expires</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border)]/60 hover:bg-card/40">
                <Td>
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                  />
                </Td>
                <Td className="font-medium text-[var(--foreground)]">{u.email}</Td>
                <Td>
                  <Pill>{u.plan_slug}</Pill>
                </Td>
                <Td>
                  <select
                    value={u.plan_slug}
                    onChange={(e) => {
                      if (
                        e.target.value !== u.plan_slug &&
                        confirm(`Change ${u.email} to ${e.target.value}?`)
                      )
                        planMut.mutate({ user_id: u.id, package_slug: e.target.value });
                    }}
                    className="bg-card/80 border border-[var(--border)] rounded-lg px-2 py-1 text-xs"
                  >
                    {packages.data?.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                    {!packages.data?.some((p) => p.slug === u.plan_slug) && (
                      <option value={u.plan_slug}>{u.plan_slug}</option>
                    )}
                  </select>
                </Td>
                <Td className="text-[var(--muted-foreground)]">
                  {u.links_used} / {u.link_limit == null ? "∞" : u.link_limit}
                </Td>
                <Td className="text-[var(--muted-foreground)]">
                  {u.clicks_used.toLocaleString()}
                  {u.click_quota == null ? " / ∞" : ` / ${u.click_quota.toLocaleString()}`}
                </Td>
                <Td>
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-gradient-to-r from-[var(--primary)]/15 to-[var(--primary-glow)]/15 text-[var(--primary)] text-xs font-bold">
                    {(u.ours_clicks ?? 0).toLocaleString()}
                  </span>
                </Td>
                <Td className="text-[var(--muted-foreground)] text-xs whitespace-nowrap">
                  {u.plan_started_at ? new Date(u.plan_started_at).toLocaleDateString() : "—"}
                </Td>
                <Td className="text-xs whitespace-nowrap">
                  {(() => {
                    if (u.plan_slug === "lifetime" || u.plan_slug === "unlimited")
                      return <span className="text-emerald-600 font-semibold">Never</span>;
                    if (!u.plan_expires_at)
                      return <span className="text-[var(--muted-foreground)]">—</span>;
                    const exp = new Date(u.plan_expires_at);
                    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                    const cls =
                      daysLeft < 0
                        ? "text-rose-600 font-semibold"
                        : daysLeft <= 3
                          ? "text-foreground font-semibold"
                          : "text-[var(--muted-foreground)]";
                    return (
                      <span className={cls} title={exp.toLocaleString()}>
                        {exp.toLocaleDateString()} (
                        {daysLeft < 0 ? `expired ${-daysLeft}d ago` : `${daysLeft}d left`})
                      </span>
                    );
                  })()}
                </Td>
                <Td>
                  {u.is_banned ? (
                    <span className="text-rose-600 font-semibold">Banned</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Active</span>
                  )}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailId(u.id)}
                      className="border-[var(--border)]"
                      title="View details"
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={imperBusyId === u.id}
                      onClick={() => handleImpersonate(u)}
                      className="border-border text-foreground hover:bg-muted"
                      title="Sign in as this user"
                    >
                      <KeyRound className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => banMut.mutate({ id: u.id, is_banned: !u.is_banned })}
                      className="border-[var(--border)]"
                    >
                      {u.is_banned ? "Unban" : "Ban"}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail.data?.profile?.email ?? "User detail"}</DialogTitle>
          </DialogHeader>
          {detail.isLoading && (
            <div className="text-sm text-[var(--muted-foreground)]">Loading…</div>
          )}
          {detail.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="Plan" value={detail.data.profile?.plan_slug ?? "—"} />
                <Stat
                  label="Links"
                  value={`${detail.data.profile?.links_used ?? 0} / ${detail.data.profile?.link_limit == null ? "∞" : detail.data.profile.link_limit}`}
                />
                <Stat
                  label="Clicks"
                  value={(detail.data.profile?.clicks_used ?? 0).toLocaleString()}
                />
              </div>
              <div className="h-44">
                <ResponsiveContainer>
                  <LineChart data={detail.data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="clicks" stroke="var(--primary)" />
                    <Line
                      type="monotone"
                      dataKey="bots"
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">
                  Links ({detail.data.links.length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {detail.data.links.map((l) => (
                    <div
                      key={l.id}
                      className="text-xs flex justify-between p-2 rounded bg-card/60 border border-[var(--border)]"
                    >
                      <span className="font-mono">{l.short_code}</span>
                      <span className="text-[var(--muted-foreground)]">
                        {l.clicks_count} clicks · {l.bot_clicks_count} bots
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">
                  Payments ({detail.data.payments.length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {detail.data.payments.map((p) => (
                    <div
                      key={p.id}
                      className="text-xs flex justify-between p-2 rounded bg-card/60 border border-[var(--border)]"
                    >
                      <span>
                        {new Date(p.created_at ?? "").toLocaleDateString()} · {p.package_slug}
                      </span>
                      <span className="font-semibold">
                        ${Number(p.amount).toFixed(2)} · {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== LINKS =====================
function LinksTab() {
  const qc = useQueryClient();
  const linksFn = useServerFn(adminListLinks);
  const toggleFn = useServerFn(adminToggleLink);
  const updateFn = useServerFn(adminUpdateLink);
  const delFn = useServerFn(adminDeleteLink);
  const links = useQuery({ queryKey: ["admin-links"], queryFn: () => linksFn() });
  const [search, setSearch] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-links"] });
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      toast.success("Toggled");
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; adsterra_url?: string; safe_url?: string; title?: string }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (v: { id: string }) => delFn({ data: v }),
    onSuccess: () => {
      toast.success("Deleted");
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const l = links.data ?? [];
    if (!search) return l;
    const q = search.toLowerCase();
    return l.filter(
      (x) =>
        x.short_code.toLowerCase().includes(q) ||
        (x.title ?? "").toLowerCase().includes(q) ||
        (x.owner_email ?? "").toLowerCase().includes(q),
    );
  }, [links.data, search]);

  return (
    <Panel
      icon={Link2}
      title="All links"
      subtitle="Force disable, edit destination, view click/bot stats"
    >
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search short code, title, owner…"
          className={`${inputCls} pl-10`}
        />
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              <Th>Code</Th>
              <Th>Owner</Th>
              <Th>Title</Th>
              <Th>Destination</Th>
              <Th>Clicks</Th>
              <Th>Bots</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-[var(--border)]/60">
                <Td className="font-mono text-xs">{l.short_code}</Td>
                <Td className="text-xs text-[var(--muted-foreground)]">{l.owner_email}</Td>
                <Td>{l.title || <span className="text-[var(--muted-foreground)]">—</span>}</Td>
                <Td className="max-w-[280px] truncate text-xs">
                  <a
                    href={l.adsterra_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--primary)] hover:underline"
                  >
                    {l.adsterra_url}
                  </a>
                </Td>
                <Td>{l.clicks_count.toLocaleString()}</Td>
                <Td className="text-[var(--muted-foreground)]">
                  {l.bot_clicks_count.toLocaleString()}
                </Td>
                <Td>
                  {l.is_active ? (
                    <span className="text-emerald-600 font-semibold">Active</span>
                  ) : (
                    <span className="text-rose-600 font-semibold">Disabled</span>
                  )}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleMut.mutate({ id: l.id, is_active: !l.is_active })}
                      className="border-[var(--border)]"
                    >
                      {l.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = prompt("New destination URL:", l.adsterra_url);
                        if (url) updateMut.mutate({ id: l.id, adsterra_url: url });
                      }}
                      className="border-[var(--border)]"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete link "${l.short_code}"?`)) delMut.mutate({ id: l.id });
                      }}
                      className="border-rose-300 text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ===================== RULES (bot + cloaking) =====================
type RuleForm = {
  id?: string;
  rule_type: string;
  pattern: string;
  action: string;
  label: string;
  is_active: boolean;
  priority?: number;
};

function RulesTab() {
  return (
    <div className="space-y-6">
      <RuleSection
        title="Bot rules"
        icon={Bot}
        listFnRef={adminListBotRules}
        upFnRef={adminUpsertBotRule}
        delFnRef={adminDeleteBotRule}
        keyName="bot-rules"
        showPriority={false}
      />
      <RuleSection
        title="Cloaking rules"
        icon={ShieldCheck}
        listFnRef={adminListCloakingRules}
        upFnRef={adminUpsertCloakingRule}
        delFnRef={adminDeleteCloakingRule}
        keyName="cloak-rules"
        showPriority
      />
    </div>
  );
}

function RuleSection({
  title,
  icon,
  listFnRef,
  upFnRef,
  delFnRef,
  keyName,
  showPriority,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;

  listFnRef: any;
  upFnRef: any;
  delFnRef: any;
  keyName: string;
  showPriority: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFnRef);
  const upFn = useServerFn(upFnRef);
  const delFn = useServerFn(delFnRef);
  const list = useQuery({ queryKey: [keyName], queryFn: () => listFn() });
  const [edit, setEdit] = useState<RuleForm | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: [keyName] });
  const upMut = useMutation({
    mutationFn: (v: RuleForm) => upFn({ data: v as never }),
    onSuccess: () => {
      toast.success("Saved");
      inv();
      setEdit(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (v: { id: string }) => delFn({ data: v }),
    onSuccess: () => {
      toast.success("Deleted");
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel icon={icon} title={title}>
      <div className="mb-4">
        <Button
          onClick={() =>
            setEdit({
              rule_type: "ua",
              pattern: "",
              action: "safe",
              label: "",
              is_active: true,
              priority: showPriority ? 100 : undefined,
            })
          }
          className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground border-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          New rule
        </Button>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              <Th>Type</Th>
              <Th>Pattern</Th>
              <Th>Action</Th>
              <Th>Label</Th>
              {showPriority && <Th>Pri</Th>}
              <Th>Active</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((r: any) => (
              <tr key={r.id} className="border-t border-[var(--border)]/60">
                <Td>
                  <Pill>{r.rule_type}</Pill>
                </Td>
                <Td className="font-mono text-xs max-w-[280px] truncate">{r.pattern}</Td>
                <Td>
                  <Pill>{r.action}</Pill>
                </Td>
                <Td className="text-[var(--muted-foreground)] text-xs">{r.label ?? "—"}</Td>
                {showPriority && <Td>{(r as { priority?: number }).priority}</Td>}
                <Td>
                  {r.is_active ? (
                    <span className="text-emerald-600 font-semibold">Yes</span>
                  ) : (
                    <span className="text-rose-600 font-semibold">No</span>
                  )}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEdit({
                          id: r.id,
                          rule_type: r.rule_type,
                          pattern: r.pattern,
                          action: r.action,
                          label: r.label ?? "",
                          is_active: r.is_active,
                          priority: (r as { priority?: number }).priority,
                        })
                      }
                      className="border-[var(--border)]"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm("Delete?")) delMut.mutate({ id: r.id });
                      }}
                      className="border-rose-300 text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit rule" : "New rule"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Type (ua, ip, asn, header…)">
                <input
                  value={edit.rule_type}
                  onChange={(e) => setEdit({ ...edit, rule_type: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Pattern (regex or substring)">
                <input
                  value={edit.pattern}
                  onChange={(e) => setEdit({ ...edit, pattern: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Action (safe, block, allow…)">
                <input
                  value={edit.action}
                  onChange={(e) => setEdit({ ...edit, action: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Label (optional)">
                <input
                  value={edit.label}
                  onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                  className={inputCls}
                />
              </Field>
              {showPriority && (
                <Field label="Priority (lower = earlier)">
                  <input
                    type="number"
                    value={edit.priority ?? 100}
                    onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit.is_active}
                  onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
                />{" "}
                Active
              </label>
              <Button
                onClick={() => upMut.mutate(edit)}
                disabled={upMut.isPending}
                className="w-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground border-0"
              >
                {upMut.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== GEO TIERS =====================
function GeoTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCountryTiers);
  const upFn = useServerFn(adminUpsertCountryTier);
  const delFn = useServerFn(adminDeleteCountryTier);
  const list = useQuery({ queryKey: ["geo-tiers"], queryFn: () => listFn() });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState(1);
  const inv = () => qc.invalidateQueries({ queryKey: ["geo-tiers"] });
  const upMut = useMutation({
    mutationFn: (v: { country_code: string; country_name: string | null; tier: number }) =>
      upFn({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      inv();
      setCode("");
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (v: { country_code: string }) => delFn({ data: v }),
    onSuccess: () => {
      toast.success("Deleted");
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel icon={Globe} title="Country tiers" subtitle="Tier 1 = highest payout, Tier 5 = lowest">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          placeholder="CC (2 letters)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={2}
          className={inputCls}
        />
        <input
          placeholder="Country name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} md:col-span-2`}
        />
        <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className={inputCls}>
          {[1, 2, 3, 4, 5].map((t) => (
            <option key={t} value={t}>
              Tier {t}
            </option>
          ))}
        </select>
        <Button
          onClick={() => upMut.mutate({ country_code: code, country_name: name || null, tier })}
          disabled={code.length !== 2}
          className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground border-0"
        >
          Add / Update
        </Button>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Tier</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((r) => (
              <tr key={r.country_code} className="border-t border-[var(--border)]/60">
                <Td className="font-mono font-bold">{r.country_code}</Td>
                <Td>{r.country_name ?? "—"}</Td>
                <Td>
                  <Pill>Tier {r.tier}</Pill>
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Remove ${r.country_code}?`))
                        delMut.mutate({ country_code: r.country_code });
                    }}
                    className="border-rose-300 text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ===================== TRAFFIC SETTINGS =====================
function TrafficTab() {
  const qc = useQueryClient();
  const settingsFn = useServerFn(getAppSettings);
  const updateSettingsFn = useServerFn(updateAppSettings);
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: () => settingsFn() });
  const [ourUrl, setOurUrl] = useState("");
  const [destPool, setDestPool] = useState("");
  const [threshold, setThreshold] = useState(900);
  const [count, setCount] = useState(100);
  const [spOn, setSpOn] = useState(false);
  const [spGmail, setSpGmail] = useState(true);
  const [spBlock, setSpBlock] = useState(true);
  const [fbReviewOn, setFbReviewOn] = useState(true);
  useEffect(() => {
    if (settings.data) {
      const s: any = settings.data;
      setOurUrl(s.our_adsterra_url ?? "");
      setDestPool(
        Array.isArray(s.destination_pool)
          ? s.destination_pool
              .map((e: any) => (typeof e === "string" ? e : e?.url))
              .filter(Boolean)
              .join("\n")
          : "",
      );
      setThreshold(s.injection_threshold ?? 900);
      setCount(s.injection_count ?? 100);
      setSpOn(s.signup_protection_enabled ?? false);
      setSpGmail(s.signup_gmail_only ?? true);
      setSpBlock(s.signup_blocklist_enabled ?? true);
      setFbReviewOn(s.fb_review_protection_enabled ?? true);
    }
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () => {
      const s: any = settings.data ?? {};
      const payload: any = {
        // Daily-redirect feature retired — keep stored values untouched.
        fallback_url: s.fallback_url || "https://example.com/",
        our_adsterra_url: ourUrl,
        destination_pool: destPool
          .split(/[\n,]/)
          .map((x) => x.trim())
          .filter((x) => /^https?:\/\//i.test(x)),
        injection_threshold: Number(threshold),
        injection_count: Number(count),
        daily_redirect_enabled: false,
        signup_protection_enabled: spOn,
        signup_gmail_only: spGmail,
        signup_blocklist_enabled: spBlock,
        // Per-IP signup cap retired — unlimited accounts per IP.
        signup_ip_max_per_day: 0,
        fb_review_protection_enabled: fbReviewOn,
      };

      // Only include support_enabled if it exists in the database record
      if ("support_enabled" in (settings.data || {})) {
        payload.support_enabled = (settings.data as any).support_enabled;
      }
      return updateSettingsFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <TrafficSnapshotPanel />
      <div className="h-6" />
      <Panel icon={Settings2} title="Traffic & Monetization">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Our Adsterra Direct URL">
            <input
              value={ourUrl}
              onChange={(e) => setOurUrl(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Destination pool (one URL per line — each short code gets its own, permanently)">
            <textarea
              value={destPool}
              onChange={(e) => setDestPool(e.target.value)}
              rows={4}
              placeholder={"https://offer-a.example/?key=...\nhttps://offer-b.example/?key=..."}
              className={inputCls}
            />
          </Field>
          <Field label="Injection threshold">
            <input
              type="number"
              min={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Injection count">
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--primary)] mb-1">
            FB Ad-Review Protection
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            নতুন লিংকের প্রথম ৬ ঘন্টা বা ২৫ ক্লিক পর্যন্ত FB/IG in-app browser-কে safe page দেখায়
            (ad reviewer যেন offer না দেখে)।{" "}
            <b>Ad approved হয়ে campaign run হলে এটা OFF করে দিন</b> — সব FB user offer পাবে,
            traffic 100% count হবে।
          </p>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-card/60 border border-[var(--border)]">
            <input
              type="checkbox"
              checked={fbReviewOn}
              onChange={(e) => setFbReviewOn(e.target.checked)}
              className="w-5 h-5 accent-[var(--primary)]"
            />
            <span className="text-sm font-semibold">
              🛡️ Enable FB Ad-Review Protection (turn OFF after ad approved)
            </span>
          </label>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--primary)] mb-1">
            Signup Protection
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Master switch must be ON for any rule below to apply. Default OFF — turn ON when you're
            ready.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-card/60 border border-[var(--border)]">
              <input
                type="checkbox"
                checked={spOn}
                onChange={(e) => setSpOn(e.target.checked)}
                className="w-5 h-5 accent-[var(--primary)]"
              />
              <span className="text-sm font-semibold">
                🛡️ Enable Signup Protection (master switch)
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-card/60 border border-[var(--border)]">
              <input
                type="checkbox"
                checked={spGmail}
                onChange={(e) => setSpGmail(e.target.checked)}
                disabled={!spOn}
                className="w-4 h-4 accent-[var(--primary)]"
              />
              <span className="text-sm">Allow only Gmail (@gmail.com)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-card/60 border border-[var(--border)]">
              <input
                type="checkbox"
                checked={spBlock}
                onChange={(e) => setSpBlock(e.target.checked)}
                disabled={!spOn}
                className="w-4 h-4 accent-[var(--primary)]"
              />
              <span className="text-sm">Block disposable / temp email domains</span>
            </label>
            <div className="sm:col-span-2 text-[11px] text-[var(--muted-foreground)]">
              Unlimited accounts per IP — no signup cap.
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground border-0"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {saveMut.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </Panel>
    </>
  );
}

// ===================== TRAFFIC SNAPSHOT (mini live dashboard) =====================
function TrafficSnapshotPanel() {
  const snapFn = useServerFn(adminTrafficSnapshot);
  const snap = useQuery({
    queryKey: ["admin-traffic-snapshot"],
    queryFn: () => snapFn(),
    refetchInterval: 60_000, // refresh every 60s to reduce DB load
    staleTime: 60_000,
  });
  const d = snap.data;
  return (
    <Panel
      icon={TrendingUp}
      title="Live Traffic Snapshot (last 24h)"
      subtitle="Auto-refresh every 60s"
    >
      {!d ? (
        <div className="text-sm text-[var(--muted-foreground)]">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              icon={MousePointerClick}
              label="Total clicks 24h"
              value={d.total24h.toLocaleString()}
              sub={`${d.total1h.toLocaleString()} in last 1h`}
            />
            <Kpi
              icon={Users}
              label="Real users (humans)"
              value={`${d.humans24h.toLocaleString()}`}
              sub={`${d.humanPct}% of total`}
              accent
            />
            <Kpi
              icon={Bot}
              label="Bots blocked"
              value={d.bots24h.toLocaleString()}
              sub={`${d.botPct}% of total`}
            />
            <Kpi
              icon={Target}
              label="Offer success"
              value={`${d.offerSuccessPct}%`}
              sub={`${d.offer24h.toLocaleString()} hit offer`}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Offer (real)" value={d.offer24h.toLocaleString()} />
            <Stat label="Our Adsterra" value={d.ours24h.toLocaleString()} />
            <Stat label="Safe / blocked" value={d.safe24h.toLocaleString()} />
            <Stat label="FB crawler blocked" value={d.fbCrawlerBlocked.toLocaleString()} />
          </div>
          {d.botPct > 40 && (
            <div className="mt-4 p-3 rounded-xl bg-muted border border-border text-foreground text-xs flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Bot rate <b>{d.botPct}%</b> — যদি FB campaign চলছে তাহলে নিচে{" "}
                <b>FB Ad-Review Protection</b> OFF করুন। Top bot reasons:&nbsp;
                {d.topBotReasons.map((r) => `${r.key}(${r.count})`).join(", ")}
              </div>
            </div>
          )}
          {d.botPct <= 40 && d.topBotReasons.length > 0 && (
            <div className="mt-4 text-xs text-[var(--muted-foreground)]">
              <b>Top bot reasons:</b>{" "}
              {d.topBotReasons.map((r) => `${r.key} (${r.count})`).join(" · ")}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ===================== shared UI =====================
const inputCls =
  "w-full bg-card/70 border border-border rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all";

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 sm:p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 ${
        accent
          ? "border-primary/30 bg-primary-gradient text-white shadow-glow"
          : "border-border/80 bg-card/70 text-[var(--foreground)] shadow-sm hover:border-primary/30"
      }`}
    >
      <div className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div
          className={`text-[10px] font-extrabold uppercase tracking-[0.16em] ${accent ? "text-white/80" : "text-[var(--muted-foreground)]"}`}
        >
          {label}
        </div>
        <span
          className={`grid h-8 w-8 place-items-center rounded-xl border transition-transform group-hover:scale-110 ${
            accent
              ? "border-white/25 bg-white/15 text-white"
              : "border-border bg-card/80 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="relative mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums">
        {value}
      </div>
      {sub && (
        <div
          className={`relative mt-1 text-[11px] font-semibold ${accent ? "text-white/80" : "text-[var(--muted-foreground)]"}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
function Panel({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="anim-rise rounded-3xl border border-border/80 bg-card/70 backdrop-blur-xl p-5 sm:p-7 shadow-lg">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-gradient text-white shadow-glow">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[var(--foreground)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--muted-foreground)]">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] mb-2 block">
        {label}
      </label>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-3 transition-colors hover:border-primary/30">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}
function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-primary text-xs font-bold">
      {children}
    </span>
  );
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/12 text-emerald-600 border-emerald-500/25",
    completed: "bg-emerald-500/12 text-emerald-600 border-emerald-500/25",
    successful: "bg-emerald-500/12 text-emerald-600 border-emerald-500/25",
    pending: "bg-amber-500/12 text-amber-600 border-amber-500/25",
    expired: "bg-rose-500/12 text-rose-600 border-rose-500/25",
    cancelled: "bg-rose-500/12 text-rose-600 border-rose-500/25",
    rejected: "bg-rose-500/12 text-rose-600 border-rose-500/25",
  };
  const label = status === "paid" ? "successful" : status;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize ${map[status] ?? "border-border bg-muted text-[var(--muted-foreground)]"}`}
    >
      {label}
    </span>
  );
}

/* ============== Shortener Domains (admin) ============== */
function DomainsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listShortenerDomains);
  const addFn = useServerFn(addShortenerDomain);
  const verifyFn = useServerFn(verifyShortenerDomain);
  const primaryFn = useServerFn(setPrimaryShortenerDomain);
  const toggleFn = useServerFn(toggleShortenerDomainActive);
  const delFn = useServerFn(deleteShortenerDomain);

  const q = useQuery({ queryKey: ["sd-list"], queryFn: () => listFn(), staleTime: 15_000 });
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sd-list"] });

  const add = useMutation({
    mutationFn: () => addFn({ data: { domain, note: note || undefined } }),
    onSuccess: () => {
      setDomain("");
      setNote("");
      toast.success("Domain added — now verify DNS");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success(r.message);
      else toast.error(r?.message ?? "Verification failed");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const setPrimary = useMutation({
    mutationFn: (id: string) => primaryFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Primary domain switched. All new short URLs use this domain.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["primary-shortener-domain"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggleActive = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const domains: any[] = q.data?.domains ?? [];

  return (
    <section className="rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)]">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-[var(--primary)]" />
        <h3 className="text-lg font-bold text-[var(--foreground)]">Shortener Domain Pool</h3>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mb-5">
        Add backup domains that point to your VPS (A record →{" "}
        <span className="font-mono">185.158.133.1</span>). If the current primary gets blocked,
        verify a new one and click <strong>Set Primary</strong> — every short URL instantly uses the
        new domain. Old short URLs on still-resolving domains keep working too.
      </p>

      <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 mb-6 p-4 rounded-2xl bg-card/60 border border-border/80">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. trk.example.com"
          className="px-4 py-2.5 rounded-xl bg-card border border-[var(--border)] text-sm font-mono outline-none focus:border-[var(--primary)]"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="px-4 py-2.5 rounded-xl bg-card border border-[var(--border)] text-sm outline-none focus:border-[var(--primary)]"
        />
        <Button
          onClick={() => domain.trim() && add.mutate()}
          disabled={add.isPending}
          className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Domain
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : domains.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No domains in pool yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
              <tr>
                <th className="text-left px-4 py-3">Domain</th>
                <th className="text-left px-4 py-3">DNS Target</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Note</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--muted)]">
                  <td className="px-4 py-3 font-mono font-semibold text-[var(--foreground)]">
                    {d.domain}
                    {d.is_primary && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                        <Star className="w-3 h-3" />
                        Primary
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                    {d.dns_target}
                  </td>
                  <td className="px-4 py-3">
                    {d.verified ? (
                      <Pill>Verified</Pill>
                    ) : (
                      <span className="text-xs text-foreground font-semibold">Pending DNS</span>
                    )}
                    {!d.is_active && (
                      <span className="ml-2 text-xs text-rose-600 font-semibold">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {d.note ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verify.mutate(d.id)}
                        disabled={verify.isPending}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Verify
                      </Button>
                      {!d.is_primary && d.verified && d.is_active && (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                `Switch primary to ${d.domain}? All new short URLs will use it.`,
                              )
                            )
                              setPrimary.mutate(d.id);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-primary-foreground"
                        >
                          <Check className="w-3 h-3 mr-1" /> Set Primary
                        </Button>
                      )}
                      {!d.is_primary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive.mutate({ id: d.id, is_active: !d.is_active })}
                        >
                          {d.is_active ? "Disable" : "Enable"}
                        </Button>
                      )}
                      {!d.is_primary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Delete ${d.domain}?`)) del.mutate(d.id);
                          }}
                          className="border-rose-300 text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 rounded-2xl bg-muted border border-border text-xs text-foreground space-y-1">
        <p className="font-bold">Setup steps for a new domain:</p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>
            At your registrar, add an <strong>A record</strong>:{" "}
            <span className="font-mono">@ → 185.158.133.1</span> (and optionally{" "}
            <span className="font-mono">www → 185.158.133.1</span>).
          </li>
          <li>On the VPS, add the domain to Nginx/Caddy config and issue an SSL cert.</li>
          <li>
            Click <strong>Verify</strong> — DNS check via Cloudflare DoH.
          </li>
          <li>
            Click <strong>Set Primary</strong> when ready. All short links auto-switch.
          </li>
        </ol>
      </div>
    </section>
  );
}

function UserDomainsTab() {
  const qc = useQueryClient();
  const detailFn = useServerFn(adminUserDetail);

  // We can just query custom_domains directly since we are admin
  const q = useQuery({
    queryKey: ["admin-user-custom-domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_domains")
        .select(
          `
          id, domain, verified, created_at, user_id,
          profiles ( email )
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-user-custom-domains"] });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_domains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const domains = q.data ?? [];

  return (
    <Panel
      icon={Globe}
      title="User Custom Domains"
      subtitle="Manage and monitor domains added by users"
    >
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-card/70">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
            <tr>
              <th className="text-left px-4 py-3">Domain</th>
              <th className="text-left px-4 py-3">Owner</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {domains.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[var(--muted-foreground)]">
                  No user domains yet.
                </td>
              </tr>
            ) : (
              domains.map((d: any) => (
                <tr key={d.id} className="hover:bg-[var(--muted)]">
                  <td className="px-4 py-3 font-mono font-semibold text-[var(--foreground)]">
                    {d.domain}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {(d.profiles as any)?.email ?? d.user_id}
                  </td>
                  <td className="px-4 py-3">
                    {d.verified ? (
                      <Pill>Verified</Pill>
                    ) : (
                      <span className="text-xs text-foreground font-semibold">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete user domain ${d.domain}?`)) delMut.mutate(d.id);
                      }}
                      className="border-rose-300 text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ============================================================================
// SUPPORT TAB (Admin)
// ============================================================================
function SupportTab() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getSupportStatus);
  const toggleFn = useServerFn(toggleSupport);
  const listFn = useServerFn(adminListTickets);
  const replyFn = useServerFn(adminReplyTicket);
  const closeFn = useServerFn(adminCloseTicket);
  const delFn = useServerFn(adminDeleteTicket);

  const [filter, setFilter] = useState<"all" | "open" | "replied" | "closed">("open");
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const statusQ = useQuery({
    queryKey: ["support-status-admin"],
    queryFn: () => statusFn(),
    staleTime: 30_000,
  });
  const ticketsQ = useQuery({
    queryKey: ["admin-tickets", filter],
    queryFn: () => listFn({ data: { status: filter, limit: 200 } }),
    staleTime: 15_000,
  });

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => toggleFn({ data: { enabled } }),
    onSuccess: (r) => {
      toast.success(r.enabled ? "Support enabled" : "Support disabled");
      qc.invalidateQueries({ queryKey: ["support-status-admin"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const replyMut = useMutation({
    mutationFn: (d: { ticket_id: string; reply: string }) => replyFn({ data: d }),
    onSuccess: (_r, vars) => {
      toast.success("Reply sent");
      setReplyMap((m) => ({ ...m, [vars.ticket_id]: "" }));
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const closeMut = useMutation({
    mutationFn: (id: string) => closeFn({ data: { ticket_id: id } }),
    onSuccess: () => {
      toast.success("Closed");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { ticket_id: id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  const enabled = statusQ.data?.enabled !== false;
  const tickets = ticketsQ.data ?? [];

  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-2xl glass-card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${enabled ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-gray-400 to-gray-600"} shadow-md`}
          >
            <LifeBuoy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-[var(--foreground)]">Support System</div>
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {enabled ? "Users can send messages" : "New tickets are disabled"}
            </div>
          </div>
        </div>
        <button
          onClick={() => toggleMut.mutate(!enabled)}
          disabled={toggleMut.isPending}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-2 transition-all ${enabled ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"}`}
        >
          {enabled ? (
            <>
              <PowerOff className="w-3.5 h-3.5" /> Disable
            </>
          ) : (
            <>
              <Power className="w-3.5 h-3.5" /> Enable
            </>
          )}
        </button>
      </div>

      <div className="flex gap-1 bg-[var(--border)]/60 p-1 rounded-xl w-fit">
        {(["all", "open", "replied", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all ${filter === s ? "bg-[var(--primary)] text-primary-foreground shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)]"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {ticketsQ.isLoading && (
          <div className="text-xs text-[var(--muted-foreground)] p-6 text-center">Loading…</div>
        )}
        {!ticketsQ.isLoading && tickets.length === 0 && (
          <div className="text-xs text-[var(--muted-foreground)] p-10 text-center glass-card rounded-2xl">
            No tickets
          </div>
        )}
        {tickets.map((t: any) => (
          <div key={t.id} className="rounded-2xl glass-card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-muted text-foreground" : t.status === "replied" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {t.status}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="font-bold text-sm text-[var(--foreground)]">{t.subject}</div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  From: {t.user_email ?? t.user_name ?? t.user_id}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {t.status !== "closed" && (
                  <button
                    onClick={() => closeMut.mutate(t.id)}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-border text-muted-foreground flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm("Delete?")) delMut.mutate(t.id);
                  }}
                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-[var(--muted)] border border-[var(--border)] p-3 mb-3">
              <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">
                User message
              </div>
              <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed">{t.message}</div>
            </div>
            {t.admin_reply && (
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-3 mb-3">
                <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">
                  Previous reply
                </div>
                <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed">
                  {t.admin_reply}
                </div>
              </div>
            )}
            {t.status !== "closed" && (
              <div className="flex gap-2">
                <textarea
                  value={replyMap[t.id] ?? ""}
                  onChange={(e) => setReplyMap((m) => ({ ...m, [t.id]: e.target.value }))}
                  placeholder="Type your reply…"
                  rows={2}
                  className="flex-1 bg-muted/70 border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[var(--primary)]/50 resize-none"
                />
                <button
                  onClick={() => {
                    const r = (replyMap[t.id] ?? "").trim();
                    if (!r) return toast.error("Reply empty");
                    replyMut.mutate({ ticket_id: t.id, reply: r });
                  }}
                  disabled={replyMut.isPending}
                  className="px-4 rounded-xl bg-primary-gradient text-white font-bold text-xs shadow-md hover:shadow-lg inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// BROADCASTS TAB (Admin)
// ============================================================================
const BROADCAST_ICONS = [
  { id: "sparkles", Icon: Sparkles },
  { id: "megaphone", Icon: Megaphone },
  { id: "gift", Icon: Gift },
  { id: "crown", Icon: Crown },
  { id: "rocket", Icon: Rocket },
  { id: "trophy", Icon: Trophy },
  { id: "star", Icon: Star },
  { id: "zap", Icon: Zap },
  { id: "info", Icon: Info },
  { id: "warning", Icon: AlertTriangle },
];
const BROADCAST_TONES = [
  { id: "premium", label: "Premium", cls: "from-[var(--primary)] to-[var(--primary-glow)]" },
  { id: "info", label: "Info", cls: "from-blue-500 to-blue-600" },
  { id: "success", label: "Success", cls: "from-emerald-500 to-emerald-600" },
  { id: "warning", label: "Warning", cls: "from-primary to-primary-glow" },
] as const;

function BroadcastsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListBroadcasts);
  const createFn = useServerFn(adminCreateBroadcast);
  const toggleFn = useServerFn(adminToggleBroadcast);
  const delFn = useServerFn(adminDeleteBroadcast);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const icon = "sparkles";
  const [tone, setTone] = useState<"premium" | "info" | "success" | "warning">("premium");

  const listQ = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => createFn({ data: d }),
    onSuccess: () => {
      toast.success("Broadcast sent to all users");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (d: { id: string; is_active: boolean }) => toggleFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-broadcasts"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    },
  });

  const items = listQ.data ?? [];
  const PreviewIcon = BROADCAST_ICONS.find((i) => i.id === icon)?.Icon ?? Sparkles;
  const previewTone = BROADCAST_TONES.find((t) => t.id === tone) ?? BROADCAST_TONES[0];

  return (
    <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Composer */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl glass-card overflow-hidden">
          <div className="px-5 py-4 bg-primary/5 border-b border-border flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-sm font-extrabold">Send Broadcast</h3>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="mt-1 w-full bg-muted/70 border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[var(--primary)]/50"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">
                  Message ({body.length}/2000) — Markdown supported
                </label>
              </div>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {[
                  { label: "B", title: "Bold", wrap: "**" },
                  { label: "I", title: "Italic", wrap: "*" },
                  { label: "H", title: "Heading", prefix: "## " },
                  { label: "• List", title: "Bullet", prefix: "- " },
                  { label: "1. List", title: "Numbered", prefix: "1. " },
                  { label: "Link", title: "Link", insert: "[text](https://)" },
                  { label: "---", title: "Divider", insert: "\n---\n" },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(
                        "broadcast-body",
                      ) as HTMLTextAreaElement | null;
                      if (!el) return;
                      const s = el.selectionStart,
                        e = el.selectionEnd;
                      const sel = body.slice(s, e);
                      let next = body;
                      if (b.wrap)
                        next =
                          body.slice(0, s) +
                          b.wrap +
                          (sel || b.title.toLowerCase()) +
                          b.wrap +
                          body.slice(e);
                      else if (b.prefix)
                        next = body.slice(0, s) + b.prefix + (sel || b.title) + body.slice(e);
                      else if (b.insert) next = body.slice(0, s) + b.insert + body.slice(e);
                      setBody(next.slice(0, 2000));
                      setTimeout(() => el.focus(), 0);
                    }}
                    title={b.title}
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <textarea
                id="broadcast-body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 2000))}
                rows={8}
                placeholder={
                  "## 🏆 The Prize: $500 Bonus\n\nDear members,\n\n**Event Timeline:**\n- Start: Right now\n- End: July 15th\n\n1. Fire up your links\n2. Scale your traffic\n3. Monitor dashboard"
                }
                className="w-full bg-muted/70 border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[var(--primary)]/50 resize-y font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">
                Tone
              </label>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {BROADCAST_TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`py-2 rounded-lg text-[11px] font-bold transition-all ${tone === t.id ? `bg-gradient-to-r ${t.cls} text-primary-foreground shadow-md` : "bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)]"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                if (!title.trim() || !body.trim()) return toast.error("Title + message required");
                createMut.mutate({ title: title.trim(), body: body.trim(), icon, tone });
              }}
              disabled={createMut.isPending}
              className="w-full bg-primary-gradient text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-glow hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />{" "}
              {createMut.isPending ? "Sending…" : "Broadcast to all users"}
            </button>
          </div>
        </div>

        {/* Preview */}
        {(title || body) && (
          <div className="rounded-2xl glass-card p-4">
            <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-3">
              Live preview
            </div>
            <div className="flex gap-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${previewTone.cls} flex items-center justify-center shadow-md`}
              >
                <PreviewIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-[var(--foreground)]">
                  {title || "Title…"}
                </div>
                <div className="mt-1">
                  {body ? (
                    <BroadcastMarkdown>{body}</BroadcastMarkdown>
                  ) : (
                    <div className="text-[11.5px] text-[var(--muted-foreground)]">
                      Your message…
                    </div>
                  )}
                </div>
                {tone === "premium" && (
                  <span
                    className={`inline-block mt-2 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r ${previewTone.cls} text-primary-foreground uppercase`}
                  >
                    ✨ Premium
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]">
            Published notices
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {items.filter((b: any) => b.is_active).length} live
            </span>
            <span className="px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]">
              {items.length} total
            </span>
          </div>
        </div>
        {listQ.isLoading && (
          <div className="text-xs text-[var(--muted-foreground)] p-6 text-center">Loading…</div>
        )}
        {!listQ.isLoading && items.length === 0 && (
          <div className="text-xs text-[var(--muted-foreground)] p-10 text-center glass-card rounded-2xl">
            No broadcasts yet
          </div>
        )}
        {items.map((b: any) => {
          const Icon = BROADCAST_ICONS.find((i) => i.id === b.icon)?.Icon ?? Sparkles;
          const t = BROADCAST_TONES.find((x) => x.id === b.tone) ?? BROADCAST_TONES[0];
          return (
            <div
              key={b.id}
              className={`group relative rounded-2xl glass-card overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${b.is_active ? "" : "opacity-55"}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${t.cls}`} />
              <div className="p-4 pl-5 flex gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${t.cls} flex items-center justify-center shadow-lg shrink-0 group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm truncate">{b.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold text-[var(--muted-foreground)]">
                        <span
                          className={`px-1.5 py-0.5 rounded-md bg-gradient-to-r ${t.cls} text-primary-foreground uppercase tracking-wide`}
                        >
                          {t.label}
                        </span>
                        <span>{new Date(b.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleMut.mutate({ id: b.id, is_active: !b.is_active })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-colors ${b.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"}`}
                      >
                        {b.is_active ? "● Live" : "Paused"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete?")) delMut.mutate(b.id);
                        }}
                        className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <BroadcastMarkdown muted>{b.body}</BroadcastMarkdown>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// Errors Tab — runtime error / bug viewer (admin debugging)
// ============================================================
function ErrorsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListErrors);
  const statsFn = useServerFn(adminErrorStats);
  const resolveFn = useServerFn(adminResolveError);
  const deleteFn = useServerFn(adminDeleteError);
  const clearFn = useServerFn(adminClearResolvedErrors);
  const [source, setSource] = useState<string>("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = useQuery({
    queryKey: ["adminErrorStats"],
    queryFn: () => statsFn(),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const rows = useQuery({
    queryKey: ["adminListErrors", source, onlyOpen],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const resolveM = useMutation({
    mutationFn: (v: { id: string; is_resolved: boolean }) => resolveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminListErrors"] });
      qc.invalidateQueries({ queryKey: ["adminErrorStats"] });
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminListErrors"] });
      qc.invalidateQueries({ queryKey: ["adminErrorStats"] });
      toast.success("Deleted");
    },
  });
  const clearM = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminListErrors"] });
      qc.invalidateQueries({ queryKey: ["adminErrorStats"] });
      toast.success("Cleared resolved");
    },
  });

  const sources = Object.keys(stats.data?.bySource ?? {}).sort();

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox
          label="Total"
          value={stats.data?.total ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatBox
          label="Last 24h"
          value={stats.data?.last24h ?? 0}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatBox label="Open" value={stats.data?.open ?? 0} icon={<Bot className="h-4 w-4" />} />
        <StatBox label="Sources" value={sources.length} icon={<Info className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-card/60 backdrop-blur border border-[var(--primary)]/20 rounded-2xl p-3">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="text-sm bg-card border border-[var(--primary)]/30 rounded-lg px-3 py-1.5"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s} ({stats.data?.bySource?.[s] ?? 0})
            </option>
          ))}
        </select>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
          />
          Only unresolved
        </label>
        <Button size="sm" variant="outline" onClick={() => rows.refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (confirm("Delete all resolved errors?")) clearM.mutate();
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Clear resolved
        </Button>
        <span className="ml-auto text-xs text-[var(--muted-foreground)]/60">
          Auto-refresh 15s • cap 10k rows
        </span>
      </div>

      <div className="bg-card/60 backdrop-blur border border-[var(--primary)]/20 rounded-2xl overflow-hidden">
        {rows.isLoading ? (
          <div className="p-8 text-center text-[var(--muted-foreground)]/60">Loading…</div>
        ) : (rows.data?.rows.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-[var(--muted-foreground)]/60">No errors 🎉</div>
        ) : (
          <ul className="divide-y divide-[var(--primary)]/15">
            {rows.data?.rows.map((r) => {
              const isOpen = expanded === r.id;
              return (
                <li key={r.id} className="p-3 hover:bg-[var(--muted)]/60">
                  <div className="flex items-start gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.level === "error"
                          ? "bg-red-100 text-red-700"
                          : r.level === "warn"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {r.level}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--primary)]/15 text-[var(--primary)] font-semibold">
                      {r.source}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.message}</div>
                      <div className="text-xs text-[var(--muted-foreground)]/60">
                        {new Date(r.created_at).toLocaleString()}
                        {r.link_id ? ` • link:${r.link_id.slice(0, 8)}` : ""}
                        {r.is_resolved ? " • ✅ resolved" : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolveM.mutate({ id: r.id, is_resolved: !r.is_resolved })}
                      title={r.is_resolved ? "Mark unresolved" : "Mark resolved"}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Delete this error?")) deleteM.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="mt-2 ml-2 space-y-2 text-xs">
                      {r.context && (
                        <pre className="bg-black/5 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {typeof r.context === "string"
                            ? r.context
                            : JSON.stringify(r.context, null, 2)}
                        </pre>
                      )}
                      {r.stack && (
                        <pre className="bg-black/5 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-64">
                          {r.stack}
                        </pre>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-card/60 backdrop-blur border border-[var(--primary)]/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)]/70 text-xs">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function ResetAllClicksPanel() {
  const qc = useQueryClient();
  const resetFn = useServerFn(adminResetAllClicks);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ cleared?: number; reset_at?: string } | null>(
    null,
  );

  const onReset = async () => {
    if (
      !confirm(
        "Reset ALL clicks for every user now? Links and accounts will NOT be affected. This cannot be undone.",
      )
    )
      return;
    if (!confirm("Are you absolutely sure? Type OK in the next prompt to confirm.")) return;
    const ans = prompt('Type "RESET" to confirm:');
    if (ans !== "RESET") {
      toast.error("Cancelled");
      return;
    }
    try {
      setRunning(true);
      const r: any = await resetFn();
      setLastResult({ cleared: r?.cleared, reset_at: r?.reset_at });
      toast.success(
        `Cleared ${Number(r?.cleared ?? 0).toLocaleString()} click rows. All users will see a notice on next login.`,
      );
      qc.invalidateQueries({ queryKey: ["admin-purge-status"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Reset failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel
      icon={RefreshCw}
      title="Reset All Clicks"
      subtitle="Wipe every click record across all users (links & accounts preserved)"
    >
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="font-bold text-rose-800">Full Click Reset</h4>
            <p className="text-sm text-rose-700 mt-1">
              Deletes every raw click, daily stat, and resets all link/user click counters to 0.
              Runs automatically every Sunday 03:00 UTC. Users will see a one-time popup on next
              login.
            </p>
            {lastResult && (
              <p className="text-xs text-rose-700/80 mt-2 font-mono">
                Last manual reset: {lastResult.cleared?.toLocaleString()} rows cleared @{" "}
                {lastResult.reset_at?.slice(0, 19).replace("T", " ")} UTC
              </p>
            )}
          </div>
          <Button
            onClick={onReset}
            disabled={running}
            className="bg-rose-600 hover:bg-rose-700 text-primary-foreground"
          >
            {running ? "Resetting…" : "Reset Now"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function MaintenanceTab() {
  const qc = useQueryClient();
  const inactiveFn = useServerFn(adminGetInactiveUsers);
  const delUsersFn = useServerFn(adminDeleteUsers);
  const getStatusFn = useServerFn(adminGetPurgeStatus);
  const purgeBatchFn = useServerFn(adminPurgeBatch);

  const dormantFn = useServerFn(adminGetDormantUsers);
  const [dormantDays, setDormantDays] = useState(15);
  const [dormantSelected, setDormantSelected] = useState<Set<string>>(new Set());

  const q = useQuery({ queryKey: ["admin-inactive-users"], queryFn: () => inactiveFn() });
  const dormantQ = useQuery({
    queryKey: ["admin-dormant-users", dormantDays],
    queryFn: () => dormantFn({ data: { days: dormantDays } }),
  });
  const statusQ = useQuery({ queryKey: ["admin-purge-status"], queryFn: () => getStatusFn() });

  const [purging, setPurging] = useState(false);
  const [progress, setProgress] = useState({
    total: 0,
    deleted: 0,
    phase: "" as "" | "clicks" | "errors" | "done",
  });

  const runBatchedPurge = async () => {
    if (!confirm("Run maintenance now? This will purge old click logs in batches.")) return;
    try {
      setPurging(true);
      const status = await getStatusFn();
      const total = (status.oldClicks ?? 0) + (status.oldErrors ?? 0);
      setProgress({ total, deleted: 0, phase: "clicks" });

      if (total === 0) {
        setProgress({ total: 0, deleted: 0, phase: "done" });
        toast.success("Nothing to purge — already clean ✨");
        setPurging(false);
        return;
      }

      let deletedSoFar = 0;
      // Phase 1: clicks
      while (true) {
        const r = await purgeBatchFn({ data: { target: "clicks", batchSize: 2000 } });
        deletedSoFar += r.deleted;
        setProgress({ total, deleted: deletedSoFar, phase: "clicks" });
        if (r.done) break;
      }
      // Phase 2: error_logs
      setProgress({ total, deleted: deletedSoFar, phase: "errors" });
      while (true) {
        const r = await purgeBatchFn({ data: { target: "errors", batchSize: 2000 } });
        deletedSoFar += r.deleted;
        setProgress({ total, deleted: deletedSoFar, phase: "errors" });
        if (r.done) break;
      }

      setProgress({ total, deleted: deletedSoFar, phase: "done" });
      toast.success(`Maintenance completed: ${deletedSoFar.toLocaleString()} rows purged.`);
      qc.invalidateQueries({ queryKey: ["admin-purge-status"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Purge failed");
    } finally {
      setPurging(false);
    }
  };

  const delUsers = useMutation({
    mutationFn: (ids: string[]) => delUsersFn({ data: { ids } }),
    onSuccess: () => {
      toast.success("Selected accounts deleted.");
      qc.invalidateQueries({ queryKey: ["admin-inactive-users"] });
      qc.invalidateQueries({ queryKey: ["admin-dormant-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inactiveUsers = q.data ?? [];
  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.deleted / progress.total) * 100)) : 0;
  const eligible = (statusQ.data?.oldClicks ?? 0) + (statusQ.data?.oldErrors ?? 0);

  return (
    <div className="space-y-6">
      <Panel icon={RefreshCw} title="System Maintenance" subtitle="Run manual maintenance tasks">
        <div className="p-4 rounded-2xl bg-muted border border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-foreground">Purge Raw Click Logs</h4>
              <p className="text-sm text-foreground mt-1">
                Archives lifetime totals first, then deletes raw per-click records older than 7
                days. Totals, earnings and daily charts are kept forever.
              </p>
              <p className="text-xs text-foreground/80 mt-1">
                Eligible for purge: <b>{(statusQ.data?.oldClicks ?? 0).toLocaleString()}</b> clicks
                {" + "}
                <b>{(statusQ.data?.oldErrors ?? 0).toLocaleString()}</b> error logs
                {" = "}
                <b>{eligible.toLocaleString()}</b> total
              </p>
            </div>
            <Button
              onClick={runBatchedPurge}
              disabled={purging}
              className="bg-foreground hover:bg-foreground text-primary-foreground"
            >
              {purging ? "Purging…" : "Run Now"}
            </Button>
          </div>

          {(purging || progress.phase === "done") && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-foreground">
                <span>
                  {progress.phase === "clicks" && "Phase 1/2: Purging old clicks…"}
                  {progress.phase === "errors" && "Phase 2/2: Purging old error logs…"}
                  {progress.phase === "done" && "✅ Completed"}
                </span>
                <span className="font-mono">
                  {progress.deleted.toLocaleString()} / {progress.total.toLocaleString()} ({pct}%)
                </span>
              </div>
              <Progress value={pct} className="h-3" />
            </div>
          )}
        </div>
      </Panel>

      <ResetAllClicksPanel />

      <QuotaSyncTestPanel />
      <QuotaSyncStatusPanel />

      <Panel
        icon={Users}
        title="Dormant Users"
        subtitle="Filter accounts with no login for N days — delete them with all links & click data"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-[var(--muted-foreground)]">No login for</label>
          <select
            value={dormantDays}
            onChange={(e) => {
              setDormantDays(Number(e.target.value));
              setDormantSelected(new Set());
            }}
            className="rounded-lg border border-[var(--border)] bg-card px-3 py-1.5 text-sm"
          >
            {[15, 30, 45, 60, 90, 180].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
          <span className="text-sm text-[var(--muted-foreground)]">
            {(dormantQ.data ?? []).length} account(s) matched
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const all = (dormantQ.data ?? []).map((u: any) => u.id);
                setDormantSelected((prev) => (prev.size === all.length ? new Set() : new Set(all)));
              }}
            >
              Select all
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={dormantSelected.size === 0 || delUsers.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Delete ${dormantSelected.size} dormant account(s) with all links and click data? This cannot be undone.`,
                  )
                ) {
                  delUsers.mutate([...dormantSelected]);
                  setDormantSelected(new Set());
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete selected
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Last login</th>
                <th className="text-right px-4 py-3">Idle days</th>
                <th className="text-right px-4 py-3">Links</th>
                <th className="text-right px-4 py-3">Lifetime clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(dormantQ.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--muted-foreground)]">
                    No dormant accounts for this filter.
                  </td>
                </tr>
              ) : (
                (dormantQ.data ?? []).map((u: any) => (
                  <tr key={u.id} className="hover:bg-[var(--muted)]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.email}`}
                        checked={dormantSelected.has(u.id)}
                        onChange={() =>
                          setDormantSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(u.id)) next.delete(u.id);
                            else next.add(u.id);
                            return next;
                          })
                        }
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{u.email}</td>
                    <td className="px-4 py-3 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{u.days_inactive}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{u.links_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {Number(u.total_clicks).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Nothing is deleted automatically. Data is only removed when you delete an account here.
        </p>
      </Panel>

      <Panel
        icon={Users}
        title="Never-activated Users"
        subtitle="Signed up >7 days ago and never used the service"
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Found {inactiveUsers.length} such accounts.
        </p>
      </Panel>
    </div>
  );
}

function QuotaSyncTestPanel() {
  const testFn = useServerFn(adminTestQuotaSync);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [pkg, setPkg] = useState("monthly");
  const [result, setResult] = useState<Awaited<ReturnType<typeof testFn>> | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!email.trim()) {
      toast.error("Enter a user email");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const r = await testFn({ data: { email: email.trim().toLowerCase(), package_slug: pkg } });
      setResult(r);
      if (r.pass) toast.success("Quota sync test PASSED ✅");
      else toast.error("Quota sync test FAILED ❌ — see log below");
      qc.invalidateQueries({ queryKey: ["admin-quota-sync-status"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel
      icon={ShieldCheck}
      title="Quota Sync Test"
      subtitle="Read-only verification — this never changes quota, usage, or expiry"
    >
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs font-bold text-sky-900">Test user email</Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-sky-900">Package to apply</Label>
            <select
              value={pkg}
              onChange={(e) => setPkg(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="monthly">monthly</option>
              <option value="lifetime">lifetime</option>
              <option value="unlimited">unlimited</option>
              <option value="free">free</option>
            </select>
          </div>
        </div>
        <Button
          onClick={run}
          disabled={running}
          className="bg-sky-600 hover:bg-sky-700 text-primary-foreground"
        >
          {running ? "Checking…" : "Check Quota Sync"}
        </Button>

        {result && (
          <div className="space-y-3 pt-2">
            <div
              className={`p-3 rounded-xl border ${result.pass ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-rose-50 border-rose-300 text-rose-900"}`}
            >
              <div className="font-bold text-sm">
                {result.pass
                  ? "🎉 PASS — Quota sync is working"
                  : "🚨 FAIL — Quota sync did NOT apply expected values"}
              </div>
              <div className="text-xs mt-1 opacity-80">Started at {result.startedAt}</div>
            </div>

            {result.before && result.expected && result.after && (
              <div className="overflow-x-auto rounded-xl border border-sky-200 bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-sky-100 text-sky-900">
                    <tr>
                      <th className="text-left px-3 py-2">Field</th>
                      <th className="text-left px-3 py-2">BEFORE</th>
                      <th className="text-left px-3 py-2">EXPECTED</th>
                      <th className="text-left px-3 py-2">AFTER</th>
                      <th className="text-left px-3 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100 font-mono">
                    <Row
                      label="plan_slug"
                      before={result.before.plan_slug}
                      expected={result.expected.plan_slug}
                      after={result.after.plan_slug}
                    />
                    <Row
                      label="click_quota"
                      before={result.before.click_quota}
                      expected={result.expected.click_quota}
                      after={result.after.click_quota}
                    />
                    <Row
                      label="link_limit"
                      before={result.before.link_limit}
                      expected={result.expected.link_limit}
                      after={result.after.link_limit}
                    />
                  </tbody>
                </table>
              </div>
            )}

            <details
              open
              className="rounded-xl border border-sky-200 bg-slate-900 text-slate-100 overflow-hidden"
            >
              <summary className="cursor-pointer px-3 py-2 text-xs font-bold bg-slate-800">
                Detailed log ({result.log.length} entries)
              </summary>
              <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
                {result.log.join("\n")}
              </pre>
            </details>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Row({
  label,
  before,
  expected,
  after,
}: {
  label: string;
  before: any;
  expected: any;
  after: any;
}) {
  const match = after === expected;
  return (
    <tr>
      <td className="px-3 py-2 font-bold">{label}</td>
      <td className="px-3 py-2 text-slate-500">{before === null ? "NULL" : String(before)}</td>
      <td className="px-3 py-2">{expected === null ? "NULL (unlimited)" : String(expected)}</td>
      <td className="px-3 py-2 font-bold">{after === null ? "NULL" : String(after)}</td>
      <td className="px-3 py-2">{match ? "✅" : "❌"}</td>
    </tr>
  );
}

function QuotaSyncStatusPanel() {
  const statusFn = useServerFn(adminQuotaSyncStatus);
  const fixFn = useServerFn(adminFixUnlimitedMonthly);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-quota-sync-status"], queryFn: () => statusFn() });

  const fix = useMutation({
    mutationFn: () => fixFn(),
    onSuccess: (r: any) => {
      toast.success(`Fixed ${r.fixed} monthly users (scanned ${r.scanned}).`);
      qc.invalidateQueries({ queryKey: ["admin-quota-sync-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data;
  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const mismatches = rows.filter((r: any) => !r.ok);

  return (
    <Panel
      icon={ShieldCheck}
      title="Quota Sync Status"
      subtitle="Live verification from package allowance + successful renewals; repair never adds quota or days"
    >
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>
          <RefreshCw className={`w-3 h-3 mr-2 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {mismatches.length > 0 && (
          <Button
            size="sm"
            onClick={() => fix.mutate()}
            disabled={fix.isPending}
            className="bg-foreground hover:bg-foreground text-primary-foreground"
          >
            {fix.isPending ? "Repairing…" : `Repair ${mismatches.length} mismatched`}
          </Button>
        )}
        {summary && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold">
              ✅ OK: {summary.ok}
            </span>
            <span
              className={`px-2 py-1 rounded-md font-bold ${summary.mismatches > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"}`}
            >
              ❌ Mismatch: {summary.mismatches}
            </span>
            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700">
              Total paid: {summary.total}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-card/70">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-right px-4 py-3">click_quota</th>
              <th className="text-right px-4 py-3">expected</th>
              <th className="text-right px-4 py-3">link_limit</th>
              <th className="text-right px-4 py-3">expected</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[var(--muted-foreground)]">
                  {q.isLoading ? "Loading…" : "No paid users."}
                </td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr
                  key={r.id}
                  className={r.ok ? "hover:bg-emerald-50/40" : "bg-rose-50/60 hover:bg-rose-50"}
                >
                  <td className="px-4 py-3 font-medium">{r.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono px-2 py-1 rounded bg-slate-100">
                      {r.plan_slug}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {r.click_quota === null ? "NULL" : Number(r.click_quota).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                    {r.expected_click_quota === null
                      ? "NULL"
                      : Number(r.expected_click_quota).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {r.link_limit === null ? "NULL" : r.link_limit}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                    {r.expected_link_limit === null ? "NULL" : r.expected_link_limit}
                  </td>
                  <td className="px-4 py-3">
                    {r.ok ? (
                      <span className="text-xs font-bold text-emerald-700">✅ OK</span>
                    ) : (
                      <span className="text-xs font-bold text-rose-700">❌ {r.issue}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ============================================================================
// Offer Domain Health Monitor — SSL + DNS + HTTP + Blacklist
// ============================================================================
function DomainHealthTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMonitoredDomains);
  const addFn = useServerFn(addMonitoredDomain);
  const toggleFn = useServerFn(toggleMonitoredDomain);
  const delFn = useServerFn(deleteMonitoredDomain);
  const syncFn = useServerFn(syncOfferDomainsFromLinks);
  const scanOneFn = useServerFn(scanMonitoredDomain);
  const scanAllFn = useServerFn(scanAllMonitoredDomains);

  const q = useQuery({
    queryKey: ["monitored-domains"],
    queryFn: () => listFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [domain, setDomain] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["monitored-domains"] });

  const add = useMutation({
    mutationFn: () => addFn({ data: { domain } }),
    onSuccess: () => {
      setDomain("");
      toast.success("Domain added");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r: any) => {
      toast.success(`Synced ${r.total} domain(s) from active links`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Sync failed"),
  });
  const scanOne = useMutation({
    mutationFn: (id: string) => scanOneFn({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`Scanned — ${r.result.status}`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Scan failed"),
  });
  const scanAll = useMutation({
    mutationFn: () => scanAllFn(),
    onSuccess: (r: any) => {
      toast.success(`Scanned ${r.scanned} (${r.critical} critical)`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Scan failed"),
  });

  const list: any[] = q.data?.domains ?? [];
  const counts = useMemo(() => {
    const c = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
    for (const d of list) {
      if (d.status === "healthy") c.healthy++;
      else if (d.status === "warning") c.warning++;
      else if (d.status === "critical") c.critical++;
      else c.unknown++;
    }
    return c;
  }, [list]);

  const statusBadge = (s: string | null) => {
    const map: Record<string, string> = {
      healthy: "bg-emerald-100 text-emerald-700 border-emerald-200",
      warning: "bg-muted text-foreground border-border",
      critical: "bg-rose-100 text-rose-700 border-rose-200",
    };
    const cls = s
      ? (map[s] ?? "bg-muted text-muted-foreground border-gray-200")
      : "bg-gray-100 text-gray-500 border-gray-200";
    return (
      <span
        className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border ${cls}`}
      >
        {s ?? "—"}
      </span>
    );
  };

  return (
    <section className="rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)]">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
        <h2 className="text-xl font-bold text-[var(--foreground)]">Offer Domain Health Monitor</h2>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        SSL certificate expiry, DNS/HTTP reachability, and DNSBL (Spamhaus / SURBL / URIBL)
        blacklist checks for every offer domain. Auto-scans daily.
      </p>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Healthy" value={counts.healthy} tone="emerald" />
        <KpiCard label="Warning" value={counts.warning} tone="amber" />
        <KpiCard label="Critical" value={counts.critical} tone="rose" />
        <KpiCard label="Not yet scanned" value={counts.unknown} tone="gray" />
      </div>

      {/* Add + actions */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-card text-sm"
        />
        <Button
          onClick={() => add.mutate()}
          disabled={!domain || add.isPending}
          className="bg-[var(--primary)] hover:bg-[var(--primary)] text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-1 ${sync.isPending ? "animate-spin" : ""}`} /> Sync from
          links
        </Button>
        <Button onClick={() => scanAll.mutate()} disabled={scanAll.isPending} variant="outline">
          <Zap className={`w-4 h-4 mr-1 ${scanAll.isPending ? "animate-pulse" : ""}`} /> Scan all
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-card">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-[var(--muted-foreground)] text-xs uppercase">
            <tr>
              <th className="text-left p-3">Domain</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">SSL</th>
              <th className="text-left p-3">DNS / HTTP</th>
              <th className="text-left p-3">Blacklist</th>
              <th className="text-left p-3">Last check</th>
              <th className="text-left p-3">Source</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[var(--muted-foreground)]">
                  Loading…
                </td>
              </tr>
            )}
            {!q.isLoading && list.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[var(--muted-foreground)]">
                  No domains yet. Click <strong>"Sync from links"</strong> to auto-import your offer
                  URLs, or add one manually above.
                </td>
              </tr>
            )}
            {list.map((d) => {
              const sslDays = d.ssl_days_remaining;
              const sslText =
                sslDays == null
                  ? "—"
                  : sslDays < 0
                    ? `Expired ${Math.abs(sslDays)}d ago`
                    : sslDays <= 14
                      ? `⚠ ${sslDays}d left`
                      : `${sslDays}d left`;
              const sslCls =
                sslDays == null
                  ? "text-gray-500"
                  : sslDays < 0
                    ? "text-rose-700 font-semibold"
                    : sslDays <= 14
                      ? "text-foreground font-semibold"
                      : "text-emerald-700";
              return (
                <tr key={d.id} className="border-t border-[var(--border)] hover:bg-[var(--muted)]">
                  <td className="p-3 font-mono text-[var(--foreground)] break-all">{d.domain}</td>
                  <td className="p-3">{statusBadge(d.status)}</td>
                  <td className={`p-3 ${sslCls}`}>
                    {sslText}
                    {d.ssl_issuer && (
                      <div className="text-[10px] text-gray-500">{d.ssl_issuer}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className={d.dns_ok ? "text-emerald-700" : "text-rose-700 font-semibold"}>
                      DNS {d.dns_ok ? "OK" : "FAIL"}
                    </div>
                    <div className="text-xs text-gray-600">
                      HTTP {d.http_status ?? "—"}
                      {d.redirect_count ? ` · ${d.redirect_count} redirects` : ""}
                    </div>
                  </td>
                  <td className="p-3">
                    {d.blacklisted ? (
                      <span className="text-rose-700 font-semibold text-xs">
                        ⛔ {(d.blacklist_sources || []).join(", ") || "Listed"}
                      </span>
                    ) : (
                      <span className="text-emerald-700 text-xs">Clean</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-[var(--muted-foreground)]">
                    {d.last_checked_at ? new Date(d.last_checked_at).toLocaleString() : "never"}
                  </td>
                  <td className="p-3 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] ${
                        d.source === "auto"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                      }`}
                    >
                      {d.source}
                    </span>
                    {!d.is_active && <span className="ml-1 text-gray-500">(paused)</span>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => scanOne.mutate(d.id)}
                        disabled={scanOne.isPending}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggle.mutate({ id: d.id, is_active: !d.is_active })}
                      >
                        {d.is_active ? (
                          <PowerOff className="w-3 h-3" />
                        ) : (
                          <Power className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remove ${d.domain}?`)) del.mutate(d.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "gray";
}) {
  const map = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-muted border-border text-foreground",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    gray: "bg-gray-50 border-gray-200 text-gray-600",
  } as const;
  return (
    <div className={`rounded-2xl border p-4 ${map[tone]}`}>
      <div className="text-xs uppercase font-semibold opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
