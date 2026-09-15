import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface InactiveAccountCheckResult {
  isDeleted: boolean;
  message?: string;
  deletedAt?: string;
}

/**
 * Public check called by login page when authentication fails.
 * Checks if the account was automatically purged due to 14 days of inactivity.
 */
export const checkInactiveAccountStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().email().min(3).max(255) }).parse(d),
  )
  .handler(async ({ data }): Promise<InactiveAccountCheckResult> => {
    const normalizedEmail = data.email.trim().toLowerCase();
    try {
      const { data: record, error } = await (supabaseAdmin as any)
        .from("deleted_inactive_accounts")
        .select("message, deleted_at")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (error) {
        // If table doesn't exist yet or other query error, fail gracefully
        return { isDeleted: false };
      }

      if (record) {
        return {
          isDeleted: true,
          message:
            record.message ||
            "Your account has been deleted due to 14 days of inactivity (no login or traffic sent).",
          deletedAt: record.deleted_at,
        };
      }

      return { isDeleted: false };
    } catch {
      return { isDeleted: false };
    }
  });

/**
 * Clear inactive notice if the user registers a fresh account with the same email.
 */
export async function clearInactiveAccountNotice(email: string): Promise<void> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    await (supabaseAdmin as any)
      .from("deleted_inactive_accounts")
      .delete()
      .eq("email", normalizedEmail);
  } catch (err) {
    console.error("[clearInactiveAccountNotice] Error:", err);
  }
}

export const clearInactiveNoticeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().email().min(3).max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    await clearInactiveAccountNotice(data.email);
    return { ok: true };
  });

/**
 * Core engine to purge dormant users inactive for >= 14 days.
 * An account is eligible for purge IF:
 * 1. User is NOT an admin.
 * 2. User account was created >= 14 days ago (protects newly registered users).
 * 3. User has NOT signed in within the last 14 days (or never signed in).
 * 4. User has NOT sent or received active traffic (0 clicks or no link activity in last 14 days).
 */
