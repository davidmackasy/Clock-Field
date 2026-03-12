import { useLocation, Link } from "wouter";
import { Home, Calendar, Clock, FileText, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

export function MobileNav({ items }: { items: NavItem[] }) {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom" data-testid="mobile-nav">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} data-testid={`nav-${item.label.toLowerCase()}`}>
              <div className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-colors min-w-[56px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const employeeNavItems: NavItem[] = [
  { label: "Home", href: "/employee", icon: Home },
  { label: "Schedule", href: "/employee/schedule", icon: Calendar },
  { label: "Hours", href: "/employee/hours", icon: Clock },
  { label: "Reports", href: "/employee/requests", icon: MessageSquare },
  { label: "Profile", href: "/employee/profile", icon: User },
];

export const clientNavItems: NavItem[] = [
  { label: "Home", href: "/client", icon: Home },
  { label: "Requests", href: "/client/requests", icon: FileText },
  { label: "Profile", href: "/client/profile", icon: User },
];
