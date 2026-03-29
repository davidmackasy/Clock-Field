import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { localToday } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, Square, MapPin, Calendar, Timer } from "lucide-react";

export default function EmployeeHome() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState(0);

  const { data: tzData } = useQuery<{ timezone: string }>({
    queryKey: ["/api/settings/timezone"],
    staleTime: Infinity,
  });
  const tz = tzData?.timezone || "UTC";

  const { data: activeEntry, isLoading: entryLoading } = useQuery<any>({
    queryKey: ["/api/time-entries/active"],
    refetchInterval: 10000,
  });

  const { data: myShifts, isLoading: shiftsLoading } = useQuery<any[]>({
    queryKey: ["/api/shifts"],
  });

  const clockInMut = useMutation({
    mutationFn: async (shiftId?: string) => {
      const res = await apiRequest("POST", "/api/time-entries/clock-in", { shiftId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Clocked in!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const clockOutMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/time-entries/clock-out");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Clocked out!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!activeEntry) { setElapsed(0); return; }
    const start = new Date(activeEntry.clockInAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const today = localToday(tz);
  const todayShifts = (myShifts || []).filter(s => s.shiftDate === today && s.status === "scheduled");
  const upcomingShifts = (myShifts || []).filter(s => s.shiftDate > today && s.status === "scheduled").slice(0, 3);

  const isActive = !!activeEntry;

  return (
    <div className="p-4 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-welcome">
          Hi, {user?.firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <Card className={isActive ? "border-primary/30 bg-primary/5 dark:bg-primary/10" : ""}>
        <CardContent className="p-5">
          {entryLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-16 w-40 mx-auto" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isActive ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Currently Working</span>
              </div>
              <p className="text-5xl font-mono font-bold tracking-tight mb-1" data-testid="text-timer">{formatTime(elapsed)}</p>
              <p className="text-xs text-muted-foreground mb-5">
                Started at {new Date(activeEntry.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <Button
                size="lg"
                variant="destructive"
                className="w-full h-14 text-base font-semibold"
                onClick={() => clockOutMut.mutate()}
                disabled={clockOutMut.isPending}
                data-testid="button-clock-out"
              >
                <Square className="w-5 h-5 mr-2" />
                {clockOutMut.isPending ? "Clocking out..." : "Clock Out"}
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Not Clocked In</span>
              </div>
              <p className="text-4xl font-mono font-bold tracking-tight text-muted-foreground/30 mb-5" data-testid="text-timer-idle">00:00:00</p>

              {todayShifts.length > 0 ? (
                <div className="space-y-2">
                  {todayShifts.map(shift => (
                    <Button
                      key={shift.id}
                      size="lg"
                      className="w-full h-14 text-base font-semibold"
                      onClick={() => clockInMut.mutate(shift.id)}
                      disabled={clockInMut.isPending}
                      data-testid={`button-clock-in-${shift.id}`}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Clock In - {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full h-14 text-base font-semibold"
                  onClick={() => clockInMut.mutate()}
                  disabled={clockInMut.isPending}
                  data-testid="button-clock-in"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {clockInMut.isPending ? "Clocking in..." : "Clock In"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {todayShifts.length > 0 && !isActive && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Today's Shifts</h2>
          <div className="space-y-2">
            {todayShifts.map(shift => (
              <Card key={shift.id} data-testid={`today-shift-${shift.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {shift.expectedHours && <p className="text-xs text-muted-foreground">{parseFloat(shift.expectedHours).toFixed(1)}h scheduled</p>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">Scheduled</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {upcomingShifts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Upcoming</h2>
          <div className="space-y-2">
            {upcomingShifts.map(shift => (
              <Card key={shift.id} data-testid={`upcoming-shift-${shift.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(shift.shiftDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{parseFloat(shift.expectedHours || "0").toFixed(1)}h</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
