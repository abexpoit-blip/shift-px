import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { User, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getMySettings,
  updateMyProfile,
  changeMyPassword,
} from "@/lib/user-settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — Adspx" },
      { name: "description", content: "Manage your Adspx account name, password and plan details." },
      { property: "og:title", content: "Account Settings — Adspx" },
      { property: "og:description", content: "Manage your Adspx account name, password and plan details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Card({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl glass-card p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function SettingsPage() {
  const load = useServerFn(getMySettings);
  const saveProfile = useServerFn(updateMyProfile);
  const savePassword = useServerFn(changeMyPassword);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["my-settings"], queryFn: () => load() });

  const [fullName, setFullName] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    if (q.data) setFullName(q.data.full_name ?? "");
  }, [q.data]);

  const profileMut = useMutation({
    mutationFn: () => saveProfile({ data: { full_name: fullName } }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMut = useMutation({
    mutationFn: () => savePassword({ data: { new_password: pw1 } }),
    onSuccess: () => {
      toast.success("Password changed");
      setPw1("");
      setPw2("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account details.</p>
      </header>

      <Card title="Profile" icon={User}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={q.data?.email ?? ""} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Display name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <Button
          onClick={() => profileMut.mutate()}
          disabled={profileMut.isPending || q.isLoading}
        >
          {profileMut.isPending ? "Saving…" : "Save profile"}
        </Button>
      </Card>

      <Card title="Password" icon={KeyRound}>
        <div className="space-y-2">
          <Label htmlFor="pw1">New password</Label>
          <Input id="pw1" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw2">Confirm password</Label>
          <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            if (pw1.length < 8) return toast.error("Password must be at least 8 characters");
            if (pw1 !== pw2) return toast.error("Passwords do not match");
            passwordMut.mutate();
          }}
          disabled={passwordMut.isPending}
        >
          {passwordMut.isPending ? "Updating…" : "Change password"}
        </Button>
      </Card>

      <Card title="Plan" icon={ShieldCheck}>
        <p className="text-sm text-muted-foreground">
          Current plan: <span className="font-medium text-foreground">{q.data?.plan_slug ?? "free"}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Member since{" "}
          {q.data?.created_at ? new Date(q.data.created_at).toLocaleDateString() : "—"}
        </p>
      </Card>
    </div>
  );
}
