import { createFileRoute } from "@tanstack/react-router";

/**
 * Plisio Payment Gateway - Decommissioned
 * Shift-px operates 100% on automated NOWPayments cryptocurrency gateway.
 */
export const Route = createFileRoute("/api/public/plisio-webhook")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "decommissioned",
            gateway: "NOWPayments",
            message: "Plisio payment gateway has been decommissioned. Shift-px operates 100% on NOWPayments.",
          }),
          {
            status: 410,
            headers: { "content-type": "application/json" },
          },
        );
      },
      POST: async () => {
        return new Response(
          JSON.stringify({
            status: "decommissioned",
            gateway: "NOWPayments",
            message: "Plisio payment gateway has been decommissioned. Shift-px operates 100% on NOWPayments.",
          }),
          {
            status: 410,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  },
});
