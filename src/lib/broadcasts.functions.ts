import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getSupabaseAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as any;
}

async function assertAdmin(userId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
  return supabaseAdmin;
}

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  icon: string;
  tone: "info" | "success" | "warning" | "premium";
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

// ----- User: list active broadcasts + read status -----
export const listActiveBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("broadcasts")
      .select("id,title,body,icon,tone,is_active,created_at,expires_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    const items = (rows ?? []).filter((b: any) => !b.expires_at || b.expires_at > now);
    const ids = (items ?? []).map((b: any) => b.id);
    let readSet = new Set<string>();
    if (ids.length) {
      const { data: reads } = await supabaseAdmin
        .from("broadcast_reads")
        .select("broadcast_id")
        .eq("user_id", context.userId)
        .in("broadcast_id", ids);
      readSet = new Set((reads ?? []).map((r: any) => r.broadcast_id));
    }
    const list = (items ?? []).map((b: any) => ({ ...b, is_read: readSet.has(b.id) }));
    return {
      items: list as Array<Broadcast & { is_read: boolean }>,
      unread_count: list.filter((b: any) => !b.is_read).length,
    };
  });

// ----- User: mark broadcast read -----
export const markBroadcastRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ broadcast_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await supabaseAdmin
      .from("broadcast_reads")
      .upsert(
        { broadcast_id: data.broadcast_id, user_id: context.userId },
        { onConflict: "broadcast_id,user_id", ignoreDuplicates: true },
      );
    return { ok: true };
  });

// ----- User: mark all read -----
export const markAllBroadcastsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: rows } = await supabaseAdmin
      .from("broadcasts")
      .select("id,expires_at")
      .eq("is_active", true);
    const items = (rows ?? []).filter((b: any) => !b.expires_at || b.expires_at > now);
    const ids = (items ?? []).map((b: any) => b.id);
    if (!ids.length) return { ok: true };
    const readRows = ids.map((id: string) => ({ broadcast_id: id, user_id: context.userId }));
    await supabaseAdmin
      .from("broadcast_reads")
      .upsert(readRows, { onConflict: "broadcast_id,user_id", ignoreDuplicates: true });
    return { ok: true };
  });

// ----- Admin: list all (including inactive) -----
export const adminListBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as Broadcast[];
  });

// ----- Admin: create -----
export const adminCreateBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(2000),
      icon: z.string().trim().min(1).max(64).default("sparkles"),
      tone: z.enum(["info", "success", "warning", "premium"]).default("premium"),
      expires_at: z.string().datetime().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("broadcasts")
      .insert({
        title: data.title,
        body: data.body,
        icon: data.icon,
        tone: data.tone,
        expires_at: data.expires_at ?? null,
        created_by: context.userId,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ----- Admin: toggle is_active -----
export const adminToggleBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("broadcasts")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Admin: delete -----
export const adminDeleteBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("broadcasts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