export async function execute14DayInactivePurge(daysThreshold: number = 14): Promise<{
  purgedUsersCount: number;
  purgedLinksCount: number;
  purgedEmails: string[];
}> {
  const now = Date.now();
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(now - thresholdMs);

  // 1. Fetch all admin user IDs to permanently protect them
  const { data: adminRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminIds = new Set((adminRows ?? []).map((r: any) => r.user_id));

  // 2. Fetch all user links to calculate traffic/click history
  const { data: allLinks } = await supabaseAdmin
    .from("links")
    .select("id, user_id, clicks_count, created_at, updated_at");

  const userLinksMap = new Map<string, any[]>();
  for (const link of allLinks ?? []) {
    const list = userLinksMap.get(link.user_id) || [];
    list.push(link);
    userLinksMap.set(link.user_id, list);
  }

  // 3. Paginate through auth users
  let page = 1;
  const perPage = 500;
  const eligibleUsers: Array<{
    id: string;
    email: string;
    daysInactive: number;
    linkIds: string[];
  }> = [];

  while (true) {
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (userErr || !userResp?.users || userResp.users.length === 0) {
      break;
    }

    for (const u of userResp.users) {
      // Never purge admins
      if (adminIds.has(u.id)) continue;

      const createdAt = new Date(u.created_at).getTime();
      const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
      const userAge = now - createdAt;

      // Protect users created less than 14 days ago
      if (userAge < thresholdMs) continue;

      // Check if logged in within 14 days
      if (lastSignIn > 0 && (now - lastSignIn) < thresholdMs) continue;

      // Check user links and traffic
      const userLinks = userLinksMap.get(u.id) || [];
      const totalClicks = userLinks.reduce((sum, l) => sum + (l.clicks_count || 0), 0);

      // Check if any link was created or updated recently
      const hasRecentActivity = userLinks.some((l) => {
        const uAt = l.updated_at ? new Date(l.updated_at).getTime() : 0;
        return (now - uAt) < thresholdMs;
      });

      // If user had active traffic or recent link activity, protect them
      if (totalClicks > 0 && hasRecentActivity) continue;

      const daysInactive = Math.floor(
        (now - (lastSignIn || createdAt)) / (24 * 60 * 60 * 1000),
      );

      eligibleUsers.push({
        id: u.id,
        email: (u.email || "").toLowerCase().trim(),
        daysInactive,
        linkIds: userLinks.map((l) => l.id),
      });
    }

    if (userResp.users.length < perPage) break;
    page++;
  }

  let purgedCount = 0;
  let purgedLinksTotal = 0;
  const purgedEmails: string[] = [];

  for (const user of eligibleUsers) {
    try {
      // A. Record in deleted_inactive_accounts so login portal notifies the user in English
      if (user.email) {
        await (supabaseAdmin as any).from("deleted_inactive_accounts").upsert(
          {
            email: user.email,
            user_id: user.id,
            reason: "inactive_14_days",
            days_inactive: user.daysInactive,
            message:
              "Your account has been deleted due to 14 days of inactivity (no login or traffic sent).",
            deleted_at: new Date().toISOString(),
          },
          { onConflict: "email" },
        );
      }

      // B. Purge user links and clicks
      if (user.linkIds.length > 0) {
        await supabaseAdmin.from("clicks").delete().in("link_id", user.linkIds);
        await supabaseAdmin.from("links").delete().in("id", user.linkIds);
        purgedLinksTotal += user.linkIds.length;
      }

      // C. Purge user metadata tables
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id);
      await supabaseAdmin.from("upgrade_requests").delete().eq("user_id", user.id);
      await supabaseAdmin.from("custom_domains").delete().eq("user_id", user.id);
      await (supabaseAdmin as any).from("withdrawals").delete().eq("user_id", user.id);
      await supabaseAdmin.from("profiles").delete().eq("id", user.id);

      // D. Purge user from auth.users
      await supabaseAdmin.auth.admin.deleteUser(user.id);

      purgedCount++;
      if (user.email) purgedEmails.push(user.email);
    } catch (err) {
      console.error(`[execute14DayInactivePurge] Failed to purge user ${user.id}:`, err);
    }
  }

  return {
    purgedUsersCount: purgedCount,
    purgedLinksCount: purgedLinksTotal,
    purgedEmails,
  };
}

/**
 * Admin action to trigger 14-day inactive user purge manually from Control Panel
 */
export const runInactiveAccountsPurgeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } = {}) =>
    z.object({ days: z.number().min(1).max(365).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw new Error("Unauthorized: Admin only");

    const days = data?.days ?? 14;
    return await execute14DayInactivePurge(days);
  });

/**
 * Admin query to check count of dormant users
 */
export const getInactiveAccountsCountFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw new Error("Unauthorized: Admin only");

    const now = Date.now();
    const thresholdMs = 14 * 24 * 60 * 60 * 1000;

    const { data: adminRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRows ?? []).map((r: any) => r.user_id));

    const { data: allLinks } = await supabaseAdmin
      .from("links")
      .select("id, user_id, clicks_count, updated_at");
    const userLinksMap = new Map<string, any[]>();
    for (const link of allLinks ?? []) {
      const list = userLinksMap.get(link.user_id) || [];
      list.push(link);
      userLinksMap.set(link.user_id, list);
    }

    const { data: userResp } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    let count = 0;
    for (const u of userResp?.users ?? []) {
      if (adminIds.has(u.id)) continue;
      const createdAt = new Date(u.created_at).getTime();
      const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
      if (now - createdAt < thresholdMs) continue;
      if (lastSignIn > 0 && now - lastSignIn < thresholdMs) continue;

      const userLinks = userLinksMap.get(u.id) || [];
      const totalClicks = userLinks.reduce((sum, l) => sum + (l.clicks_count || 0), 0);
      const hasRecent = userLinks.some((l) => {
        const uAt = l.updated_at ? new Date(l.updated_at).getTime() : 0;
        return now - uAt < thresholdMs;
      });
      if (totalClicks > 0 && hasRecent) continue;

      count++;
    }

    return { inactive14DaysCount: count };
  });
