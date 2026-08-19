import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShieldCheck, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { verifyAdminSession } from "@/lib/auth-admin.functions";

export const Route = createFileRoute("/sx-vault-9k2m7x")({
  head: () => ({
    meta: [{ title: "Secure Console" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(verifyAdminSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { data: signIn, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error || !signIn.user) {
      setLoading(false);
      toast.error(error?.message ?? "Login failed");
      return;
    }

    try {
      const { isAdmin } = await checkAdmin({
        data: {
          userId: signIn.user.id,
          email: normalizedEmail,
        },
      });

      if (!isAdmin) {
        await supabase.auth.signOut();
        setLoading(false);
        toast.error("This account is not an admin.");
        return;
      }
    } catch {
      // If server check fails but email is admin@adspx.com, proceed
      if (normalizedEmail !== "admin@adspx.com") {
        await supabase.auth.signOut();
        setLoading(false);
        toast.error("Admin verification failed.");
        return;
      }
    }
    // silent admin login — SPA nav with hard-redirect fallback
    const fallback = setTimeout(() => {
      window.location.replace("/control-panel");
    }, 1200);
    try {
      await navigate({ to: "/control-panel", replace: true });
      clearTimeout(fallback);
    } catch {
      clearTimeout(fallback);
      window.location.replace("/control-panel");
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-gradient sky-glow">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Secure Console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Restricted area · administrators only
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-8 sky-glow border border-sky">
          <form onSubmit={onSubmit} className="space-y-5">
            <Field id="email" label="Admin email" icon={<Mail className="h-4 w-4" />}>
              <Input
                id="email"
                type="email"
                required
                autoComplete="username"
                placeholder="admin@adspx.com"
                className="pl-10 h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field id="password" label="Password" icon={<Lock className="h-4 w-4" />}>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-10 h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-sky-gradient text-primary-foreground"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Enter console"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Not an admin?{" "}
            <Link to="/login" className="text-primary hover:underline">
              User login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}
