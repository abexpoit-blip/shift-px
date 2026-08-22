import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Bell,
  Search,
  LogOut,
  Settings,
  Wallet,
  BarChart3,
  LayoutDashboard,
  Link2,
  Shield,
  CheckCheck,
} from "lucide-react";

type Msg = {
  id: string;
  subject: string;
  body: string | null;
  is_broadcast: boolean;
  recipient_id: string | null;
  created_at: string;
};

const ROUTE_LABEL: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/create-link": "Create Link",
  "/statistics": "Statistics",
  "/leaderboard": "Leaderboard",
  "/withdraw": "Withdraw",
  "/inbox": "Messages",
  "/settings": "Settings",
  "/admin": "Admin Panel",
};

export function TopBar({
  email,
  fullName,
  isAdmin,
}: {
  email: string;
  fullName: string;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [cmdOpen, setCmdOpen] = useState(false);

  // notifications (messages)
  const [messages, setMessages] = useState<Msg[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const [msgRes, readRes] = await Promise.all([
        supabase
          .from("broadcasts")
          .select("id, title, body, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("broadcast_reads").select("broadcast_id").eq("user_id", uid),
      ]);
      setMessages(
        (
          (msgRes.data as
            | { id: string; title: string; body: string | null; created_at: string }[]
            | null) ?? []
        ).map((b) => ({
          id: b.id,
          subject: b.title,
          body: b.body,
          is_broadcast: true,
          recipient_id: null,
          created_at: b.created_at,
        })),
      );
      setReadIds(
        new Set(
          ((readRes.data as { broadcast_id: string }[] | null) ?? []).map((r) => r.broadcast_id),
        ),
      );
    })();
  }, []);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const unread = useMemo(
    () => messages.filter((m) => !readIds.has(m.id)).length,
    [messages, readIds],
  );

  async function markAllRead() {
    if (!userId) return;
    const ids = messages.filter((m) => !readIds.has(m.id)).map((m) => m.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("broadcast_reads")
      .upsert(ids.map((id) => ({ broadcast_id: id, user_id: userId })));
    if (!error) setReadIds(new Set([...readIds, ...ids]));
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const title = ROUTE_LABEL[pathname] ?? "";
  const initials =
    (fullName || email || "U")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U";

  function go(to: string, search?: Record<string, string>) {
    setCmdOpen(false);
    navigate({ to: to as any, search: search as any });
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-sky-100 bg-white/95 dark:bg-slate-950/95 dark:border-slate-800 backdrop-blur-xl px-3 sm:px-4 py-2.5 shadow-[0_1px_3px_rgba(2,132,199,0.05)]">
        <SidebarTrigger />
        {title && (
          <div className="hidden sm:flex items-center text-sm">
            <span className="text-muted-foreground">AdsPx</span>
            <span className="mx-2 text-muted-foreground/50">/</span>
            <span className="font-medium tracking-tight">{title}</span>
          </div>
        )}
        <span
          title="AdsPx has been running for 1 year — thank you!"
          className="hidden md:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-gradient-to-r from-amber-500/10 via-primary/10 to-fuchsia-500/10 px-2 py-0.5 text-[11px] font-semibold text-primary shadow-sm"
        >
          🎂 1 Year
        </span>

        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="ml-auto sm:ml-4 flex-1 sm:flex-none sm:min-w-[280px] max-w-md inline-flex items-center gap-2 rounded-md border bg-muted/40 hover:bg-muted transition text-sm text-muted-foreground px-3 py-1.5"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search or jump to…</span>
          <span className="sm:hidden">Search</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">
            <span>⌘</span>K
          </kbd>
        </button>

        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="text-sm font-semibold">Notifications</div>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : (
                  messages.slice(0, 8).map((m) => {
                    const isUnread = !readIds.has(m.id);
                    return (
                      <a
                        key={m.id}
                        href="/notices"
                        className="block border-b last:border-0 px-3 py-2.5 hover:bg-muted/50 transition"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                              isUnread ? "bg-primary" : "bg-transparent"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm truncate ${
                                isUnread ? "font-semibold" : "font-normal"
                              }`}
                            >
                              {m.subject}
                            </div>
                            {m.body && (
                              <div className="text-xs text-muted-foreground truncate">{m.body}</div>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(m.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
              <div className="border-t p-2">
                <a
                  href="/notices"
                  className="block text-center text-xs text-primary hover:underline py-1"
                >
                  View all messages
                </a>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 inline-flex items-center gap-2 rounded-full hover:bg-muted transition px-1.5 py-1"
                aria-label="Account menu"
              >
                <div className="relative group cursor-pointer">
                  <div className="relative h-10 w-10 rounded-full p-[2px] bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_15px_rgba(56,189,248,0.45)] group-hover:scale-105 transition-transform duration-200">
                    <div className="h-full w-full rounded-full overflow-hidden bg-sky-100 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-inner relative">
                      <img
                        src="https://api.dicebear.com/9.x/adventurer/svg?seed=Alexander&backgroundColor=b6e3f4"
                        alt="Male Anime Avatar"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="select-none font-black text-sky-950 text-xs tracking-tight">{(fullName || email || "U").charAt(0).toUpperCase()}</span>
                    </div>
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 shadow-sm animate-pulse" title="Online" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium truncate">{fullName || "Account"}</div>
                <div className="text-xs text-muted-foreground truncate font-normal">{email}</div>
                {isAdmin && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    <Shield className="h-2.5 w-2.5 mr-1" /> Admin
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/withdraw">
                  <Wallet className="h-4 w-4 mr-2" /> Withdraw
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/settings">
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </a>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <a href="/control-panel">
                    <Shield className="h-4 w-4 mr-2" /> Admin Panel
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/links")}>
              <Link2 className="h-4 w-4 mr-2" /> Links
            </CommandItem>
            <CommandItem onSelect={() => go("/statistics")}>
              <BarChart3 className="h-4 w-4 mr-2" /> Statistics
            </CommandItem>
            <CommandItem onSelect={() => go("/withdraw")}>
              <Wallet className="h-4 w-4 mr-2" /> Withdraw
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Settings className="h-4 w-4 mr-2" /> Settings
            </CommandItem>
            {isAdmin && (
              <CommandItem onSelect={() => go("/control-panel")}>
                <Shield className="h-4 w-4 mr-2" /> Admin Panel
              </CommandItem>
            )}
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </CommandDialog>
    </>
  );
}
