import { createFileRoute } from "@tanstack/react-router";

/**
 * NOWPayments IPN (Instant Payment Notification) Webhook Endpoint.
 * Receives automated payment status updates from NOWPayments, verifies
 * HMAC-SHA512 signature, and settles the user package upgrade.
 */
export const Route = createFileRoute("/api/public/nowpayments-callback")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "active",
            gateway: "NOWPayments IPN",
            server_time: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        const ctype = request.headers.get("content-type") ?? "";
        const nowpaymentsSig = request.headers.get("x-nowpayments-sig");
        const fields: Record<string, any> = {};

        if (ctype.includes("application/json") || raw.trim().startsWith("{")) {
          try {
            const obj = JSON.parse(raw);
            for (const [k, v] of Object.entries(obj)) {
              fields[k] = v;
            }
          } catch {
            return new Response("Bad JSON payload", { status: 400 });
          }
        } else if (raw.trim()) {
          for (const [k, v] of new URLSearchParams(raw).entries()) {
            fields[k] = v;
          }
        }

        // Test or verification ping from NOWPayments dashboard
        if (fields.test || (!fields.payment_id && !fields.order_id)) {
          return new Response(JSON.stringify({ ok: true, message: "IPN verified" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        const paymentId = String(fields.payment_id || fields.id || "");
        const orderId = String(fields.order_id || "");

        console.log(`[NOWPayments IPN] Received notification: payment_id=${paymentId}, order_id=${orderId}, status=${fields.payment_status}`);

        const { verifyNowpaymentsIpn, mapNowPaymentStatus, getNowpaymentsIpnSecret } = await import(
          "@/lib/nowpayments.server"
        );

        // Verify signature if provided and secret configured
        const ipnSecret = getNowpaymentsIpnSecret();
        if (nowpaymentsSig && ipnSecret) {
          const sigOk = verifyNowpaymentsIpn(raw, nowpaymentsSig, ipnSecret);
          if (!sigOk) {
            console.warn(`[NOWPayments IPN] Signature mismatch for payment ${paymentId}: ${nowpaymentsSig}`);
            return new Response("Invalid signature", { status: 401 });
          }
        }

        const rawStatus = String(fields.payment_status || "").toLowerCase();
        const mappedStatus = mapNowPaymentStatus(rawStatus);

        const { fulfillUpgradeOrder } = await import("@/lib/packages.functions");
        const targetId = orderId || paymentId;

        const result = await fulfillUpgradeOrder(targetId, {
          txHash: fields.outcome_tx_hash || fields.payin_hash || null,
          actuallyPaid: Number(fields.actually_paid || fields.pay_amount || 0) || undefined,
          rawStatus,
          paymentId,
        });

        if (!result.ok) {
          console.warn(`[NOWPayments IPN] Order fulfillment warning for ${targetId}: ${result.message}`);
        } else {
          console.log(`[NOWPayments IPN] Order ${targetId} successfully processed: status=${mappedStatus}`);
        }

        return new Response(JSON.stringify({ ok: true, status: mappedStatus }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
