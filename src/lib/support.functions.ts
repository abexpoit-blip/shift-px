import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----- Helpers -----
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

// ----- Public: get support status (is support enabled) -----
export const getSupportStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const supabaseAdmin = await getSupabaseAdmin();
    try {
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return { enabled: (data as any)?.support_enabled !== false };
    } catch {
      return { enabled: true };
    }
  });

// ----- Admin: toggle support on/off -----
export const toggleSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    try {
      const { data: firstRow } = await supabaseAdmin.from("app_settings").select("id").limit(1).maybeSingle();
      if (firstRow) {
        await supabaseAdmin
          .from("app_settings")
          .update({ support_enabled: data.enabled } as any)
          .eq("id", firstRow.id);
      }
    } catch (err) {
      console.warn("[support] toggle error:", err);
    }
    return { ok: true, enabled: data.enabled };
  });

// ----- User: create a new ticket -----
export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().trim().min(1).max(200),
        message: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    // Verify support is enabled
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("support_enabled")
      .eq("id", true)
      .maybeSingle();
    if (settings?.support_enabled === false) {
      throw new Error("Support is currently disabled by admin");
    }

    // Rate limit: max 5 open tickets per user
    const { count: openCount } = await supabaseAdmin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .neq("status", "closed");
    if ((openCount ?? 0) >= 5) {
      throw new Error("You already have 5 open tickets. Please wait for replies.");
    }

    let insertPayload: any = {
      user_id: context.userId,
      subject: data.subject,
      message: data.message,
      status: "open",
    };

    let { data: row, error } = await supabaseAdmin
      .from("support_tickets")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error && error.message.includes("message")) {
      // Fallback if message column is not yet migrated
      const fallbackPayload = {
        user_id: context.userId,
        subject: `[${data.subject}] ${data.message}`,
        status: "open",
      };
      const res = await supabaseAdmin
        .from("support_tickets")
        .insert(fallbackPayload)
        .select("*")
        .single();
      row = res.data;
      error = res.error;
    }

    if (error) throw new Error(error.message);
    return row;
  });

// ----- User: list my tickets -----
export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t: any) => ({
      id: t.id,
      subject: t.subject || "Support Ticket",
      message: t.message || t.subject || "",
      status: t.status || "open",
      admin_reply: t.admin_reply ?? null,
      replied_at: t.replied_at ?? null,
      created_at: t.created_at,
    }));
  });

// ----- Admin: list all tickets -----
export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["all", "open", "replied", "closed"]).default("all"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: tickets, error } = await q;
    if (error) throw new Error(error.message);

    // Fetch user emails in one go
    const userIds = Array.from(new Set((tickets ?? []).map((t: any) => t.user_id)));
    const profileMap: Record<string, { email: string | null; full_name: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,email,full_name")
        .in("id", userIds);
      (profs ?? []).forEach((p: any) => {
        profileMap[p.id] = { email: p.email, full_name: p.full_name };
      });
    }

    return (tickets ?? []).map((t: any) => ({
      ...t,
      user_email: profileMap[t.user_id]?.email ?? null,
      user_name: profileMap[t.user_id]?.full_name ?? null,
    }));
  });

// ----- Admin: reply to a ticket -----
export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        reply: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    let { error } = await supabaseAdmin
      .from("support_tickets")
      .update({
        admin_reply: data.reply,
        status: "replied",
        replied_at: new Date().toISOString(),
        replied_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.ticket_id);

    if (error && (error.message.includes("admin_reply") || error.code === "PGRST204")) {
      const { data: ticket } = await supabaseAdmin
        .from("support_tickets")
        .select("subject")
        .eq("id", data.ticket_id)
        .maybeSingle();

      const updatedSub = `${ticket?.subject || "Ticket"} [Admin: ${data.reply}]`;
      const fallbackRes = await supabaseAdmin
        .from("support_tickets")
        .update({
          subject: updatedSub,
          status: "replied",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.ticket_id);
      error = fallbackRes.error;
    }

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Admin: close a ticket -----
export const adminCloseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Admin: delete a ticket -----
export const adminDeleteTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("support_tickets").delete().eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
