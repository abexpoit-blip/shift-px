import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/maintenance-cron")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

          // 1. Purge dead links (0 traffic and >= 14 days old)
          let deletedLinks = 0;
          try {
            const { data: rpcDeleted } = await supabaseAdmin.rpc("purge_dead_links" as never, { days_threshold: 14 } as never);
            deletedLinks = Number(rpcDeleted || 0);
          } catch {
            const { data: deadLinks } = await supabaseAdmin
              .from("links")
              .select("id")
              .eq("clicks_count", 0)
              .lt("created_at", fourteenDaysAgo)
              .limit(1000);

            const deadLinkIds = (deadLinks ?? []).map((l: any) => l.id);
            if (deadLinkIds.length > 0) {
              await supabaseAdmin.from("clicks").delete().in("link_id", deadLinkIds);
              await (supabaseAdmin as any).from("google_shorts").delete().in("link_id", deadLinkIds);
              await supabaseAdmin.from("links").delete().in("id", deadLinkIds);
              deletedLinks = deadLinkIds.length;
            }
          }

          // 2. Purge dormant users (14+ days inactive with no login and no traffic)
          const { execute14DayInactivePurge } = await import("@/lib/inactive-accounts.functions");
          const purgeResult = await execute14DayInactivePurge(14);

          // 3. Prune dedupe table (older than 2 hours) to keep DB compact
          try {
            await supabaseAdmin.rpc("prune_click_event_dedupe" as never);
          } catch {}

          // 4. Hybrid storage maintenance: archive lifetime stats, rollup dimensions to click_dim_daily, and batched prune old raw clicks (> 7 days)
          let hybridPurgeRun = false;
          try {
            await supabaseAdmin.rpc("maintenance_purge_old_clicks" as never);
            hybridPurgeRun = true;
          } catch (mErr) {
            console.warn("[maintenance-cron] maintenance_purge_old_clicks note:", mErr);
          }

          return new Response(
            JSON.stringify({
              status: "success",
              timestamp: new Date().toISOString(),
              purgedDeadLinks: deletedLinks,
              purgedInactiveUsers: purgeResult.purgedUsersCount,
              purgedUserLinks: purgeResult.purgedLinksCount,
              hybridPurgeRun,
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
