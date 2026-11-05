import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function getClientIp(): string | null {
  try {
    const req = getRequest();
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const xrip = req.headers.get("x-real-ip");
    if (xrip) return xrip.trim();
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * Called by the signup page BEFORE supabase.auth.signUp.
 * Enforces mandatory security gates:
 * 1. Strict Gmail-only rule (@gmail.com / @googlemail.com).
 * 2. Disposable / temporary email blocklist.
 * 3. Strict 1 Account Per IP rule (Blocks double/bulk account creation from the same IP).
 * 
 * Note: Login for existing users is never affected by this check.
 */
export const preSignupCheck = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const domain = email.split("@")[1] ?? "";
    const ip = getClientIp();

    const log = async (success: boolean, reason: string | null) => {
      try {
        await supabaseAdmin.from("signup_attempts").insert({ ip, email, success, reason } as any);
      } catch (e) {
        console.error("[preSignupCheck] log failed", e);
      }
    };

    // 1. Mandatory Gmail-only rule (All other email providers rejected)
    if (!GMAIL_DOMAINS.has(domain)) {
      await log(false, "not_gmail");
      return {
        ok: false as const,
        error: "Only official Google (@gmail.com) email addresses are permitted to create an account.",
      };
    }

    // 2. Disposable domain blocklist check
    const { data: blocked } = await supabaseAdmin
      .from("blocked_email_domains")
      .select("domain")
      .eq("domain", domain)
      .maybeSingle();

    if (blocked) {
      await log(false, "disposable_domain");
      return {
        ok: false as const,
        error: "Disposable and temporary email addresses are strictly prohibited.",
      };
    }

    // 3. Strict 1 Account Per IP Rule (Double Account Prevention on Signup)
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      // A. Check if an account already exists in profiles with this signup IP
      const { data: existingProfile } = (await supabaseAdmin
        .from("profiles" as any)
        .select("id, email")
        .eq("signup_ip", ip)
        .limit(1)
        .maybeSingle()) as any;

      if (existingProfile && existingProfile.email?.toLowerCase() !== email) {
        await log(false, "duplicate_ip_profile");
        return {
          ok: false as const,
          error: "An account has already been registered from this IP address. Only one account per IP address is permitted.",
        };
      }

      // B. Check prior successful signup attempts from this IP with a different email
      const { data: priorAttempts } = await supabaseAdmin
        .from("signup_attempts")
        .select("email")
        .eq("ip", ip)
        .eq("success", true)
        .limit(5);

      if (priorAttempts && priorAttempts.length > 0) {
        for (const att of priorAttempts) {
          if (att.email && att.email.toLowerCase() !== email) {
            const { data: userProfile } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("email", att.email.toLowerCase().trim())
              .maybeSingle();

            if (userProfile) {
              await log(false, "duplicate_ip_attempt");
              return {
                ok: false as const,
                error: "An account has already been registered from this IP address. Only one account per IP address is permitted.",
              };
            }
          }
        }
      }
    }

    await log(true, null);
    return { ok: true as const, clientIp: ip };
  });

/**
 * Server function to persist the signup IP onto the newly created profile.
 */
export const recordSignupIpFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email(), ip: z.string().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = data.ip || getClientIp();
    if (!ip) return { ok: true };
    await supabaseAdmin
      .from("profiles")
      .update({ signup_ip: ip } as any)
      .eq("email", data.email.trim().toLowerCase());
    return { ok: true };
  });
