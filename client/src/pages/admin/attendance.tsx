import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList } from "lucide-react";

export default function AdminAttendance() {
  const { data: entries, isLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const empMap = new Map((employees || []).map(e => [e.id, e]));
  const sorted = [...(entries || [])].sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime());

  const flagColors: Record<string, string> = {
    late_clock_in: "destructive",
    early_clock_in: "secondary",
    left_early: "destructive",
    overtime: "default",
    no_show: "destructive",
    unscheduled_clock_in: "secondary",
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-attendance-title">Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">Review all time entries and attendance records</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !sorted.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No attendance records</p>
            <p className="text-muted-foreground text-sm mt-1">Records will appear when employees clock in</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((entry: any) => {
                    const emp = empMap.get(entry.employeeId);
                    const clockIn = new Date(entry.clockInAt);
                    const hours = entry.workedMinutes ? `${Math.floor(entry.workedMinutes / 60)}h ${entry.workedMinutes % 60}m` : (entry.status === "active" ? "In progress" : "-");
                    return (
                      <TableRow key={entry.id} data-testid={`row-attendance-${entry.id}`}>
                        <TableCell className="font-medium text-sm">
                          {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm">{clockIn.toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{clockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                        <TableCell className="text-sm">
                          {entry.clockOutAt ? new Date(entry.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{hours}</TableCell>
                        <TableCell>
                          <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-xs">
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(entry.flags || []).map((flag: string, i: number) => (
                              <Badge key={i} variant={(flagColors[flag] as any) || "secondary"} className="text-xs">
                                {flag.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
