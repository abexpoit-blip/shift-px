import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Floating premium Support button — bottom-right on every page.
 * Shows a red dot when the current user has any ticket with unread admin reply.
 */
export function SupportButton() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { count } = await (supabase as any)
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("unread_for_user", true);
      if (!cancelled) setUnread(count ?? 0);
    }
    load();
    const t = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <Link
      to="/support"
      aria-label="Contact support"
      className="fixed z-40 bottom-4 right-4 md:bottom-6 md:right-6
        inline-flex items-center gap-2 pl-3 pr-4 h-11 md:h-12 rounded-full
        bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500
        text-white font-semibold text-sm shadow-[0_10px_30px_-8px_rgba(99,102,241,0.55)]
        ring-1 ring-white/25 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-8px_rgba(147,51,234,0.55)]
        active:translate-y-0 transition-all duration-200 group"
    >
      <span className="relative grid place-items-center h-7 w-7 rounded-full bg-white/15 ring-1 ring-white/25">
        <LifeBuoy className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
        )}
      </span>
      <span className="hidden sm:inline">Support</span>
      {unread > 0 && (
        <span className="hidden sm:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 text-[11px] font-bold">
          {unread}
        </span>
      )}
    </Link>
  );
}

export default SupportButton;
