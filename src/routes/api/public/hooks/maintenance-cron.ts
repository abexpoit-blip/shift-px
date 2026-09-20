import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/maintenance-cron")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

          // 1. Purge dead links (0 clicks and >= 15 days old)
          const { data: deadLinks } = await supabaseAdmin
            .from("links")
            .select("id")
            .eq("clicks_count", 0)
            .lt("created_at", fifteenDaysAgo)
            .limit(1000);

          const deadLinkIds = (deadLinks ?? []).map((l: any) => l.id);
          let deletedLinks = 0;
          if (deadLinkIds.length > 0) {
            await supabaseAdmin.from("clicks").delete().in("link_id", deadLinkIds);
            await supabaseAdmin.from("links").delete().in("id", deadLinkIds);
            deletedLinks = deadLinkIds.length;
          }

          // 2. Purge dormant users (14+ days inactive with no login and no traffic)
          const { execute14DayInactivePurge } = await import("@/lib/inactive-accounts.functions");
          const purgeResult = await execute14DayInactivePurge(14);

          // 3. Prune dedupe table (older than 2 hours) to keep DB compact
          try {
            await supabaseAdmin.rpc("prune_click_event_dedupe" as never);
          } catch {}

          return new Response(
            JSON.stringify({
              status: "success",
              timestamp: new Date().toISOString(),
              purgedDeadLinks: deletedLinks,
              purgedInactiveUsers: purgeResult.purgedUsersCount,
              purgedUserLinks: purgeResult.purgedLinksCount,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        } catch (err: any) {
          console.error("[maintenance-cron] Error:", err);
          return new Response(JSON.stringify({ status: "error", message: err.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "ready",
            description: "14-day dead links & inactive users auto-cleanup hook with deletion notices",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
    },
  },
});
