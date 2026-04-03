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
  Settings, LogOut, Clock, ShieldCheck, BookOpen,
  CreditCard, Bell, ShieldAlert, ChevronRight, FolderOpen, NotebookPen
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Employees", url: "/admin/employees", icon: Users },
  { title: "Schedule", url: "/admin/schedule", icon: Calendar },
  { title: "Attendance", url: "/admin/attendance", icon: ClipboardList },
  { title: "Payroll", url: "/admin/payroll", icon: DollarSign },
  { title: "Clients", url: "/admin/clients", icon: Building2 },
  { title: "Admins", url: "/admin/admins", icon: ShieldCheck },
  { title: "Reports", url: "/admin/reports", icon: FolderOpen },
  { title: "Work Log", url: "/admin/work-log", icon: BookOpen },
  { title: "Field Notes", url: "/admin/field-notes", icon: NotebookPen },
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

  const initials = user ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}` : "A";

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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url || (item.url !== "/admin" && location.startsWith(item.url))}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                      Messages
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
