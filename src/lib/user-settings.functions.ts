import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MySettings = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan_slug: string;
  created_at: string;
};

export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySettings> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, plan_slug, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Profile not found");
    return data as MySettings;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ full_name: z.string().trim().max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name || null, updated_at: new Date().toISOString() } as never)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ new_password: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.auth.updateUser({
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
