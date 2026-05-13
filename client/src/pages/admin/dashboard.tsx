import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Clock, AlertTriangle, CalendarCheck, MessageSquare, Timer,
  ChevronRight, Settings, Calendar, FileText, BookOpen, X, Check
} from "lucide-react";
import { useLocation } from "wouter";
import { OnboardingModal } from "@/components/onboarding-modal";

// ─── Stat Card ─────────────────────────────────────────────────────────────────
type StatCardProps = {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  href: string;
  isLoading?: boolean;
};

function StatCard({ label, value, icon: Icon, color, bg, border, href, isLoading }: StatCardProps) {
  const [, setLocation] = useLocation();
  return (
    <button
      type="button"
      onClick={() => setLocation(href)}
      className={`w-full text-left rounded-xl border-2 bg-card shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group ${border}`}
      data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold mt-1" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Setup Checklist ───────────────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  {
    key: "settings",
    icon: Settings,
    step: "Step 1",
    title: "Add your company details",
    desc: "Add your company name, logo, and business settings.",
    action: "Complete Company Profile",
    href: "/admin/settings",
  },
  {
    key: "employees",
    icon: Users,
    step: "Step 2",
    title: "Add your team",
    desc: "Invite cleaners, supervisors, admins, and employees.",
    action: "Add Employee",
    href: "/admin/employees",
  },
  {
    key: "schedule",
    icon: Calendar,
    step: "Step 3",
    title: "Create your first schedule",
    desc: "Assign shifts, job sites, and workdays to your team.",
    action: "Create Schedule",
    href: "/admin/schedule",
  },
  {
    key: "report",
    icon: FileText,
    step: "Step 4",
    title: "Create your first client report",
    desc: "Document completed work and share it with clients.",
    action: "Go to Reports",
    href: "/admin/work-log?tab=reports",
  },
  {
    key: "training",
    icon: BookOpen,
    step: "Step 5",
    title: "Assign employee training",
    desc: "Create training courses and assign them to your team.",
    action: "Set Up Training",
    href: "/admin/training",
  },
];

