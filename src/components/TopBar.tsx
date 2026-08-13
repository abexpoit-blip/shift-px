import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  UserCircle,
  Settings,
  Wallet,
  BarChart3,
  LayoutDashboard,
  Link2,
  Inbox,
  Trophy,
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
          .from("messages")
          .select("id, subject, body, is_broadcast, recipient_id, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("message_reads").select("message_id").eq("user_id", uid),
      ]);
      setMessages((msgRes.data as Msg[] | null) ?? []);
      setReadIds(
        new Set(
          ((readRes.data as { message_id: string }[] | null) ?? []).map(
            (r) => r.message_id,
          ),
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
    const { error } = await supabase.rpc("mark_messages_read", { _ids: ids });
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
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 backdrop-blur px-3 sm:px-4 py-2">
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
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label="Notifications"
              >
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
                      <Link
                        key={m.id}
                        to="/inbox"
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
                              <div className="text-xs text-muted-foreground truncate">
                                {m.body}
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(m.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
              <div className="border-t p-2">
                <Link
                  to="/inbox"
                  className="block text-center text-xs text-primary hover:underline py-1"
                >
                  View all messages
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 inline-flex items-center gap-2 rounded-full hover:bg-muted transition px-1.5 py-1"
                aria-label="Account menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium truncate">
                  {fullName || "Account"}
                </div>
                <div className="text-xs text-muted-foreground truncate font-normal">
                  {email}
                </div>
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
                <Link to="/withdraw">
                  <Wallet className="h-4 w-4 mr-2" /> Withdraw
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Shield className="h-4 w-4 mr-2" /> Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
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
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/create-link")}>
              <Link2 className="h-4 w-4 mr-2" /> Create Link
            </CommandItem>
            <CommandItem onSelect={() => go("/statistics")}>
              <BarChart3 className="h-4 w-4 mr-2" /> Statistics
            </CommandItem>
            <CommandItem onSelect={() => go("/leaderboard")}>
              <Trophy className="h-4 w-4 mr-2" /> Leaderboard
            </CommandItem>
            <CommandItem onSelect={() => go("/inbox")}>
              <Inbox className="h-4 w-4 mr-2" /> Messages
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Earnings">
            <CommandItem onSelect={() => go("/withdraw", { view: "request" })}>
              <Wallet className="h-4 w-4 mr-2" /> New withdraw request
            </CommandItem>
            <CommandItem onSelect={() => go("/withdraw", { view: "history" })}>
              <Wallet className="h-4 w-4 mr-2" /> Withdraw history
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem onSelect={() => go("/settings")}>
              <Settings className="h-4 w-4 mr-2" /> Settings
            </CommandItem>
            <CommandItem onSelect={() => go("/")}>
              <UserCircle className="h-4 w-4 mr-2" /> Home
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false);
                signOut();
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </CommandItem>
          </CommandGroup>
          {isAdmin && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Admin">
                <CommandItem onSelect={() => go("/admin", { tab: "overview" })}>
                  <Shield className="h-4 w-4 mr-2" /> Overview
                </CommandItem>
                <CommandItem onSelect={() => go("/admin", { tab: "users" })}>
                  <Shield className="h-4 w-4 mr-2" /> Users
                </CommandItem>
                <CommandItem onSelect={() => go("/admin", { tab: "withdrawals" })}>
                  <Shield className="h-4 w-4 mr-2" /> Payouts
                </CommandItem>
                <CommandItem onSelect={() => go("/admin", { tab: "ads" })}>
                  <Shield className="h-4 w-4 mr-2" /> Ads Setup
                </CommandItem>
                <CommandItem onSelect={() => go("/admin", { tab: "system" })}>
                  <Shield className="h-4 w-4 mr-2" /> System
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
