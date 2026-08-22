import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  User,
  KeyRound,
  ShieldCheck,
  Crown,
  Sparkles,
  Calendar,
  Lock,
  Mail,
  CheckCircle2,
  Coins,
  ArrowRight,
  Zap,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMySettings, updateMyProfile, changeMyPassword } from "@/lib/user-settings.functions";
import { getMyPlanStatus } from "@/lib/packages.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account & Profile Settings — AdsPx" },
      {
        name: "description",
        content: "Manage your AdsPx account profile, security credentials and subscription.",
      },
      { property: "og:title", content: "Account & Profile Settings — AdsPx" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const load = useServerFn(getMySettings);
  const loadPlan = useServerFn(getMyPlanStatus);
  const saveProfile = useServerFn(updateMyProfile);
  const savePassword = useServerFn(changeMyPassword);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["my-settings"], queryFn: () => load() });
  const planQ = useQuery({ queryKey: ["my-plan-status"], queryFn: () => loadPlan() });

  const [fullName, setFullName] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    if (q.data) setFullName(q.data.full_name ?? "");
  }, [q.data]);

  const profileMut = useMutation({
    mutationFn: () => saveProfile({ data: { full_name: fullName } }),
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      qc.invalidateQueries({ queryKey: ["my-settings"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update profile"),
  });

  const passwordMut = useMutation({
    mutationFn: () => savePassword({ data: { new_password: pw1 } }),
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setPw1("");
      setPw2("");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update password"),
  });

  const isPremium = planQ.data?.isPremiumActive;
  const email = q.data?.email ?? "";
  const initial = (fullName || email || "U").charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="w-3 h-3" /> Account Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2 text-foreground">
            Profile & Security Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your personal profile, credentials and subscription preferences.
          </p>
        </div>
      </header>

      {/* Hero Profile Showcase Card */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-indigo-500/25 p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with luxury gradient ring */}
          <div className="relative h-24 w-24 rounded-3xl p-[3px] bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 shadow-2xl flex-shrink-0">
            <div className="h-full w-full rounded-[22px] overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center border border-white/40 text-white font-black text-2xl uppercase shadow-inner relative">
              <span>{initial}</span>
              <img
                src={`https://api.dicebear.com/9.x/adventurer/svg?seed=Liam&hair=short01,short02,short03,short04,short05,short16&hairColor=2c1b18,4a3728&skinColor=f2d3b1&backgroundColor=b6e3f4'adspx')}&top=shortHairShortFlat,shortHairShortCurly,shortHairShortWaved,shortHairTheCaesar,shortHairDreads01&facialHairProbability=30&clothingColor=262e33,65c9ff,5199e4,25557c&backgroundColor=b6e3f4,c0e8ff,d0e8ff'adspx')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                alt="Profile Avatar"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Profile Quick Stats */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-foreground">{fullName || "AdsPx Publisher"}</h2>
              {isPremium ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black shadow-md">
                  <Crown className="h-3.5 w-3.5" /> VIP PREMIUM
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold border border-border">
                  Free Member
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5 font-mono text-foreground">
                <Mail className="h-3.5 w-3.5 text-primary" /> {email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Member since {q.data?.created_at ? new Date(q.data.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recently"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <section className="rounded-3xl bg-card border border-border/80 p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border/60">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Personal Details</h3>
              <p className="text-xs text-muted-foreground">Update your public publisher profile</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold text-muted-foreground">Registered Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={email}
                  readOnly
                  disabled
                  className="bg-muted/40 font-mono text-xs text-muted-foreground pl-9 rounded-xl"
                />
                <CheckCircle2 className="absolute left-3 top-3 h-3.5 w-3.5 text-emerald-500" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs font-bold text-foreground">Full Display Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="rounded-xl font-medium text-sm"
              />
            </div>

            <Button
              onClick={() => profileMut.mutate()}
              disabled={profileMut.isPending || q.isLoading}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {profileMut.isPending ? "Saving changes..." : "Save Profile Details"}
            </Button>
          </div>
        </section>

        {/* Security & Password */}
        <section className="rounded-3xl bg-card border border-border/80 p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border/60">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Security & Password</h3>
              <p className="text-xs text-muted-foreground">Keep your account safe with a strong password</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw1" className="text-xs font-bold text-foreground">New Password</Label>
              <div className="relative">
                <Input
                  id="pw1"
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="Min 8 characters"
                  className="rounded-xl pl-9 text-sm font-mono"
                />
                <Lock className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pw2" className="text-xs font-bold text-foreground">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="pw2"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Re-enter new password"
                  className="rounded-xl pl-9 text-sm font-mono"
                />
                <Lock className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            <Button
              onClick={() => {
                if (pw1.length < 8) return toast.error("Password must be at least 8 characters");
                if (pw1 !== pw2) return toast.error("Passwords do not match");
                passwordMut.mutate();
              }}
              disabled={passwordMut.isPending || !pw1}
              variant="outline"
              className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 border-indigo-500/30 hover:bg-indigo-500/10"
            >
              <KeyRound className="h-4 w-4" />
              {passwordMut.isPending ? "Updating password..." : "Update Password"}
            </Button>
          </div>
        </section>
      </div>

      {/* Subscription & Plan Status Card */}
      <section className="rounded-3xl bg-card border border-border/80 p-6 sm:p-7 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Current Plan & Subscription Details</h3>
              <p className="text-xs text-muted-foreground">Active entitlements, validity period, and live limits</p>
            </div>
          </div>

          <Link
            to="/upgrade"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 text-white font-black text-xs shadow-lg shadow-indigo-500/20 hover:opacity-95 transition-opacity self-start sm:self-auto"
          >
            <Zap className="h-4 w-4" /> {isPremium ? "Extend / Renew Plan" : "Upgrade to Premium"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 4 Entitlement Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Active Membership</span>
            <div className="text-sm font-black text-foreground">
              {isPremium ? (
                <span className="text-indigo-400 font-extrabold">
                  {planQ.data?.planSlug === "premium_12m" ? "Premium (12 Months)" : "Premium (6 Months)"}
                </span>
              ) : (
                "Free Plan"
              )}
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Started: {planQ.data?.formattedStartDate || "Active"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Plan Validity / Expiry</span>
            <div className="text-sm font-black text-foreground">
              {isPremium ? (
                <span className="text-emerald-400 font-mono font-bold">
                  {planQ.data?.daysRemaining} days left
                </span>
              ) : (
                <span className="text-muted-foreground">Standard Account</span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Expires: {isPremium ? planQ.data?.formattedExpiry : "No expiration"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Link Creation Limit</span>
            <div className="text-sm font-black text-foreground">
              {isPremium ? (
                <span className="text-emerald-400 font-bold">Unlimited (1,000,000)</span>
              ) : (
                <span className="text-muted-foreground">50 Links</span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Traffic: Unlimited Clicks
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Withdrawal Privileges</span>
            <div className="text-sm font-black text-foreground">
              {planQ.data?.canWithdraw ? (
                <span className="text-emerald-400 inline-flex items-center gap-1 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Enabled (LTC)
                </span>
              ) : (
                <span className="text-rose-400 font-bold">Requires Premium</span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Min payout: $5.00
            </span>
          </div>
        </div>

        {/* Payment / Upgrade Invoice History */}
        <div className="pt-4 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" /> Payment & Subscription History
            </h4>
            <span className="text-xs text-muted-foreground font-semibold">
              {(planQ.data?.recentUpgrades ?? []).length} invoices
            </span>
          </div>

          {(planQ.data?.recentUpgrades ?? []).length === 0 ? (
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 text-center text-xs text-muted-foreground">
              No previous payment invoices found.
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-muted/20 overflow-hidden">
              {(planQ.data?.recentUpgrades ?? []).map((upg: any) => (
                <div key={upg.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block text-sm">
                      {upg.packageName || upg.package_slug}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Invoice Date: {upg.formattedDate || "Recent"} · Method: Litecoin (LTC)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-foreground text-sm">
                      ${upg.amount_usd.toFixed(2)} USD
                    </span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      upg.status === 'paid' || upg.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : upg.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {upg.status === 'paid' || upg.status === 'completed' ? 'PAID / ACTIVE' : upg.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
