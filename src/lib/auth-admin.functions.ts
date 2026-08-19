import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifyAdminSession = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        email: z.string().email(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const userId = data.userId;

    try {
      // If primary admin email, ensure admin role always exists in database
      if (email === "admin@adspx.com") {
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: userId, role: "admin" },
          { onConflict: "user_id,role" },
        );
        await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            email,
            plan_slug: "unlimited",
            is_banned: false,
          },
          { onConflict: "id" },
        );
        return { isAdmin: true };
      }

      // Check user_roles table
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (roleRow) {
        return { isAdmin: true };
      }

      // Fallback: check profile plan
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("plan_slug")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.plan_slug === "unlimited") {
        return { isAdmin: true };
      }

      return { isAdmin: false };
    } catch (err) {
      console.error("[verifyAdminSession] error:", err);
      // Fail-safe for primary admin
      if (email === "admin@adspx.com") {
        return { isAdmin: true };
      }
      return { isAdmin: false };
    }
  });