function SetupChecklist({ totalEmployees, onDismiss }: { totalEmployees: number; onDismiss: () => void }) {
  const [, setLocation] = useLocation();
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("cf_checklist_completed");
    const base = new Set<string>(stored ? JSON.parse(stored) : []);
    if (totalEmployees > 0) base.add("employees");
    return base;
  });

  const markDone = (key: string) => {
    setCompletedKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem("cf_checklist_completed", JSON.stringify([...next]));
      return next;
    });
  };

  const completedCount = CHECKLIST_ITEMS.filter(i => completedKeys.has(i.key)).length;
  const pct = Math.round((completedCount / CHECKLIST_ITEMS.length) * 100);

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm overflow-hidden" data-testid="setup-checklist">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Set up your Clockfield workspace</h2>
            <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{completedCount}/{CHECKLIST_ITEMS.length}</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">Complete these steps to get your cleaning business ready.</p>
        </div>
        <button
          onClick={onDismiss}
          className="w-6 h-6 rounded-full hover:bg-[#f3f4f6] flex items-center justify-center flex-shrink-0 transition-colors mt-0.5"
          data-testid="button-dismiss-checklist"
          title="Dismiss checklist"
        >
          <X className="w-3.5 h-3.5 text-[#9ca3af]" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11.5px] font-medium text-[#9ca3af] flex-shrink-0">{pct}%</span>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 pb-4 space-y-2">
        {CHECKLIST_ITEMS.map((item, i) => {
          const done = completedKeys.has(item.key);
          const isCurrent = !done && CHECKLIST_ITEMS.slice(0, i).every(prev => completedKeys.has(prev.key));
          return (
            <div
              key={item.key}
              className={`flex items-start gap-3 p-3 rounded-[9px] transition-all ${
                done ? "opacity-50" : isCurrent ? "bg-primary/5 border border-primary/15" : "opacity-70"
              }`}
              data-testid={`checklist-item-${item.key}`}
            >
              {/* Icon/check */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                done ? "bg-emerald-100" : isCurrent ? "bg-primary/10" : "bg-[#f3f4f6]"
              }`}>
                {done
                  ? <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                  : <item.icon className={`w-4 h-4 ${isCurrent ? "text-primary" : "text-[#9ca3af]"}`} />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10.5px] font-semibold text-[#9ca3af] uppercase tracking-wider">{item.step}</span>
                  {done && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Done</span>}
                </div>
                <p className={`text-[13.5px] font-medium ${done ? "line-through text-[#9ca3af]" : "text-[#111827]"}`}>{item.title}</p>
                {!done && <p className="text-[12px] text-muted-foreground mt-0.5">{item.desc}</p>}
              </div>

              {!done && (
                <button
                  onClick={() => { markDone(item.key); setLocation(item.href); }}
                  className={`flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-[6px] transition-colors ${
                    isCurrent
                      ? "bg-primary text-white hover:bg-[hsl(210,85%,36%)]"
                      : "text-primary border border-primary/30 hover:bg-primary/5"
                  }`}
                  data-testid={`button-checklist-${item.key}`}
                >
                  {item.action}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  const [showOnboarding, setShowOnboarding] = useState(() =>
    localStorage.getItem("cf_onboarding_needed") === "1"
  );
  const [showChecklist, setShowChecklist] = useState(() =>
    localStorage.getItem("cf_checklist_dismissed") !== "1"
  );

  const dismissChecklist = () => {
    localStorage.setItem("cf_checklist_dismissed", "1");
    setShowChecklist(false);
  };

  const hours = stats?.totalWorkedToday ? Math.floor(stats.totalWorkedToday / 60) : 0;
  const mins = stats?.totalWorkedToday ? stats.totalWorkedToday % 60 : 0;
  const hoursDisplay = stats?.totalWorkedToday ? `${hours}h ${mins}m` : "0h";

  const statCards: StatCardProps[] = [
    {
      label: "Active Now",
      value: stats?.activeNow ?? 0,
      icon: Timer,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-200 dark:hover:border-emerald-800",
      href: "/admin/attendance?dateRange=today&status=active",
    },
    {
      label: "Late Today",
      value: stats?.lateToday ?? 0,
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-100 dark:border-amber-900/50 hover:border-amber-200 dark:hover:border-amber-800",
      href: "/admin/attendance?dateRange=today&status=late_clock_in",
    },
    {
      label: "Missed Shifts",
      value: stats?.missedToday ?? 0,
      icon: CalendarCheck,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-100 dark:border-red-900/50 hover:border-red-200 dark:hover:border-red-800",
      href: "/admin/schedule",
    },
    {
      label: "Total Employees",
      value: stats?.totalEmployees ?? 0,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-100 dark:border-blue-900/50 hover:border-blue-200 dark:hover:border-blue-800",
      href: "/admin/employees",
    },
    {
      label: "Open Requests",
      value: stats?.openRequests ?? 0,
      icon: MessageSquare,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/40",
      border: "border-violet-100 dark:border-violet-900/50 hover:border-violet-200 dark:hover:border-violet-800",
      href: "/admin/requests?status=open",
    },
    {
      label: "Hours Today",
      value: hoursDisplay,
      icon: Clock,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
      border: "border-cyan-100 dark:border-cyan-900/50 hover:border-cyan-200 dark:hover:border-cyan-800",
      href: "/admin/attendance?dateRange=today",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of today's operations</p>
      </div>

      {/* Setup checklist for new businesses */}
      {showChecklist && (
        <SetupChecklist
          totalEmployees={stats?.totalEmployees ?? 0}
          onDismiss={dismissChecklist}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} isLoading={isLoading} />
        ))}
      </div>

      <TodayJobsWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <TodayShifts />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>

      {/* Onboarding modal for new registrations */}
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

// ─── Today's Jobs Widget ───────────────────────────────────────────────────────
function TodayJobsWidget() {
  const { data: stats } = useQuery<any>({ queryKey: ["/api/jobs/stats/today"] });

  if (!stats || stats.total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span>Today's Jobs</span>
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{stats.total} total</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Not Started", value: stats.notStarted, color: "text-muted-foreground" },
            { label: "In Progress", value: stats.inProgress, color: "text-amber-600 dark:text-amber-400" },
            { label: "Completed", value: stats.completed, color: "text-green-600 dark:text-green-400" },
            { label: "Needs Review", value: stats.needsReview, color: "text-blue-600 dark:text-blue-400" },
            { label: "Sent to Client", value: stats.sentToClient, color: "text-purple-600 dark:text-purple-400" },
            { label: "Missed", value: stats.missed, color: "text-destructive" },
          ].map(s => (
            <div key={s.label} className="text-center" data-testid={`jobs-stat-${s.label.toLowerCase().replace(/\s+/g,"-")}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Today's Shifts ────────────────────────────────────────────────────────────
function TodayShifts() {
  const today = new Date().toISOString().split("T")[0];
  const { data: shifts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/shifts/date", today],
  });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  if (!shifts?.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No shifts scheduled today</p>;
  }

  const empMap = new Map((employees || []).map(e => [e.id, e]));

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {shifts.slice(0, 8).map((shift: any) => {
        const emp = empMap.get(shift.employeeId);
        const statusColors: Record<string, string> = {
          scheduled: "secondary",
          in_progress: "default",
          completed: "secondary",
          late: "destructive",
          missed: "destructive",
        };
        return (
          <div key={shift.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/40" data-testid={`shift-item-${shift.id}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Badge variant={(statusColors[shift.status] as any) || "secondary"} className="text-xs flex-shrink-0">
              {shift.status.replace("_", " ")}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ─── Recent Activity ───────────────────────────────────────────────────────────
function RecentActivity() {
  const { data: entries, isLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No time entries yet</p>;
  }

  const empMap = new Map((employees || []).map(e => [e.id, e]));
  const sorted = [...entries].sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime()).slice(0, 6);

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {sorted.map((entry: any) => {
        const emp = empMap.get(entry.employeeId);
        return (
          <div key={entry.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/40">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{emp ? `${emp.firstName} ${emp.lastName}` : "Employee"}</p>
              <p className="text-xs text-muted-foreground">
                {entry.status === "active" ? "Clocked in" : "Completed"} - {new Date(entry.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-xs flex-shrink-0">
              {entry.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
