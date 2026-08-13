import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/blog")({
  // Layout-only: emit shared description/og:title but NOT canonical or og:url.
  // The leaf (/blog index or /blog/$slug) owns canonical + og:url so child
  // pages don't inherit a /blog canonical.
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => <Outlet />,
});
