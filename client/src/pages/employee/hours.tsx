import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Calendar } from "lucide-react";

export default function EmployeeHours() {
  const { data: entries, isLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });

  const sorted = [...(entries || [])].sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime());

  const today = new Date().toISOString().split("T")[0];
  const todayEntries = sorted.filter(e => e.clockInAt.startsWith(today));
  const todayMinutes = todayEntries.reduce((sum, e) => sum + (e.workedMinutes || 0), 0);

  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split("T")[0];
  };

  const weekStart = getWeekStart();
  const weekEntries = sorted.filter(e => e.clockInAt >= weekStart);
  const weekMinutes = weekEntries.reduce((sum, e) => sum + (e.workedMinutes || 0), 0);

  const monthStart = new Date().toISOString().slice(0, 7);
  const monthEntries = sorted.filter(e => e.clockInAt.startsWith(monthStart));
  const monthMinutes = monthEntries.reduce((sum, e) => sum + (e.workedMinutes || 0), 0);

  const formatDuration = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

  const flagColors: Record<string, string> = {
    late_clock_in: "destructive",
    early_clock_in: "secondary",
    left_early: "destructive",
    overtime: "default",
    unscheduled_clock_in: "secondary",
  };

  return (
    <div className="p-4 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-hours-title">My Hours</h1>
        <p className="text-sm text-muted-foreground">Track your worked time</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Today</p>
            <p className="text-lg font-bold mt-0.5" data-testid="stat-today-hours">{formatDuration(todayMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">This Week</p>
            <p className="text-lg font-bold mt-0.5" data-testid="stat-week-hours">{formatDuration(weekMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">This Month</p>
            <p className="text-lg font-bold mt-0.5" data-testid="stat-month-hours">{formatDuration(monthMinutes)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">History</h2>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">No time entries yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sorted.map((entry: any) => {
              const clockIn = new Date(entry.clockInAt);
              return (
                <Card key={entry.id} data-testid={`entry-card-${entry.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-sm font-medium">{clockIn.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                      </div>
                      <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-xs">
                        {entry.status === "active" ? "In Progress" : entry.workedMinutes ? formatDuration(entry.workedMinutes) : "-"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{clockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>-</span>
                      <span>{entry.clockOutAt ? new Date(entry.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active"}</span>
                    </div>
                    {(entry.flags || []).length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {entry.flags.map((flag: string, i: number) => (
                          <Badge key={i} variant={(flagColors[flag] as any) || "secondary"} className="text-xs">
                            {flag.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
