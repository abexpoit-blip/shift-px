// Client-side impersonation helpers.
// Admin saves their current session, then verifies a magiclink token to
// sign in as the target user. Exit restores the saved admin session.

import { supabase } from "@/integrations/supabase/client";

const ADMIN_KEY = "__sleepox_admin_session__";
const FLAG_KEY = "__sleepox_impersonating__";

export type ImpersonationFlag = {
  admin_email: string | null;
  target_id: string;
  target_email: string;
  target_name: string | null;
  started_at: number;
};

export function getImpersonationFlag(): ImpersonationFlag | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationFlag) : null;
  } catch {
    return null;
  }
}

export async function startImpersonation(args: {
  hashed_token: string;
  target: { id: string; email: string; full_name: string | null };
}) {
  // 1. Save the current (admin) session so we can restore it later.
  const { data: sess } = await supabase.auth.getSession();
  const adminSession = sess.session;
  if (!adminSession?.access_token || !adminSession?.refresh_token) {
    throw new Error("No active admin session to preserve");
  }
  const adminEmail = adminSession.user?.email ?? null;
  localStorage.setItem(
    ADMIN_KEY,
    JSON.stringify({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
      email: adminEmail,
    }),
  );

  // 2. Verify the magiclink token to switch to the target user.
  const { error } = await supabase.auth.verifyOtp({
    token_hash: args.hashed_token,
    type: "magiclink",
  });
  if (error) {
    localStorage.removeItem(ADMIN_KEY);
    throw new Error(error.message);
  }

  // 3. Flag the impersonation so the UI shows the banner.
  const flag: ImpersonationFlag = {
    admin_email: adminEmail,
    target_id: args.target.id,
    target_email: args.target.email,
    target_name: args.target.full_name,
    started_at: Date.now(),
  };
  localStorage.setItem(FLAG_KEY, JSON.stringify(flag));
}

export async function exitImpersonation(): Promise<{ restored: boolean }> {
  const raw = typeof window !== "undefined" ? localStorage.getItem(ADMIN_KEY) : null;
  if (!raw) {
    localStorage.removeItem(FLAG_KEY);
    return { restored: false };
  }
  let parsed: { access_token: string; refresh_token: string };
  try {
    parsed = JSON.parse(raw) as { access_token: string; refresh_token: string };
  } catch {
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(FLAG_KEY);
    return { restored: false };
  }

  const { error } = await supabase.auth.setSession({
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
  });
  localStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(FLAG_KEY);
  if (error) throw new Error(error.message);
  return { restored: true };
}
