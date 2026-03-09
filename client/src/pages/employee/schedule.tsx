import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MapPin } from "lucide-react";

export default function EmployeeSchedule() {
  const { data: shifts, isLoading } = useQuery<any[]>({ queryKey: ["/api/shifts"] });

  const today = new Date().toISOString().split("T")[0];
  const todayShifts = (shifts || []).filter(s => s.shiftDate === today);

  const getWeekDates = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekShifts = (shifts || []).filter(s => weekDates.includes(s.shiftDate));
  const upcomingShifts = (shifts || []).filter(s => s.shiftDate > today).sort((a, b) => a.shiftDate.localeCompare(b.shiftDate)).slice(0, 10);

  const statusColors: Record<string, string> = {
    scheduled: "secondary",
    in_progress: "default",
    completed: "secondary",
    late: "destructive",
    missed: "destructive",
  };

  const renderShiftCard = (shift: any) => (
    <Card key={shift.id} data-testid={`shift-card-${shift.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-medium">
                {new Date(shift.shiftDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {shift.expectedHours && <span>{parseFloat(shift.expectedHours).toFixed(1)}h</span>}
            </div>
            {shift.shiftNotes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{shift.shiftNotes}</p>}
          </div>
          <Badge variant={(statusColors[shift.status] as any) || "secondary"} className="text-xs flex-shrink-0">
            {shift.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-schedule-title">My Schedule</h1>
        <p className="text-sm text-muted-foreground">View your assigned shifts</p>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today" data-testid="tab-today">Today</TabsTrigger>
          <TabsTrigger value="week" data-testid="tab-week">This Week</TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 space-y-2">
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : todayShifts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">No shifts today</p>
              </CardContent>
            </Card>
          ) : todayShifts.map(renderShiftCard)}
        </TabsContent>

        <TabsContent value="week" className="mt-4 space-y-2">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : weekShifts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">No shifts this week</p>
              </CardContent>
            </Card>
          ) : weekShifts.map(renderShiftCard)}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4 space-y-2">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : upcomingShifts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">No upcoming shifts</p>
              </CardContent>
            </Card>
          ) : upcomingShifts.map(renderShiftCard)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
