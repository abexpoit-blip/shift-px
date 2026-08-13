import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Shield, Globe2, Bot, MapPin, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listCloakingRules, upsertCloakingRule, deleteCloakingRule,
  listReferrerRules, upsertReferrerRule, deleteReferrerRule,
  listBotFingerprints, toggleFingerprintBlock,
  listCountryTiers, upsertCountryTier,
} from "@/lib/smart-filter.functions";

export const Route = createFileRoute("/_authenticated/smart-filter")({
  head: () => ({ meta: [{ title: "Smart Filter — Sleepox" }] }),
  // Auth + admin check runs client-side (parent _authenticated layout is also client-only).
  component: SmartFilterPage,
});

const fld = "w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl px-3 py-2.5 text-sm text-[#2D1B0D] placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white";
const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

type Tab = "cloaking" | "referrer" | "blacklist" | "tiers";

function SmartFilterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("cloaking");
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!data) { navigate({ to: "/dashboard" }); return; }
      setAdminChecked(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!adminChecked) {
    return <div className="p-10 text-sm text-[#7D6452]" style={font}>Verifying admin access…</div>;
  }

  const tabs: { k: Tab; label: string; icon: typeof Shield }[] = [
    { k: "cloaking", label: "Cloaking", icon: Shield },
    { k: "referrer", label: "Referrer", icon: Globe2 },
    { k: "blacklist", label: "Blacklist", icon: Bot },
    { k: "tiers", label: "Country Tiers", icon: MapPin },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto" style={font}>
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm mb-3">
          <Shield className="w-3 h-3" /> Admin · Bot defence
        </div>
        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#2D1B0D]">Smart Filter</h1>
        <p className="text-sm text-[#7D6452] mt-2 max-w-2xl">Cloaking rules, referrer trust, auto-blacklist & country-tier routing — all the layers that decide who sees offer vs safe page.</p>
      </header>

      <div className="flex gap-2 mb-6 border-b border-[#FFEDD5] overflow-x-auto">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
              tab === t.k ? "text-[#FF7E5F] border-[#FF7E5F]" : "text-[#7D6452] hover:text-[#2D1B0D] border-transparent"
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "cloaking" && <CloakingTab />}
        {tab === "referrer" && <ReferrerTab />}
        {tab === "blacklist" && <BlacklistTab />}
        {tab === "tiers" && <CountryTiersTab />}
      </div>
    </div>
  );
}

