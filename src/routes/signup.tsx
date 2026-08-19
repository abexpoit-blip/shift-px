import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { preSignupCheck } from "@/lib/signup-protection.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdspxMark } from "@/components/AdspxLogo";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Adspx" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const preCheck = useServerFn(preSignupCheck);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const tg = telegram.trim().replace(/^@/, "");

    // Signup protection gate (Gmail-only / disposable blocklist) — fail-open
    try {
      const check = await preCheck({ data: { email: normalizedEmail } });
      if (check && !check.ok) {
        setLoading(false);
        toast.error(check.error);
        return;
      }
    } catch {
      // If protection check has an issue, fail-open to allow user registration
    }

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName.trim(), telegram: tg },
        },
      });

      if (error) {
        setLoading(false);
        toast.error(error.message);
        return;
      }

      // If user has a session, navigate to dashboard immediately
      if (signUpData?.session) {
        await router.invalidate();
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      // Try logging in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      setLoading(false);
      if (signInErr) {
        toast.success("Account created successfully! Please sign in.");
        navigate({ to: "/login" });
        return;
      }

      await router.invalidate();
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-8 group">
          <AdspxMark className="h-12 w-12 transition-transform duration-300 group-hover:scale-105" glow />
          <span className="font-display font-black text-2xl tracking-tight">
            Ads<span className="text-gradient">Px</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <h1 className="font-display text-2xl font-semibold mb-1">Create account</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Start free in 60 seconds. No credit card required.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={80}
                className="mt-1.5"
              />
            </div>
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
              <Label htmlFor="telegram">Telegram (optional)</Label>
              <Input
                id="telegram"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                maxLength={64}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                At least 6 characters. Avoid common passwords.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full bg-primary-gradient shadow-glow"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
