import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/token-pool")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const domainParam = url.searchParams.get("domain")?.trim();

          let query = (supabaseAdmin as any)
            .from("google_token_pool")
            .select("id, domain", { count: "exact" })
            .eq("status", "available");

          if (domainParam) {
            query = query.eq("domain", domainParam);
          }

          const { data: availableRows, count, error } = await query;

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }

          // Count breakdown by domain
          const byDomain: Record<string, number> = {};
          for (const row of availableRows || []) {
            const d = row.domain || "dovtv.com";
            byDomain[d] = (byDomain[d] || 0) + 1;
          }

          return new Response(
            JSON.stringify({
              available: count ?? 0,
              byDomain,
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
                "cache-control": "no-store",
              },
            }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => null);
          if (!body || !body.token || !body.short_code) {
            return new Response(
              JSON.stringify({ error: "Missing required fields: token, short_code" }),
              { status: 400, headers: { "content-type": "application/json" } }
            );
          }

          const token = String(body.token).trim();
          const shortCode = String(body.short_code).trim().toLowerCase();
          const rawDomain = body.domain ? String(body.domain).trim() : "dovtv.com";
          const domain = rawDomain
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "")
            .toLowerCase();

          const googleUrl =
            body.google_url || `https://www.google.com/share.google?q=${encodeURIComponent(token)}`;
          const shareGoogleUrl =
            body.share_google_url || `https://share.google/${encodeURIComponent(token)}`;

          const { data, error } = await (supabaseAdmin as any)
            .from("google_token_pool")
            .upsert(
              {
                token,
                short_code: shortCode,
                domain: domain || "dovtv.com",
                google_url: googleUrl,
                share_google_url: shareGoogleUrl,
                status: "available",
                verified_at: new Date().toISOString(),
              },
              { onConflict: "token" }
            )
            .select()
            .single();

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }

          const { count } = await (supabaseAdmin as any)
            .from("google_token_pool")
            .select("*", { count: "exact", head: true })
            .eq("status", "available");

          const { count: domainCount } = await (supabaseAdmin as any)
            .from("google_token_pool")
            .select("*", { count: "exact", head: true })
            .eq("domain", domain)
            .eq("status", "available");

          return new Response(
            JSON.stringify({
              success: true,
              token: data.token,
              short_code: data.short_code,
              domain: data.domain,
              domain_available: domainCount ?? 1,
              total_available: count ?? 1,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
