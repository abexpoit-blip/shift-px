import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { LogOut, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { consumeDailyRedirect } from "@/lib/app-settings.functions";
import { AppShell } from "@/components/AppShell";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { BroadcastLoginPopup } from "@/components/broadcast-login-popup";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" },
    ],
  }),
  // Auth check is client-only — SSR has no localStorage so getSession() would
  // always be null and bounce users to /login on every hard refresh.
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banChecked, setBanChecked] = useState(false);
  const authCheckedRef = useRef(false);
  const dailyFn = useServerFn(consumeDailyRedirect);

  // Client-only auth gate. Wait for session restore before deciding to redirect.
  useEffect(() => {
    let mounted = true;
    const finishInitialAuthCheck = (u: User | null) => {
      if (!mounted) return;
      setUser(u);
      authCheckedRef.current = true;
      setAuthChecked(true);
      if (!u) navigate({ to: "/login" });
    };

    // A transient network failure makes supabase-js emit SIGNED_OUT / null
    // session even though the refresh token in localStorage is still valid.
    // Re-verify once before kicking the user out, so users stop getting
    // randomly logged out mid-session.
    const bounceIfReallySignedOut = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        setUser(data.session.user);
        return;
      }
      navigate({ to: "/login" });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      const u = session?.user ?? null;
      if (u) setUser(u);
      if (event === "SIGNED_OUT") { void bounceIfReallySignedOut(); return; }
      if (authCheckedRef.current && !u && event !== "INITIAL_SESSION") void bounceIfReallySignedOut();
    });

    // Watchdog: a stalled token refresh can leave getSession() pending
    // forever, which used to freeze the app on "Loading…".
    const authWatchdog = setTimeout(() => {
      if (!authCheckedRef.current) finishInitialAuthCheck(null);
    }, 8000);

    supabase.auth.getSession().then(({ data }) => {
      finishInitialAuthCheck(data.session?.user ?? null);
    }).catch(() => {
      finishInitialAuthCheck(null);
    });
    return () => { mounted = false; clearTimeout(authWatchdog); subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const uid = user.id;

    // Fail-open: never let a slow/failing profile lookup trap the user on
    // "Loading…". Worst case we render the dashboard without the ban check.
    const watchdog = setTimeout(() => { if (!cancelled) setBanChecked(true); }, 5000);

    (async () => {
      try {
        const [roleRes, profRes] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
          supabase.from("profiles").select("is_banned").eq("id", uid).maybeSingle(),
        ]);
        if (cancelled) return;
        setIsAdmin(!!roleRes.data);
        setIsBanned(!!profRes.data?.is_banned);
      } catch {
        /* network hiccup — fail open */
      } finally {
        if (!cancelled) setBanChecked(true);
      }
      // Non-blocking: last-login tracking must never gate the UI.
      void supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", uid);
    })();

    return () => { cancelled = true; clearTimeout(watchdog); };
  }, [user]);


  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await dailyFn();
        if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
      } catch { /* silent */ }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // Don't render protected UI until we've confirmed an authenticated session
  // AND the ban check has completed. Otherwise banned users see a flash of
  // the dashboard before the suspension screen appears.
  if (!authChecked || !user || !banChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF9F5] text-[#7A5C45] text-sm">
        Loading…
      </div>
    );
  }

  // Banned user — block all dashboard access, show suspension notice.
  if (isBanned) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-6 bg-[#FFF9F5] text-[#4A3728] relative overflow-hidden"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
      >
        <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] bg-red-400/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-300/20 blur-[140px] rounded-full pointer-events-none" />
        <div className="relative max-w-md w-full bg-white/80 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Ban className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-[#2D1B0D] mb-3">Account Suspended</h1>
          <p className="text-sm text-[#7D6452] leading-relaxed mb-2">
            Your account has been <span className="font-semibold text-red-600">banned</span> by an administrator.
          </p>
          <p className="text-sm text-[#7D6452] leading-relaxed mb-6">
            You cannot access the dashboard, create, edit, or delete links. If you believe this is a mistake, please contact support.
          </p>
          <div className="bg-[#FFF4ED] border border-[#FFE4D2] rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs text-[#A38D7D] uppercase tracking-wider font-bold mb-1">Signed in as</p>
            <p className="text-sm font-semibold text-[#2D1B0D] truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-semibold rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <ImpersonationBanner />
      <Outlet />
      <BroadcastLoginPopup />
    </AppShell>
  );
}
