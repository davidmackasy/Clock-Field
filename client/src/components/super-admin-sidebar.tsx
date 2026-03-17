import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
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
import {
  LayoutDashboard, MessageSquare, LogOut, ShieldAlert, ArrowLeft
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/super-admin", icon: LayoutDashboard },
  { title: "Messages", url: "/super-admin/messages", icon: MessageSquare },
];

export function SuperAdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}` : "SA";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-purple-600 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-semibold text-sm">ClockField</span>
            <p className="text-xs text-purple-600 font-medium">Platform Admin</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`sa-nav-${item.title.toLowerCase()}`}>
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
          <SidebarGroupLabel>Switch Mode</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin" data-testid="sa-nav-back-business">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Business Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs font-semibold bg-purple-100 text-purple-700">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-purple-600 font-medium">Super Admin</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="w-8 h-8 text-muted-foreground hover:text-destructive"
            data-testid="button-sa-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
