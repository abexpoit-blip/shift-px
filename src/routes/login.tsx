import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { toast } from "sonner";
import { Mail, Lock, ArrowRight, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Adspx" }] }),
  component: LoginPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("The login server took too long to respond. Please try again.")), 20_000);
        }),
      ]);
      if (result.error || !result.data.session) {
        toast.error(result.error?.message ?? "Login failed");
        return;
      }

      // Session is in localStorage. Try SPA nav; hard-redirect as a guaranteed fallback.
      const fallback = window.setTimeout(() => { window.location.replace("/dashboard"); }, 1200);
      try {
        await navigate({ to: "/dashboard", replace: true });
        window.clearTimeout(fallback);
      } catch {
        window.clearTimeout(fallback);
        window.location.replace("/dashboard");
      }
    } catch {
      toast.error("Could not reach the login server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <AdspxMark className="h-8 w-8" />
          <span className="font-display font-semibold text-lg tracking-tight">
            Ads<span className="text-gradient">Px</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <h1 className="font-display text-2xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in to your AdsPx account to keep earning.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={72}
                className="mt-1.5"
              />
            </div>
            <Button type="submit" className="w-full bg-primary-gradient shadow-glow" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            No account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
