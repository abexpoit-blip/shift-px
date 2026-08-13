import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadLinkDrilldown } from "@/lib/analytics.server";
import { checkPaidAccess } from "@/lib/plan-gate.server";

export const getLinkDrilldown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ linkId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const gate = await checkPaidAccess(context.supabase, context.userId);
    if (!gate.allowed) {
      throw new Error("Link drill-down is available on paid plans. Upgrade to unlock.");
    }
    return loadLinkDrilldown({ ...context, linkId: data.linkId });
  });
