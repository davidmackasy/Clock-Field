import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Plus, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

interface ActionSheetOption {
  label: string;
  description: string;
  icon: any;
  href?: string;
  onClick?: () => void;
}

interface CenterAction {
  label: string;
  href?: string;
  onClick?: () => void;
  actionSheet?: {
    title: string;
    options: ActionSheetOption[];
  };
}

interface MobileNavProps {
  items: NavItem[];
  centerAction?: CenterAction;
}

export function MobileNav({ items, centerAction }: MobileNavProps) {
  const [location, navigate] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleCenterClick = () => {
    if (centerAction?.actionSheet) {
      setSheetOpen(true);
    } else if (centerAction?.onClick) {
      centerAction.onClick();
    }
  };

  if (centerAction) {
    const half = Math.floor(items.length / 2);
    const leftItems = items.slice(0, half);
    const rightItems = items.slice(half);

    return (
      <>
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
              {centerAction.actionSheet ? (
                <button
                  data-testid="nav-center-action"
                  onClick={handleCenterClick}
                  className="flex flex-col items-center focus:outline-none"
                >
                  <div className="w-14 h-14 rounded-full bg-primary shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-center active:scale-95 transition-transform border-4 border-background">
                    <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-semibold text-primary mt-0.5">{centerAction.label}</span>
                </button>
              ) : centerAction.href ? (
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
                  onClick={handleCenterClick}
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

        {/* Action Sheet */}
        {sheetOpen && centerAction.actionSheet && (
          <div
            className="fixed inset-0 z-[100] flex flex-col justify-end"
            onClick={() => setSheetOpen(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Sheet panel */}
            <div
              className="relative bg-background rounded-t-2xl shadow-2xl pb-8 px-4 pt-4 animate-in slide-in-from-bottom-4 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-4" />

              {/* Title + close */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base">{centerAction.actionSheet.title}</h3>
                <button
                  data-testid="button-close-action-sheet"
                  onClick={() => setSheetOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {centerAction.actionSheet.options.map((opt, i) => (
                  <button
                    key={i}
                    data-testid={`button-action-${opt.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors active:scale-[0.98] text-left"
                    onClick={() => {
                      setSheetOpen(false);
                      if (opt.href) navigate(opt.href);
                      else if (opt.onClick) opt.onClick();
                    }}
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <opt.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>

              <button
                className="w-full mt-3 py-3 text-sm text-muted-foreground font-medium"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
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

