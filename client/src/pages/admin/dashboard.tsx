import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Clock, AlertTriangle, CalendarCheck, MessageSquare, Timer, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

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
              <p className={`text-2xl font-bold mt-1`} data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
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

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

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
      href: "/admin/attendance?dateRange=today&status=no_show",
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} isLoading={isLoading} />
        ))}
      </div>

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
    </div>
  );
}

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
