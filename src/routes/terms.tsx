import { createFileRoute } from "@tanstack/react-router";
import { useBrand } from "@/lib/brand-live";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { SITE } from "@/lib/breezy-data";
import { buildOg } from "@/lib/og-meta";
import { brandForOrigin } from "@/lib/brand-registry";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/terms")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "https://adswapx.com";
    const brand = brandForOrigin(origin);
    const { meta, links } = buildOg({
      origin,
      path: "/terms",
      title: `Terms of Service — ${brand.name}`,
      description: `The terms and conditions for using ${brand.name} and purchasing our products.`,
      type: "website",
    });
    return { meta, links };
  },
  component: TermsPage,
});

function TermsPage() {
  const brand = useBrand();
  return (
    <BreezyLayout>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-lg text-[#3A3A38]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3 not-prose">
          Legal · Last updated June 2026
        </div>
        <h1
          className="text-5xl text-[#2A2A28] mb-8 not-prose"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
        >
          Terms of Service
        </h1>

        <p>
          Welcome to {brand.name}. By accessing or using {brand.host}, you agree to be bound by
          these Terms of Service. If you do not agree, please do not use our site.
        </p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">1. Use of the site</h2>
        <p>
          You agree to use the site only for lawful purposes and in a way that does not infringe the
          rights of others or restrict their use. You may not attempt to gain unauthorized access to
          any part of the site or related systems.
        </p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">2. Products & orders</h2>
        <p>
          All product descriptions, images, and prices are subject to change without notice. We
          reserve the right to limit quantities, refuse orders, or correct pricing errors. Orders
          are not confirmed until you receive an email confirmation from us.
        </p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">3. Payment</h2>
        <p>
          Payment is due at the time of order. We accept major credit cards and other payment
          methods listed at checkout. All prices are in US dollars unless stated otherwise.
        </p>

        
        <h2 className="text-2xl mt-10 text-[#2A2A28]">4. Sponsor Revenue Sharing & Community Reward Policy</h2>
        <p>
          AdsPx operates in strategic partnership with global advertising networks, programmatic demand-side platforms (DSPs), and digital media sponsors. We provide link creators and campaign managers with free enterprise routing infrastructure, advanced cloaking technology, and revenue-sharing incentives under the following principles:
        </p>
        <ul className="list-disc pl-6 space-y-2 mt-3 text-[#3A3A38]">
          <li>
            <strong>Sponsor-Funded Reward Pool:</strong> Promotional revenue and free server infrastructure are funded directly through our global digital advertising sponsors and enterprise media partnerships based on genuine traffic volume.
          </li>
          <li>
            <strong>Verified Human Engagement:</strong> Community rewards and traffic counters are strictly calculated based on genuine, non-bot human visits. Automated scripts, scrapers, and malicious bot traffic are actively filtered and deemed non-monetizable.
          </li>
          <li>
            <strong>Fair Creator Compensation:</strong> Active creators and media buyers earn transparent reward rates per verified human visit, redeemable in USD once standard account thresholds and security verifications are fulfilled.
          </li>
          <li>
            <strong>Infrastructure Quality:</strong> Sponsor partnerships ensure that all creators enjoy zero platform hosting fees, high-speed CDN routing, and military-grade cloaking shield defense at no cost.
          </li>
        </ul>


        <h2 className="text-2xl mt-10 text-[#2A2A28]">5. Intellectual property</h2>
        <p>
          All content on this site — text, images, logos, product designs — is owned by {brand.name}{" "}
          or its licensors and protected by copyright and trademark laws. You may not reproduce,
          distribute, or use it without our written permission.
        </p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">6. Disclaimer & limitation of liability</h2>
        <p>
          Our products are provided "as is." To the maximum extent permitted by law, {brand.name}{" "}
          disclaims all warranties, express or implied, including merchantability and fitness for a
          particular purpose. We are not liable for any indirect, incidental, or consequential
          damages arising from your use of our products or this site.
        </p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">7. Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of California, USA. Any disputes will be
          resolved exclusively in the state or federal courts located in San Francisco County,
          California.
        </p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">8. Contact</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${brand.email}`} className="text-[#5A7A55]">
            {brand.email}
          </a>
          .
        </p>
      </article>
    </BreezyLayout>
  );
}
