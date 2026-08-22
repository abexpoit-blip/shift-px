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

          // 2. Purge dormant users (15+ days inactive)
          const { data: dormantUsers } = await supabaseAdmin.rpc(
            "admin_get_dormant_users" as never,
            { _days: 15 } as never,
          );

          const userIds = ((dormantUsers ?? []) as any[]).map((u) => u.id).slice(0, 100);
          let deletedUsers = 0;

          for (const uid of userIds) {
            const linkIds = ((await supabaseAdmin.from("links").select("id").eq("user_id", uid)).data ?? []).map((l: any) => l.id);
            if (linkIds.length) {
              await supabaseAdmin.from("clicks").delete().in("link_id", linkIds);
            }
            await supabaseAdmin.from("links").delete().eq("user_id", uid);
            await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
            await supabaseAdmin.from("upgrade_requests").delete().eq("user_id", uid);
            await supabaseAdmin.from("custom_domains").delete().eq("user_id", uid);
            await supabaseAdmin.from("profiles").delete().eq("id", uid);
            await supabaseAdmin.auth.admin.deleteUser(uid);
            deletedUsers++;
          }

          return new Response(
            JSON.stringify({
              status: "success",
              timestamp: new Date().toISOString(),
              purgedDeadLinks: deletedLinks,
              purgedInactiveUsers: deletedUsers,
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
            description: "15-day dead links & inactive users auto-cleanup hook",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
    },
  },
});
