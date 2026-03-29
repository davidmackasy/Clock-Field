import { useLocation, Link } from "wouter";
import { Home, Calendar, User, Plus, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

interface CenterAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface MobileNavProps {
  items: NavItem[];
  centerAction?: CenterAction;
}

export function MobileNav({ items, centerAction }: MobileNavProps) {
  const [location] = useLocation();

  if (centerAction) {
    const half = Math.floor(items.length / 2);
    const leftItems = items.slice(0, half);
    const rightItems = items.slice(half);

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom" data-testid="mobile-nav">
        <div className="flex items-end justify-around h-16 px-1 pb-1">
          {leftItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} data-testid={`nav-${item.label.toLowerCase()}`}>
                <div className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md transition-colors min-w-[52px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}

          <div className="flex flex-col items-center -mt-6">
            {centerAction.href ? (
              <Link href={centerAction.href} data-testid="nav-center-action">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-primary shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-center active:scale-95 transition-transform border-4 border-background">
                    <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-semibold text-primary mt-0.5">{centerAction.label}</span>
                </div>
              </Link>
            ) : (
              <button
                onClick={centerAction.onClick}
                data-testid="nav-center-action"
                className="flex flex-col items-center focus:outline-none"
              >
                <div className="w-14 h-14 rounded-full bg-primary shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-center active:scale-95 transition-transform border-4 border-background">
                  <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <span className="text-[9px] font-semibold text-primary mt-0.5">{centerAction.label}</span>
              </button>
            )}
          </div>

          {rightItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} data-testid={`nav-${item.label.toLowerCase()}`}>
                <div className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md transition-colors min-w-[52px]",
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
  { label: "Reports", href: "/employee/reports", icon: FolderOpen },
  { label: "Profile", href: "/employee/profile", icon: User },
];

export const employeeCenterAction: CenterAction = {
  label: "Work",
  href: "/employee/work-log",
};

export const clientNavItems: NavItem[] = [
  { label: "Home", href: "/client", icon: Home },
  { label: "Reports", href: "/client/reports", icon: FolderOpen },
  { label: "Profile", href: "/client/profile", icon: User },
];
