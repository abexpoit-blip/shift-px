import { createFileRoute } from "@tanstack/react-router";
import { safeHandle } from "./r.$code";

/**
 * Bare short-code route: https://adswapx.com/<code>
 *
 * The shortener domain serves links (and their safe pages) directly from the
 * root path — /r/<code> stays as the canonical/legacy form. Static routes in
 * src/routes (about, blog, login, …) always win over this dynamic segment, so
 * this only catches unmatched top-level paths.
 */
export const Route = createFileRoute("/$code")({
  server: {
    handlers: {
      HEAD: async ({ request, params }) => safeHandle(request, params.code, false),
      GET: async ({ request, params }) => safeHandle(request, params.code, true),
    },
  },
});
