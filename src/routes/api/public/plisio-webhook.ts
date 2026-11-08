import { createFileRoute } from "@tanstack/react-router";

/**
 * Plisio Payment Gateway - Decommissioned
 * Shift-px now operates 100% on a secure Manual Payment Approval System.
 */
export const Route = createFileRoute("/api/public/plisio-webhook")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "decommissioned",
            message: "Plisio payment gateway has been decommissioned. Please use the manual payment approval system.",
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
            message: "Plisio payment gateway has been decommissioned. Please use the manual payment approval system.",
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
