import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadCohortRetention } from "@/lib/analytics.server";
import { checkPaidAccess } from "@/lib/plan-gate.server";

export const getCohortRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const gate = await checkPaidAccess(context.supabase, context.userId);
    if (!gate.allowed) {
      return { rows: [] as Array<{ day: string; size: number; d1: number; d7: number; d30: number }>, locked: true, plan: gate.plan };
    }
    const res = await loadCohortRetention(context);
    return { ...res, locked: false, plan: gate.plan };
  });
