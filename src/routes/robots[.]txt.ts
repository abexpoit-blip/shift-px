// Host-aware robots.txt.
//
// LEAK FIX: the old static public/robots.txt was served on EVERY host and
// contained `Disallow: /dashboard` + `/admin/`. On an ad domain that is a
// direct tell that a SaaS dashboard lives behind the storefront, which is
// exactly the footprint Meta/Google reviewers look for. Only the real SaaS
// host advertises those paths now; content domains get a plain storefront
// robots file.
//
// CRITICAL: /r/ (redirect path) is ALWAYS disallowed. We never want crawlers
// to index or follow redirect links — only humans clicking from ads should
// land on /r/. Disallowing it also prevents crawlers from following the link
// and accidentally landing on the offer URL.
import { createFileRoute } from "@tanstack/react-router";
import { isAdspxSaasHost } from "@/lib/site-hosts";

const SOCIAL_ALLOW = `
# Social / link preview crawlers must always be allowed to read OG tags
# from content pages. The redirect path /r/ is still off-limits even for them.
User-agent: facebookexternalhit
Allow: /blog/
Allow: /shop/
Allow: /about
Allow: /faq
Allow: /
Disallow: /r/

User-agent: facebookcatalog
Allow: /
Disallow: /r/

User-agent: meta-externalagent
Allow: /
Disallow: /r/

User-agent: meta-externalads
Allow: /
Disallow: /r/

User-agent: meta-webindexer
Allow: /
Disallow: /r/

User-agent: Twitterbot
Allow: /
Disallow: /r/
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
          .split(",")[0]
          .trim()
          .toLowerCase();
        const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
        const origin = `${proto}://${host || "adswapx.com"}`;

        const saas = isAdspxSaasHost(host);

        const body = saas
          ? `User-agent: *
Allow: /
Disallow: /r/
Disallow: /admin/
Disallow: /dashboard
Disallow: /control-panel
${SOCIAL_ALLOW}
Sitemap: ${origin}/sitemap.xml
`
          : `User-agent: *
Allow: /
Disallow: /r/
Disallow: /cart
Disallow: /checkout
Disallow: /order-confirmed
${SOCIAL_ALLOW}
Sitemap: ${origin}/sitemap.xml
`;

        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=900",
          },
        });
      },
    },
  },
});