/* =============== CLOAKING =============== */
function CloakingTab() {
  const qc = useQueryClient();
  const list = useServerFn(listCloakingRules);
  const upsert = useServerFn(upsertCloakingRule);
  const del = useServerFn(deleteCloakingRule);

  const q = useQuery({ queryKey: ["cloak-rules"], queryFn: () => list() });

  const [ruleType, setRuleType] = useState<"ua" | "ip" | "asn" | "country">("ua");
  const [pattern, setPattern] = useState("");
  const [label, setLabel] = useState("");
  const [action, setAction] = useState<"safe" | "block" | "offer">("safe");
  const [priority, setPriority] = useState("100");

  const addMut = useMutation({
    mutationFn: () => upsert({ data: {
      rule_type: ruleType, pattern, label: label || null, action,
      priority: Number(priority) || 100, is_active: true,
    } }),
    onSuccess: () => {
      toast.success("Rule added");
      setPattern(""); setLabel("");
      qc.invalidateQueries({ queryKey: ["cloak-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["cloak-rules"] }); },
  });

  const toggleMut = useMutation({
    mutationFn: (r: { id: string; rule_type: "ua" | "ip" | "asn" | "country"; pattern: string; label: string | null; action: "safe" | "block" | "offer"; priority: number; is_active: boolean }) =>
      upsert({ data: { ...r, is_active: !r.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cloak-rules"] }),
  });

  return (
    <div className="space-y-6">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); addMut.mutate(); }}
        className="rounded-2xl border border-[#FFEDD5] bg-white p-5">
        <h3 className="text-sm font-bold text-[#2D1B0D] mb-3">Add cloaking rule</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <select className={fld + " md:col-span-1"} value={ruleType} onChange={e => setRuleType(e.target.value as "ua" | "ip" | "asn" | "country")}>
            <option value="ua">UA pattern</option>
            <option value="ip">IP / CIDR</option>
            <option value="asn">ASN</option>
            <option value="country">Country</option>
          </select>
          <input className={fld + " md:col-span-2"} required placeholder={ruleType === "ua" ? "facebookexternalhit" : ruleType === "country" ? "US" : "AS15169"} value={pattern} onChange={e => setPattern(e.target.value)} />
          <input className={fld + " md:col-span-2"} placeholder="Label (e.g. Facebook reviewer)" value={label} onChange={e => setLabel(e.target.value)} />
          <select className={fld} value={action} onChange={e => setAction(e.target.value as "safe" | "block" | "offer")}>
            <option value="safe">→ safe page</option>
            <option value="block">block 403</option>
            <option value="offer">→ offer page</option>
          </select>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="text-xs text-[#7D6452]">Priority</label>
          <input className={fld + " w-24"} type="number" value={priority} onChange={e => setPriority(e.target.value)} />
          <button type="submit" disabled={addMut.isPending}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-md disabled:opacity-50">
            <Plus className="w-4 h-4" /> {addMut.isPending ? "Adding…" : "Add rule"}
          </button>
        </div>
      </form>

      <RulesTable
        loading={q.isLoading}
        rows={q.data ?? []}
        empty="No cloaking rules — seeded defaults will apply."
        cols={[
          { h: "Type", render: (r) => <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#FFEDD5] text-[#FF7E5F]">{r.rule_type}</span> },
          { h: "Pattern", render: (r) => <span className="font-mono text-xs">{r.pattern}</span> },
          { h: "Label", render: (r) => <span className="text-xs text-[#7D6452]">{r.label ?? "—"}</span> },
          { h: "Action", render: (r) => <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${r.action === "block" ? "bg-rose-100 text-rose-700" : r.action === "safe" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{r.action}</span> },
          { h: "Prio", render: (r) => <span className="text-xs text-[#A38D7D]">{r.priority}</span> },
        ]}
        onToggle={(r) => toggleMut.mutate(r as unknown as Parameters<typeof toggleMut.mutate>[0])}
        onDelete={(id) => delMut.mutate(id)}
      />
    </div>
  );
}

/* =============== REFERRER =============== */
function ReferrerTab() {
  const qc = useQueryClient();
  const list = useServerFn(listReferrerRules);
  const upsert = useServerFn(upsertReferrerRule);
  const del = useServerFn(deleteReferrerRule);

  const q = useQuery({ queryKey: ["ref-rules"], queryFn: () => list() });

  const [pattern, setPattern] = useState("");
  const [label, setLabel] = useState("");
  const [trust, setTrust] = useState("70");
  const [action, setAction] = useState<"allow" | "suspect" | "block">("allow");

  const addMut = useMutation({
    mutationFn: () => upsert({ data: { pattern, label: label || null, trust_score: Number(trust), action, is_active: true } }),
    onSuccess: () => { toast.success("Added"); setPattern(""); setLabel(""); qc.invalidateQueries({ queryKey: ["ref-rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ref-rules"] }),
  });
  const toggleMut = useMutation({
    mutationFn: (r: { id: string; pattern: string; label: string | null; trust_score: number; action: "allow" | "suspect" | "block"; is_active: boolean }) =>
      upsert({ data: { ...r, is_active: !r.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ref-rules"] }),
  });

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="rounded-2xl border border-[#FFEDD5] bg-white p-5">
        <h3 className="text-sm font-bold text-[#2D1B0D] mb-3">Add referrer rule</h3>
        <div className="grid md:grid-cols-5 gap-2">
          <input className={fld + " md:col-span-2"} required placeholder="facebook.com" value={pattern} onChange={e => setPattern(e.target.value)} />
          <input className={fld + " md:col-span-2"} placeholder="Label (Facebook social)" value={label} onChange={e => setLabel(e.target.value)} />
          <select className={fld} value={action} onChange={e => setAction(e.target.value as "allow" | "suspect" | "block")}>
            <option value="allow">allow</option>
            <option value="suspect">suspect</option>
            <option value="block">block</option>
          </select>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="text-xs text-[#7D6452]">Trust score (0-100)</label>
          <input className={fld + " w-24"} type="number" min={0} max={100} value={trust} onChange={e => setTrust(e.target.value)} />
          <button type="submit" disabled={addMut.isPending}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-md disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </form>

      <RulesTable
        loading={q.isLoading}
        rows={q.data ?? []}
        empty="No referrer rules — seeded defaults apply."
        cols={[
          { h: "Pattern", render: (r) => <span className="font-mono text-xs">{r.pattern}</span> },
          { h: "Label", render: (r) => <span className="text-xs text-[#7D6452]">{r.label ?? "—"}</span> },
          { h: "Trust", render: (r) => <span className="text-xs font-bold text-[#2D1B0D]">{r.trust_score}</span> },
          { h: "Action", render: (r) => <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${r.action === "block" ? "bg-rose-100 text-rose-700" : r.action === "suspect" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{r.action}</span> },
        ]}
        onToggle={(r) => toggleMut.mutate(r as unknown as Parameters<typeof toggleMut.mutate>[0])}
        onDelete={(id) => delMut.mutate(id)}
      />
    </div>
  );
}

/* =============== BLACKLIST =============== */
function BlacklistTab() {
  const qc = useQueryClient();
  const list = useServerFn(listBotFingerprints);
  const toggle = useServerFn(toggleFingerprintBlock);

  const q = useQuery({ queryKey: ["bot-fp"], queryFn: () => list(), refetchInterval: 10_000 });

  const tMut = useMutation({
    mutationFn: (v: { hash: string; block: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-fp"] }),
  });

  const fps = q.data ?? [];
  const blocked = fps.filter(f => f.auto_blocked).length;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Tracked fingerprints" value={fps.length.toLocaleString()} icon={Bot} />
        <Stat label="Auto-blocked" value={blocked.toLocaleString()} icon={AlertTriangle} tone="rose" />
        <Stat label="Last 24h hits" value={fps.reduce((s, f) => s + f.hit_count, 0).toLocaleString()} icon={Shield} />
      </div>

      <div className="rounded-2xl border border-[#FFEDD5] bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#FFEDD5]"><h3 className="text-sm font-bold text-[#2D1B0D]">Bot fingerprints (auto-learned)</h3></div>
        {q.isLoading && <div className="p-8 text-center text-sm text-[#A38D7D]">Loading…</div>}
        {!q.isLoading && fps.length === 0 && <div className="p-8 text-center text-sm text-[#7D6452]">No fingerprints tracked yet. They'll appear as traffic flows.</div>}
        {fps.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px] text-sm">
              <thead className="text-[10px] uppercase tracking-[0.18em] text-[#A38D7D] border-b border-[#FFEDD5]">
                <tr>
                  <th className="px-5 py-2 font-bold">Hash</th>
                  <th className="px-5 py-2 font-bold">Hits</th>
                  <th className="px-5 py-2 font-bold">Bot %</th>
                  <th className="px-5 py-2 font-bold">Sample IP</th>
                  <th className="px-5 py-2 font-bold">Country</th>
                  <th className="px-5 py-2 font-bold">Last seen</th>
                  <th className="px-5 py-2 font-bold">Block</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FFEDD5]">
                {fps.map(f => {
                  const botPct = f.hit_count ? Math.round((f.bot_hits / f.hit_count) * 100) : 0;
                  return (
                    <tr key={f.fingerprint_hash} className="hover:bg-[#FFF9F5]">
                      <td className="px-5 py-2 font-mono text-[11px] text-[#2D1B0D]">{f.fingerprint_hash.slice(0, 14)}…</td>
                      <td className="px-5 py-2 tabular-nums">{f.hit_count}</td>
                      <td className="px-5 py-2"><span className={`text-xs font-bold ${botPct > 70 ? "text-rose-600" : botPct > 30 ? "text-amber-600" : "text-emerald-600"}`}>{botPct}%</span></td>
                      <td className="px-5 py-2 font-mono text-[11px] text-[#7D6452]">{f.sample_ip ?? "—"}</td>
                      <td className="px-5 py-2 text-xs">{f.sample_country ?? "—"}</td>
                      <td className="px-5 py-2 text-[11px] text-[#A38D7D]">{new Date(f.last_seen).toLocaleString()}</td>
                      <td className="px-5 py-2">
                        <button onClick={() => tMut.mutate({ hash: f.fingerprint_hash, block: !f.auto_blocked })}>
                          {f.auto_blocked
                            ? <ToggleRight className="w-5 h-5 text-rose-600" />
                            : <ToggleLeft className="w-5 h-5 text-[#7D6452]" />}
                        </button>
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

/* =============== COUNTRY TIERS =============== */
function CountryTiersTab() {
  const qc = useQueryClient();
  const list = useServerFn(listCountryTiers);
  const upsert = useServerFn(upsertCountryTier);

  const q = useQuery({ queryKey: ["country-tiers"], queryFn: () => list() });

  const [code, setCode] = useState("");
  const [tier, setTier] = useState("1");
  const [name, setName] = useState("");

  const addMut = useMutation({
    mutationFn: () => upsert({ data: { country_code: code, tier: Number(tier), country_name: name || undefined } }),
    onSuccess: () => { toast.success("Saved"); setCode(""); setName(""); qc.invalidateQueries({ queryKey: ["country-tiers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const grouped = { 1: rows.filter(r => r.tier === 1), 2: rows.filter(r => r.tier === 2), 3: rows.filter(r => r.tier === 3) };

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="rounded-2xl border border-[#FFEDD5] bg-white p-5">
        <h3 className="text-sm font-bold text-[#2D1B0D] mb-3">Add / update country tier</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input className={fld + " uppercase"} required maxLength={3} placeholder="US" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
          <select className={fld} value={tier} onChange={e => setTier(e.target.value)}>
            <option value="1">Tier 1 (highest)</option>
            <option value="2">Tier 2 (mid)</option>
            <option value="3">Tier 3 (lowest)</option>
          </select>
          <input className={fld + " md:col-span-2"} placeholder="United States" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <button type="submit" disabled={addMut.isPending}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-md disabled:opacity-50">
          <Plus className="w-4 h-4" /> Save
        </button>
      </form>

      <div className="grid md:grid-cols-3 gap-4">
        {([1, 2, 3] as const).map(t => (
          <div key={t} className="rounded-2xl border border-[#FFEDD5] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#2D1B0D]">Tier {t}</h4>
              <span className="text-[10px] font-bold text-[#A38D7D]">{grouped[t].length} countries</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[400px] overflow-y-auto">
              {grouped[t].length === 0 && <p className="text-xs text-[#A38D7D]">None.</p>}
              {grouped[t].map(r => (
                <span key={r.country_code} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFEDD5]/60 text-[11px] font-mono text-[#2D1B0D]" title={r.country_name ?? ""}>
                  {r.country_code}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============== Helpers =============== */
function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Shield; tone?: "rose" }) {
  return (
    <div className="rounded-2xl border border-[#FFEDD5] bg-white p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone === "rose" ? "bg-rose-100 text-rose-600" : "bg-[#FFEDD5] text-[#FF7E5F]"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#A38D7D]">{label}</p>
        <p className="text-xl font-extrabold text-[#2D1B0D] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

type Row = { id: string; is_active: boolean | null; [k: string]: any };
function RulesTable<T extends Row>({
  loading, rows, empty, cols, onToggle, onDelete,
}: {
  loading: boolean; rows: T[]; empty: string;
  cols: { h: string; render: (r: T) => React.ReactNode }[];
  onToggle: (r: T) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#FFEDD5] bg-white overflow-hidden">
      {loading && <div className="p-8 text-center text-sm text-[#A38D7D]">Loading…</div>}
      {!loading && rows.length === 0 && <div className="p-8 text-center text-sm text-[#7D6452]">{empty}</div>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px] text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-[#A38D7D] border-b border-[#FFEDD5]">
              <tr>
                {cols.map(c => <th key={c.h} className="px-5 py-2 font-bold">{c.h}</th>)}
                <th className="px-5 py-2 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FFEDD5]">
              {rows.map(r => (
                <tr key={r.id} className={!r.is_active ? "opacity-50 hover:bg-[#FFF9F5]" : "hover:bg-[#FFF9F5]"}>
                  {cols.map(c => <td key={c.h} className="px-5 py-2.5">{c.render(r)}</td>)}
                  <td className="px-5 py-2.5 text-right">
                    <button onClick={() => onToggle(r)} className="p-1 text-[#7D6452] hover:text-[#FF7E5F]" title="Toggle">
                      {r.is_active ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => { if (confirm("Delete this rule?")) onDelete(r.id); }} className="p-1 text-[#7D6452] hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
