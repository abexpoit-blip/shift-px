import { useRouterState } from "@tanstack/react-router";
import { brandForOrigin, rebrand, type Brand } from "@/lib/brand-registry";

/**
 * Render-time brand for the safe/article surface.
 *
 * Every safe page loader returns `{ origin }` (or `{ host }`).
 * We pull the deepest match that carries one so both SSR HTML and the
 * hydrated client render the SAME host-specific brand — a crawler must never
 * see one shared storefront name across all of our domains.
 */
export function useBrandOrigin(): string {
  return useRouterState({
    select: (s) => {
      for (let i = s.matches.length - 1; i >= 0; i--) {
        const ld = s.matches[i].loaderData as { origin?: string; host?: string } | undefined;
        if (ld?.origin) return ld.origin;
        if (ld?.host) return `https://${ld.host.replace(/^www\./, "")}`;
      }
      if (typeof window !== "undefined") return window.location.origin;
      return "";
    },
  });
}

export function useBrand(): Brand {
  return brandForOrigin(useBrandOrigin());
}

/** Returns a rewriter that swaps the internal storefront token for the host brand. */
export function useRebrand(): (text: string) => string {
  const origin = useBrandOrigin();
  return (text: string) => rebrand(text, origin);
}
