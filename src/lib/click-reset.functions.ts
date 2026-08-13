import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Returns { showPopup, resetAt } — true if a click reset happened since this
// user last acknowledged one.
export const getClickResetNotice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: settings }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("app_settings").select("last_click_reset_at").eq("id", true).maybeSingle(),
      supabaseAdmin.from("profiles").select("last_click_reset_seen_at").eq("id", context.userId).maybeSingle(),
    ]);
    const resetAt = (settings as any)?.last_click_reset_at as string | null;
    const seenAt = (profile as any)?.last_click_reset_seen_at as string | null;
    const showPopup = !!resetAt && (!seenAt || new Date(resetAt) > new Date(seenAt));
    return { showPopup, resetAt };
  });

export const dismissClickResetNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ last_click_reset_seen_at: new Date().toISOString() } as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
