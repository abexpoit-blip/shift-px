// Host-aware robots.txt.
//
// Each domain advertises ONLY its own host sitemap (never cross-referencing
// adspx.com on shortener domains) and explicitly allows all Meta/Facebook and
// Google ad-quality / link-preview crawlers to read OpenGraph metadata cleanly.
import { createFileRoute } from "@tanstack/react-router";
import { isAdspxSaasHost } from "@/lib/site-hosts";

const SOCIAL_ALLOW_SHORTENER = `# --- Search & social link-preview crawlers: ALLOW ---
User-agent: Googlebot
Allow: /

User-agent: AdsBot-Google
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Applebot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: Facebot
Allow: /

User-agent: facebookcatalog
Allow: /

User-agent: meta-externalagent
Allow: /

User-agent: meta-externalfetcher
Allow: /

User-agent: meta-externalads
Allow: /

User-agent: meta-webindexer
Allow: /

User-agent: WhatsApp
Allow: /

# --- AI training scrapers: DISALLOW ---
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Amazonbot
Disallow: /`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
          .split(",")[0]
          .trim()
          .toLowerCase();
        const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
        const origin = `${proto}://${host || "dovtv.com"}`;

        const saas = isAdspxSaasHost(host);

        const body = saas
          ? `User-agent: *
Allow: /
Disallow: /r/
Disallow: /admin/
Disallow: /dashboard
Disallow: /control-panel

${SOCIAL_ALLOW_SHORTENER}

Sitemap: ${origin}/sitemap.xml
`
          : `${SOCIAL_ALLOW_SHORTENER}

User-agent: *
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /order-confirmed

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
