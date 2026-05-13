import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Users, Calendar, ClipboardList,
  DollarSign, Building2,
  Settings, LogOut, Clock, Users2, BookOpen,
  CreditCard, Bell, ShieldAlert, ChevronRight, Newspaper,
  FileInput, GraduationCap, MessageSquare, TrendingUp,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Employees", url: "/admin/employees", icon: Users },
  { title: "Schedule", url: "/admin/schedule", icon: Calendar },
  { title: "Attendance", url: "/admin/attendance", icon: ClipboardList },
  { title: "Payroll", url: "/admin/payroll", icon: DollarSign },
  { title: "Clients", url: "/admin/clients", icon: Building2 },
  { title: "Messages", url: "/admin/messages", icon: MessageSquare },
  { title: "Management", url: "/admin/management", icon: Users2 },
  { title: "Work Log", url: "/admin/work-log", icon: BookOpen },
  { title: "Sales", url: "/admin/sales", icon: TrendingUp },
  { title: "Forms", url: "/admin/quote-forms", icon: FileInput },
  { title: "Training Hub", url: "/admin/training", icon: GraduationCap },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];


export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout, isSuperAdmin } = useAuth();

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/platform-messages"],
    enabled: !!user,
    staleTime: 60_000,
  });
  const unreadMessages = (messages as any[]).filter(m => !m.isRead).length;

  const { data: unreadMsgs } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/messages/unread-count"],
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unreadMsgCount = unreadMsgs?.count ?? 0;

  const initials = user ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}` : "A";

  // Work Log tab is active for work-log, reports, field-notes, requests sub-paths
  // Supplies is now nested under Work Log, so the legacy /admin/supplies
  // path also lights up the Work Log tab.
  const workLogPaths = ["/admin/work-log", "/admin/reports", "/admin/field-notes", "/admin/requests", "/admin/supplies"];
  const isWorkLogActive = workLogPaths.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p + "?"));

  const salesPaths = ["/admin/sales"];
  const isSalesActive = salesPaths.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p + "?"));

  // Publications is active for all publication-related paths
  const publicationsPaths = ["/admin/publications", "/admin/proposals", "/admin/agreements"];
  const isPublicationsActive = publicationsPaths.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p + "?"));

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-semibold text-sm">ClockField</span>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === "/admin/work-log"
                  ? isWorkLogActive
                  : item.url === "/admin/sales"
                  ? isSalesActive
                  : location === item.url || (item.url !== "/admin" && location.startsWith(item.url));
                const isMessages = item.url === "/admin/messages";
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span className="flex items-center justify-between w-full">
                          {item.title}
                          {isMessages && unreadMsgCount > 0 && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] h-4 min-w-[16px] px-1 rounded-full">
                              {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                            </Badge>
                          )}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* ── Publications (single item — tabs inside page) ── */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isPublicationsActive}
                  data-testid="nav-publications"
                >
                  <Link href="/admin/publications">
                    <Newspaper className="w-4 h-4" />
                    <span>Publications</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/admin/subscription"}>
                  <Link href="/admin/subscription" data-testid="nav-subscription">
                    <CreditCard className="w-4 h-4" />
                    <span>Subscription</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/admin/platform-messages"}>
                  <Link href="/admin/platform-messages" data-testid="nav-platform-messages">
                    <Bell className="w-4 h-4" />
                    <span className="flex items-center justify-between w-full">
                      Notifications
                      {unreadMessages > 0 && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] h-4 min-w-[16px] px-1 rounded-full">
                          {unreadMessages}
                        </Badge>
                      )}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/super-admin" data-testid="nav-super-admin">
                      <ShieldAlert className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-purple-700">Super Admin</span>
                      <ChevronRight className="w-3 h-3 ml-auto text-purple-500" />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="w-8 h-8 text-muted-foreground hover:text-destructive"
            data-testid="button-sidebar-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
