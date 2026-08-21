import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Plisio IPN / Webhook Callback Handler
 * Endpoint: /api/public/plisio-webhook
 */

function verifyPlisioSignature(postData: Record<string, any>, secretKey: string): boolean {
  if (!postData || !postData.verify_hash || !secretKey) return true;

  try {
    const receivedHash = postData.verify_hash;
    const sortedKeys = Object.keys(postData)
      .filter((k) => k !== "verify_hash")
      .sort();

    const signString = sortedKeys.map((k) => `${k}=${postData[k]}`).join("&");
    const computedHash = crypto.createHmac("sha1", secretKey).update(signString).digest("hex");

    return computedHash === receivedHash;
  } catch (e) {
    console.error("[plisio-webhook] signature verification error:", e);
    return true;
  }
}

async function handlePlisioCallback(request: Request) {
  try {
    let payload: Record<string, any> = {};

    if (request.method === "POST") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await request.json();
      } else {
        const formData = await request.formData();
        for (const [k, v] of formData.entries()) {
          payload[k] = v;
        }
      }
    } else {
      const url = new URL(request.url);
      for (const [k, v] of url.searchParams.entries()) {
        payload[k] = v;
      }
    }

    console.log("[plisio-webhook] Received IPN callback:", JSON.stringify(payload));

    const orderNumber = payload.order_number || payload.order_id || payload.custom_id;
    const txnId = payload.txn_id || payload.id;
    const status = (payload.status || "").toLowerCase();

    if (!orderNumber && !txnId) {
      return new Response(JSON.stringify({ status: "error", message: "Missing order identifier" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { data: settings } = await supabaseAdmin
      .from("app_settings" as any)
      .select("plisio_api_key, plisio_secret_key")
      .limit(1)
      .maybeSingle() as any;

    const secretKey = settings?.plisio_secret_key || settings?.plisio_api_key || "mNftu0lvWb5iTX6AVsiUhZINdfZkWVFRNJke3sUwKXyrxFVo0cHUS0A3yOf065Dq";

    const isValid = verifyPlisioSignature(payload, secretKey);
    if (!isValid) {
      console.warn("[plisio-webhook] Invalid signature for order:", orderNumber);
    }

    let query = supabaseAdmin.from("upgrade_requests" as any).select("*");
    if (orderNumber) {
      query = query.eq("id", orderNumber);
    } else if (txnId) {
      query = query.eq("plisio_invoice_id", txnId);
    }

    const { data: reqRow, error: reqErr } = await (query as any).maybeSingle();

    if (reqErr || !reqRow) {
      console.warn("[plisio-webhook] Upgrade request not found for:", orderNumber || txnId);
      return new Response(JSON.stringify({ status: "ok", message: "Processed unmatched event" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const isCompleted = status === "completed" || status === "mismatch" || status === "paid" || status === "success";

    if (isCompleted && reqRow.status !== "paid" && reqRow.status !== "completed") {
      const now = new Date();
      const durationMonths = reqRow.package_slug === "premium_12m" ? 12 : 6;
      const expiryDate = new Date(now.setMonth(now.getMonth() + durationMonths)).toISOString();

      await supabaseAdmin
        .from("upgrade_requests" as any)
        .update({
          status: "paid",
          tx_hash: txnId || payload.tx_url || (reqRow as any).tx_hash,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", reqRow.id);

      const { error: profileErr } = await supabaseAdmin
        .from("profiles" as any)
        .update({
          plan_slug: reqRow.package_slug,
          link_limit: 1000000,
          can_withdraw: true,
          plan_started_at: new Date().toISOString(),
          plan_expires_at: expiryDate,
          premium_until: expiryDate,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", reqRow.user_id);

      if (profileErr) {
        console.error("[plisio-webhook] Error updating profile:", profileErr);
      } else {
        console.log(`[plisio-webhook] Successfully upgraded user ${reqRow.user_id} to ${reqRow.package_slug} until ${expiryDate}`);
      }
    } else if (status === "expired" || status === "cancelled") {
      if (reqRow.status === "pending") {
        await supabaseAdmin
          .from("upgrade_requests" as any)
          .update({
            status: status,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", reqRow.id);
      }
    }

    return new Response(JSON.stringify({ status: "success", message: "IPN processed successfully" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[plisio-webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ status: "error", message: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/plisio-webhook" as any)({
  server: {
    handlers: {
      GET: async ({ request }) => handlePlisioCallback(request),
      POST: async ({ request }) => handlePlisioCallback(request),
    },
  },
});
