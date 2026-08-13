// Plan-gating helpers for premium features.
// Server-only (relies on the request-scoped Supabase client).

export const PAID_PLAN_SLUGS = new Set([
  "monthly",
  "pro_monthly",
  "pro",
  "yearly",
  "lifetime",
  "unlimited",
  "premium",
  "starter",
  "business",
  "enterprise",
]);

export const LIFETIME_PLAN_SLUGS = new Set(["lifetime", "unlimited"]);

export async function getUserPlanSlug(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("plan_slug")
    .eq("id", userId)
    .maybeSingle();
  return ((data as { plan_slug?: string | null } | null)?.plan_slug ?? "free").toLowerCase();
}

export function isPaidPlan(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return PAID_PLAN_SLUGS.has(slug.toLowerCase());
}

export function isLifetimePlan(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return LIFETIME_PLAN_SLUGS.has(slug.toLowerCase());
}

export async function checkPaidAccess(supabase: any, userId: string) {
  const slug = await getUserPlanSlug(supabase, userId);
  return { plan: slug, allowed: isPaidPlan(slug) };
}

export async function checkLifetimeAccess(supabase: any, userId: string) {
  const slug = await getUserPlanSlug(supabase, userId);
  return { plan: slug, allowed: isLifetimePlan(slug) };
}
