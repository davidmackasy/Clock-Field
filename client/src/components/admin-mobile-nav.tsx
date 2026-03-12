import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Calendar, ClipboardList,
  DollarSign, Building2, MessageSquare, Settings,
  LogOut, MoreHorizontal, Clock, ChevronRight, ShieldCheck,
} from "lucide-react";

const primaryTabs = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Employees", href: "/admin/employees", icon: Users },
  { label: "Schedule", href: "/admin/schedule", icon: Calendar },
  { label: "Attendance", href: "/admin/attendance", icon: ClipboardList },
];

const moreItems = [
  { label: "Payroll", href: "/admin/payroll", icon: DollarSign },
  { label: "Clients", href: "/admin/clients", icon: Building2 },
  { label: "Admins", href: "/admin/admins", icon: ShieldCheck },
  { label: "Requests", href: "/admin/requests", icon: MessageSquare },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/employees": "Employees",
  "/admin/schedule": "Schedule",
  "/admin/attendance": "Attendance",
  "/admin/payroll": "Payroll",
  "/admin/clients": "Clients",
  "/admin/admins": "Admins",
  "/admin/requests": "Requests",
  "/admin/settings": "Settings",
};

export function AdminMobileNav() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const initials = user ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() : "A";
  const pageTitle = pageTitles[location] ?? "ClockField";

  const isMoreActive = moreItems.some(
    (item) => location === item.href || location.startsWith(item.href + "/")
  );

  const handleMoreNav = (href: string) => {
    setMoreOpen(false);
    navigate(href);
  };

  return (
    <>
      {/* Fixed top header — mobile only */}
      <header
        className="fixed top-0 left-0 right-0 z-40 md:hidden bg-background border-b"
        style={{ height: "56px" }}
        data-testid="mobile-top-header"
      >
        <div className="flex items-center justify-between h-full px-4">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center justify-center rounded-full w-9 h-9 focus:outline-none"
            data-testid="button-mobile-profile"
            aria-label="Open profile menu"
          >
            <Avatar className="w-9 h-9">
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Clock className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">{pageTitle}</span>
          </div>

          <div className="w-9 h-9" />
        </div>
      </header>

      {/* Fixed bottom tab bar — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t"
        style={{ height: "64px" }}
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-center justify-around h-full px-1">
          {primaryTabs.map((tab) => {
            const isActive =
              location === tab.href ||
              (tab.href !== "/admin" && location.startsWith(tab.href));
            return (
              <Link key={tab.href} href={tab.href}>
                <div
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[56px] transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                  data-testid={`mobile-nav-${tab.label.toLowerCase()}`}
                >
                  <tab.icon className={cn("w-5 h-5", isActive && "stroke-[2.2]")} />
                  <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
                </div>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[56px] transition-colors",
              isMoreActive ? "text-primary" : "text-muted-foreground"
            )}
            data-testid="mobile-nav-more"
          >
            <MoreHorizontal className={cn("w-5 h-5", isMoreActive && "stroke-[2.2]")} />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Profile sheet */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="left" className="w-72 md:hidden" data-testid="mobile-profile-sheet">
          <SheetHeader className="text-left">
            <SheetTitle>Account</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Admin
                </span>
              </div>
            </div>

            <Separator />

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => {
                setProfileOpen(false);
                logout();
              }}
              data-testid="button-mobile-logout"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl pb-8" data-testid="mobile-more-sheet">
          <SheetHeader className="text-left mb-4">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            {moreItems.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              return (
                <button
                  key={item.href}
                  onClick={() => handleMoreNav(item.href)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                  data-testid={`mobile-more-${item.label.toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
