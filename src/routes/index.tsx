import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getHost, variantFromHost } from "@/lib/host";
import { BreezyHome } from "@/components/breezy/BreezyHome";
import { buildOg } from "@/lib/og-meta";
import { brandForOrigin } from "@/lib/brand-registry";

// Lazy-load AdspxHome so shortener domains (dovtv.com, blentrovus.com, custom domains)
// never emit <link rel="modulepreload" href="/assets/AdspxLogo-*.js"> in their SSR <head>.
const AdspxHome = lazy(() =>
  import("@/components/adspx-home").then((m) => ({ default: m.AdspxHome })),
);

/**
 * Host-aware homepage:
 *   adspx.com                        → Adspx SaaS landing
 *   dovtv.com / blentrovus.com / ... → Independent branded storefront
 *
 * Host is detected SSR-side (request headers) so Facebook/Twitter/Google
 * crawlers — which don't execute JS — receive the exact host-matched HTML
 * and brand identity on first fetch.
 */
export const Route = createFileRoute("/")({
  loader: () => {
    const host = getHost();
    const cleanHost = (host || "dovtv.com").replace(/^www\./, "");
    const origin = `https://${cleanHost}`;
    return { host, origin, variant: variantFromHost(host) };
  },
  head: ({ loaderData }) => {
    if (loaderData?.variant === "breezysocial") {
      const host = (loaderData?.host || "dovtv.com").replace(/^www\./, "");
      const origin = loaderData?.origin || `https://${host}`;
      const brand = brandForOrigin(origin);
      const { meta, links } = buildOg({
        origin,
        path: "/",
        title: `${brand.name} — ${brand.tagline}`,
        description:
          "Thoughtfully designed tools for better sleep, sharper focus, and easier travel. Free shipping over $50. 30-day returns.",
        imageAlt: `${brand.name} — ${brand.tagline}`,
        type: "website",
      });
      return {
        meta,
        links: [
          ...links,
          { rel: "preconnect", href: "https://fonts.googleapis.com" },
          { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
          {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap",
          },
        ],
        scripts: [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: brand.name,
              url: origin,
              logo: `${origin}/favicon.svg`,
              email: brand.email,
              address: {
                "@type": "PostalAddress",
                addressLocality: brand.city.split(",")[0]?.trim(),
                addressRegion: brand.city.split(",")[1]?.trim(),
                addressCountry: "US",
              },
              foundingDate: "2019",
              sameAs: [],
            }),
          },
        ],
      };
    }

    return {
      meta: [
        { title: "Adspx — Smart Link Manager & Real-Time Analytics" },
        {
          name: "description",
          content:
            "Branded short links, edge-fast redirects, geo & device routing, real-time analytics. Free forever plan. $50 lifetime unlimited.",
        },
        { property: "og:title", content: "Adspx — Smart Link Manager" },
        {
          property: "og:description",
          content:
            "Shorten, route, and measure every link with sub-30ms edge redirects and live analytics.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://adspx.com/" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "twitter:title", content: "Adspx — Smart Link Manager" },
        {
          name: "twitter:description",
          content:
            "Shorten, route, and measure every link with sub-30ms edge redirects and live analytics.",
        },
      ],
      links: [
        { rel: "canonical", href: "https://adspx.com/" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap",
        },
      ],
    };
  },

  component: HomeRouter,
});

function HomeRouter() {
  const { variant } = Route.useLoaderData();
  if (variant === "breezysocial") return <BreezyHome />;
  return (
    <Suspense fallback={null}>
      <AdspxHome />
    </Suspense>
  );
}
