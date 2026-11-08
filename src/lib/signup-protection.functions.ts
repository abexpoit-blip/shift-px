import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

async function getClientIp(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
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

export function detectFakeGibberishName(
  rawName: string | undefined | null,
  email?: string,
): { isFake: boolean; reason?: string } {
  if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
    return { isFake: true, reason: "Please enter your real full name." };
  }
  const name = rawName.trim();

  // Whitelist admin or internal accounts
  if (email === "admin@adspx.com" || email === "info.freelancerfahad@gmail.com" || email === "ntfacts0@gmail.com") {
    return { isFake: false };
  }

  // 1. Length check: Minimum 3 characters, max 70
  if (name.length < 3) {
    return { isFake: true, reason: "Name must be at least 3 characters long." };
  }
  if (name.length > 70) {
    return { isFake: true, reason: "Name cannot exceed 70 characters." };
  }

  // 2. Reject placeholder / test strings
  const lower = name.toLowerCase();
  const blockedKeywords = [
    "test", "testing", "asdf", "qwerty", "zxcv", "null", "undefined",
    "fake", "dummy", "anonymous", "unknown", "12345", "administrator"
  ];
  if (blockedKeywords.some((b) => lower === b || lower.startsWith(b + " ") || lower.endsWith(" " + b))) {
    return { isFake: true, reason: "Placeholder or test names are not permitted. Please use your real name." };
  }

  // 3. Reject random digits embedded inside words (e.g. 'iu9oj', 'fghjfguyh3')
  if (/[a-z]{2,}\d+/i.test(name) || /\d+[a-z]{2,}/i.test(name)) {
    return { isFake: true, reason: "Names cannot contain numbers or digits. Please use your real first and last name." };
  }

  // 4. Word-by-word checks
  const words = name.split(/\s+/).filter(Boolean);
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!cleanWord) continue;

    // A. Zero vowels check for words >= 4 letters (e.g. fghfdgbd, dfhgbrdt, hgjnfg, fdhgbd, fghnb, tghbf, ltgj)
    const vowels = cleanWord.match(/[aeiouy]/g);
    const vowelCount = vowels ? vowels.length : 0;
    if (cleanWord.length >= 4 && vowelCount === 0) {
      return { isFake: true, reason: "Random keyboard-mashed names are strictly prohibited. Please enter your real name." };
    }

    // B. Extreme low vowel ratio for words >= 6 letters (e.g. <=1 vowel in 6+ letters)
    if (cleanWord.length >= 6 && vowelCount / cleanWord.length < 0.18) {
      return { isFake: true, reason: "Invalid name format detected. Please enter your real name." };
    }

    // C. 5+ consecutive consonants in a row
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(cleanWord)) {
      return { isFake: true, reason: "Invalid name: unnatural consonant sequence detected." };
    }

    // D. Common QWERTY keyboard mash sequences
    let mashMatches = 0;
    for (const p of ["fgh", "dfg", "ghj", "rty", "hjn", "vhn", "bnm", "cvb", "zxc", "jkl", "tyh", "ret"]) {
      if (cleanWord.includes(p)) mashMatches++;
    }
    if (mashMatches >= 2 && cleanWord.length <= 12) {
      return { isFake: true, reason: "Keyboard mash pattern detected. Real names are required." };
    }

    // E. 3+ identical consecutive characters
    if (/(.)\1\1/.test(cleanWord)) {
      return { isFake: true, reason: "Invalid name: repetitive characters detected." };
    }
  }

  // Also check email prefix if email is also pure random keyboard mash (e.g. cvbgnfhgdf@gmail.com)
  if (email && email.includes("@")) {
    const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
    let prefixMashMatches = 0;
    for (const p of ["fgh", "dfg", "ghj", "rty", "hjn", "vhn", "bnm", "cvb", "zxc", "tyh"]) {
      if (emailPrefix.includes(p)) prefixMashMatches++;
    }
    if (prefixMashMatches >= 3 && emailPrefix.length <= 15) {
      return { isFake: true, reason: "Automated bot email and name detected. Registration blocked." };
    }
  }

  return { isFake: false };
}

/**
 * Called by the signup page BEFORE supabase.auth.signUp.
 * Enforces mandatory security gates:
 * 1. Strict Gmail-only rule (@gmail.com / @googlemail.com).
 * 2. Disposable / temporary email blocklist.
 * 3. Strict 1 Account Per IP rule (Blocks double/bulk account creation from the same IP).
 * 4. Anti-Bot Fake Name Verification (Blocks random keyboard mashing & bogus names).
 * 
 * Note: Login for existing users is never affected by this check.
 */
export const preSignupCheck = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().max(255),
        full_name: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const domain = email.split("@")[1] ?? "";
    const ip = await getClientIp();

    const log = async (success: boolean, reason: string | null) => {
      try {
        await supabaseAdmin.from("signup_attempts").insert({ ip, email, success, reason } as any);
      } catch (e) {
        console.error("[preSignupCheck] log failed", e);
      }
    };

    // 1. Mandatory Fake / Bogus Name Check
    if (data.full_name !== undefined) {
      const nameCheck = detectFakeGibberishName(data.full_name, email);
      if (nameCheck.isFake) {
        await log(false, "fake_name");
        return {
          ok: false as const,
          error:
            nameCheck.reason ||
            "Registration rejected: Invalid or fake name detected. Real first and last names are strictly required.",
        };
      }
    }

    // 2. Mandatory Gmail-only rule (All other email providers rejected)
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
    const ip = data.ip || (await getClientIp());
    if (!ip) return { ok: true };
    await supabaseAdmin
      .from("profiles")
      .update({ signup_ip: ip } as any)
      .eq("email", data.email.trim().toLowerCase());
    return { ok: true };
  });
