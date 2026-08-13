import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { AdspxMark } from "@/components/AdspxLogo";
import { TopBar } from "@/components/TopBar";
import { SupportButton } from "@/components/SupportButton";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  BarChart3,
  Trophy,
  Wallet,
  Send,
  History,
  Inbox,
  Shield,
  Users,
  DollarSign,
  Megaphone,
  Activity,
  FlaskConical,
  Settings2,
  Link2,
  Settings,
  ArrowRight,
  LifeBuoy,
} from "lucide-react";

type NavChild = { title: string; to: string; search?: Record<string, string>; icon: any };
type NavGroup = { label: string; items: (NavChild & { children?: NavChild[] })[] };

function BalanceWidget({ balance }: { balance: number }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const formatted = `$${balance.toFixed(2)}`;

  if (collapsed) {
    return (
      <Link
        to="/withdraw"
        title={`Available: ${formatted}`}
        className="mx-auto my-2 flex h-9 w-9 items-center justify-center rounded-xl text-primary
          bg-gradient-to-b from-white to-slate-100
          shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.06),0_2px_6px_rgba(15,23,42,0.10)]
          hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_14px_rgba(99,102,241,0.25)]
          active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]
          transition-all duration-150"
      >
        <Wallet className="h-4 w-4 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]" />
      </Link>
    );
  }


  return (
    <div className="mx-2 my-2 rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" />
        <span>Available balance</span>
      </div>
      <div className="mt-1 text-lg font-bold tracking-tight tabular-nums">
        {formatted}
      </div>
      <Link
        to="/withdraw"
        search={{ view: "request" } as any}
        className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium py-1.5 hover:opacity-90 transition"
      >
        Withdraw <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function AppSidebar({
  isAdmin,
  balance,
}: {
  isAdmin: boolean;
  balance: number;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const search = useRouterState({ select: (r) => r.location.search }) as unknown as Record<string, string>;

  const groups: NavGroup[] = [
    {
      label: "Main",
      items: [
        { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
        { title: "Create Link", to: "/create-link", icon: Link2 },
        { title: "Statistics", to: "/statistics", icon: BarChart3 },
        { title: "Leaderboard", to: "/leaderboard", icon: Trophy },
      ],
    },
    {
      label: "Earnings",
      items: [
        {
          title: "Withdraw",
          to: "/withdraw",
          icon: Wallet,
          children: [
            { title: "New Request", to: "/withdraw", search: { view: "request" }, icon: Send },
            { title: "History", to: "/withdraw", search: { view: "history" }, icon: History },
          ],
        },
      ],
    },
    {
      label: "Communication",
      items: [
        { title: "Messages", to: "/inbox", icon: Inbox },
        { title: "Support", to: "/support", icon: LifeBuoy },
      ],
    },
    {
      label: "Account",
      items: [{ title: "Settings", to: "/settings", icon: Settings }],
    },
  ];

  if (isAdmin) {
    groups.push({
      label: "Control Center",
      items: [
        {
          title: "Admin Panel",
          to: "/admin",
          icon: Shield,
          children: [
            { title: "Overview", to: "/admin", search: { tab: "overview" }, icon: LayoutDashboard },
            { title: "Users", to: "/admin", search: { tab: "users" }, icon: Users },
            { title: "User History", to: "/admin", search: { tab: "history" }, icon: History },
            { title: "Payouts", to: "/admin", search: { tab: "withdrawals" }, icon: DollarSign },
            { title: "Ads Setup", to: "/admin", search: { tab: "ads" }, icon: Megaphone },
            { title: "Performance", to: "/admin", search: { tab: "performance" }, icon: Activity },
            { title: "Messages", to: "/admin", search: { tab: "messages" }, icon: Inbox },
            { title: "System", to: "/admin", search: { tab: "system" }, icon: Settings2 },
            { title: "Simulator", to: "/admin", search: { tab: "simulator" }, icon: FlaskConical },
          ],
        },
      ],
    });
  }

  const isActive = (item: NavChild) => {
    if (pathname !== item.to) return false;
    if (!item.search) return true;
    return Object.entries(item.search).every(([k, v]) => search?.[k] === v);
  };

  const anyChildActive = (children?: NavChild[]) =>
    !!children?.some((c) => isActive(c));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link
          to="/dashboard"
          className={collapsed ? "flex items-center justify-center px-2 py-2" : "flex items-center gap-2 px-2 py-2"}
          aria-label="AdsPx home"
        >
          <AdspxMark className={collapsed ? "h-7 w-7" : "h-8 w-8 shrink-0"} glow />
          {!collapsed && (
            <span className="font-display text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              AdsPx
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>


        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item) || anyChildActive(item.children);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={active && !item.children}
                        tooltip={item.title}
                        className="group/btn relative h-10 md:h-9 rounded-xl transition-all duration-150
                          md:hover:-translate-y-0.5 md:hover:shadow-[0_4px_10px_-2px_rgba(99,102,241,0.25)]
                          active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)]
                          data-[active=true]:bg-gradient-to-b data-[active=true]:from-indigo-500 data-[active=true]:to-purple-600
                          data-[active=true]:text-white
                          data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_14px_-4px_rgba(99,102,241,0.55)]
                          data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-white/80"
                      >
                        <Link
                          to={item.to as any}
                          search={item.search as any}
                          className="flex items-center gap-2"
                        >
                          <span
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg
                              bg-gradient-to-b from-white to-slate-100
                              shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.06),0_1px_2px_rgba(15,23,42,0.10)]
                              group-hover/btn:from-indigo-50 group-hover/btn:to-purple-50
                              group-data-[active=true]/btn:from-white/25 group-data-[active=true]/btn:to-white/10
                              group-data-[active=true]/btn:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.15)]
                              transition-all"
                          >
                            <Icon className="h-3.5 w-3.5 text-indigo-600 group-data-[active=true]/btn:text-white drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]" />
                          </span>
                          {!collapsed && <span className="font-medium truncate">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>



                      {item.children && !collapsed && (
                        <SidebarMenuSub>
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <SidebarMenuSubItem key={child.title}>
                                <SidebarMenuSubButton asChild isActive={isActive(child)}>
                                  <Link
                                    to={child.to as any}
                                    search={child.search as any}
                                    className="flex items-center gap-2"
                                  >
                                    <ChildIcon className="h-3.5 w-3.5" />
                                    <span>{child.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["app-shell-session"],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        return { isAdmin: false, email: "", fullName: "", balance: 0, hasUser: false };
      }
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("full_name, balance_available")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      return {
        hasUser: true,
        isAdmin: !!rolesRes.data?.some(
          (r: any) => r.role === "admin" || r.role === "super_admin",
        ),
        email: user.email ?? "",
        fullName: (profileRes.data as any)?.full_name ?? "",
        balance: Number((profileRes.data as any)?.balance_available ?? 0),
      };
    },
  });

  const { isAdmin = false, email = "", fullName = "", balance = 0 } = data ?? {};

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar isAdmin={isAdmin} balance={balance} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar email={email} fullName={fullName} isAdmin={isAdmin} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
        <SupportButton />
      </div>
    </SidebarProvider>
  );
}

export default AppShell;

