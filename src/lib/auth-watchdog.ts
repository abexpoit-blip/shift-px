/**
 * Auth Watchdog.
 *
 * A stored session can silently go stale (expired refresh token, clock skew,
 * a token written by an older deploy). The symptom users see is an app shell
 * that loads but every query 401s, or an endless "loading" dashboard.
 *
 * The watchdog periodically validates the session and, when the refresh fails,
 * clears the local auth state once and sends the user to /auth so they can log
 * in again instead of sitting on a dead screen.
 */

import { supabase } from "@/integrations/supabase/client";

const CHECK_INTERVAL_MS = 5 * 60_000;
const RECOVER_FLAG = "sx_auth_recover_at";
const RECOVER_COOLDOWN_MS = 60_000;

function recentlyRecovered(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RECOVER_FLAG) || 0);
    return Number.isFinite(last) && Date.now() - last < RECOVER_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markRecovered() {
  try {
    sessionStorage.setItem(RECOVER_FLAG, String(Date.now()));
  } catch {
    /* storage disabled */
  }
}

async function checkSession() {
  if (typeof window === "undefined") return;
  const publicPath = /^\/(auth|login|signup|$)/.test(window.location.pathname);
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (error || !session) return; // not logged in → nothing to recover

    const expiresAt = (session.expires_at ?? 0) * 1000;
    const nearExpiry = expiresAt > 0 && expiresAt - Date.now() < 10 * 60_000;
    if (!nearExpiry) return;

    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      if (publicPath || recentlyRecovered()) return;
      markRecovered();
      await supabase.auth.signOut().catch(() => undefined);
      window.location.replace("/auth?reason=session-expired");
    }
  } catch {
    /* offline / transient — try again on the next tick */
  }
}

export function installAuthWatchdog(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const timer = window.setInterval(checkSession, CHECK_INTERVAL_MS);
  const onFocus = () => void checkSession();
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);
  void checkSession();
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
  };
}
