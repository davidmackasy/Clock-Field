import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format, startOfWeek, startOfMonth, subDays, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";

type FilterPreset = "this_week" | "last_2_weeks" | "this_month" | "custom";

function getPresetRange(preset: FilterPreset): { from: Date; to: Date } {
  const now = new Date();
  if (preset === "this_week") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
  }
  if (preset === "last_2_weeks") {
    return { from: subDays(now, 13), to: now };
  }
  if (preset === "this_month") {
    return { from: startOfMonth(now), to: now };
  }
  return { from: subDays(now, 13), to: now };
}

const flagColors: Record<string, string> = {
  late_clock_in: "destructive",
  early_clock_in: "secondary",
  left_early: "destructive",
  overtime: "default",
  unscheduled_clock_in: "secondary",
};

const formatDuration = (min: number) => `${Math.floor(min / 60)}h ${Math.floor(min % 60)}m`;

function AdjustmentDetail({ entry }: { entry: any }) {
  const [open, setOpen] = useState(false);
  const adj = entry.totalAdjustmentMinutes || 0;
  const reasons: string[] = entry.adjustmentReasons || [];
  if (adj === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(o => !o)}
        data-testid={`button-adj-expand-${entry.id}`}
      >
        <span className={adj > 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
          Adj: {adj > 0 ? "+" : ""}{formatDuration(Math.abs(adj))}
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-1 rounded-md bg-muted/50 px-2.5 py-2 text-xs space-y-0.5">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Original worked:</span>{" "}
            {entry.workedMinutes != null ? formatDuration(entry.workedMinutes) : "-"}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Admin adjustment:</span>{" "}
            <span className={adj > 0 ? "text-green-600" : "text-destructive"}>
              {adj > 0 ? "+" : ""}{formatDuration(Math.abs(adj))}
            </span>
          </p>
          {reasons.length > 0 && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Reason:</span>{" "}
              {reasons.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmployeeHours() {
  const { user } = useAuth();
  const { data: entries, isLoading } = useQuery<any[]>({
    queryKey: ["/api/time-entries", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/time-entries", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const [preset, setPreset] = useState<FilterPreset>("last_2_weeks");
  const [customFrom, setCustomFrom] = useState<string>(() => format(subDays(new Date(), 13), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

  const { rangeFrom, rangeTo } = useMemo(() => {
    if (preset === "custom") {
      return {
        rangeFrom: customFrom ? startOfDay(parseISO(customFrom)) : subDays(new Date(), 13),
        rangeTo: customTo ? endOfDay(parseISO(customTo)) : new Date(),
      };
    }
    const r = getPresetRange(preset);
    return { rangeFrom: startOfDay(r.from), rangeTo: endOfDay(r.to) };
  }, [preset, customFrom, customTo]);

  const sorted = useMemo(() =>
    [...(entries || [])].sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime()),
    [entries]
  );

  const filtered = useMemo(() =>
    sorted.filter(e => {
      const d = new Date(e.clockInAt);
      return isWithinInterval(d, { start: rangeFrom, end: rangeTo });
    }),
    [sorted, rangeFrom, rangeTo]
  );

  const completedFiltered = useMemo(() =>
    filtered.filter(e => e.clockInAt && e.clockOutAt),
    [filtered]
  );

  const { rawMinutes, adjustedMinutes, hasAdjustments } = useMemo(() => {
    let raw = 0, adjusted = 0, anyAdj = false;
    for (const e of completedFiltered) {
      const worked = e.workedMinutes != null
        ? e.workedMinutes
        : Math.max(0, (new Date(e.clockOutAt).getTime() - new Date(e.clockInAt).getTime()) / 60000);
      const adjMins = e.totalAdjustmentMinutes || 0;
      raw += worked;
      adjusted += Math.max(0, worked + adjMins);
      if (adjMins !== 0) anyAdj = true;
    }
    return { rawMinutes: raw, adjustedMinutes: adjusted, hasAdjustments: anyAdj };
  }, [completedFiltered]);

  const totalShifts = completedFiltered.length;

  const presets: { key: FilterPreset; label: string }[] = [
    { key: "this_week", label: "This Week" },
    { key: "last_2_weeks", label: "Last 2 Weeks" },
    { key: "this_month", label: "This Month" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="p-4 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-hours-title">My Hours</h1>
        <p className="text-sm text-muted-foreground">Track your worked time</p>
      </div>

      <div className="flex gap-2 flex-wrap" data-testid="filter-preset-bar">
        {presets.map(p => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? "default" : "outline"}
            onClick={() => setPreset(p.key)}
            data-testid={`filter-${p.key}`}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex gap-3 flex-wrap items-end" data-testid="custom-range-inputs">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-8 text-sm w-38"
              data-testid="input-custom-from"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-8 text-sm w-38"
              data-testid="input-custom-to"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {hasAdjustments ? "Payable Hours" : "Total Hours Worked"}
            </p>
            <p className="text-2xl font-bold mt-1" data-testid="stat-total-hours">
              {formatDuration(adjustedMinutes)}
            </p>
            {hasAdjustments && (
              <p className="text-xs text-muted-foreground mt-0.5" data-testid="stat-raw-hours">
                Raw: {formatDuration(rawMinutes)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Shifts</p>
            <p className="text-2xl font-bold mt-1" data-testid="stat-total-shifts">{totalShifts}</p>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground text-center" data-testid="text-range-label">
        {format(rangeFrom, "MMM d, yyyy")} – {format(rangeTo, "MMM d, yyyy")}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">History</h2>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">No entries in this range</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry: any) => {
              const clockIn = new Date(entry.clockInAt);
              const adj = entry.totalAdjustmentMinutes || 0;
              const rawWorked = entry.workedMinutes;
              const adjustedWorked = rawWorked != null ? Math.max(0, rawWorked + adj) : null;

              return (
                <Card key={entry.id} data-testid={`entry-card-${entry.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {clockIn.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs font-mono" data-testid={`stat-duration-${entry.id}`}>
                        {entry.status === "active"
                          ? "In Progress"
                          : adjustedWorked != null
                          ? formatDuration(adjustedWorked)
                          : "-"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{clockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>-</span>
                      <span>
                        {entry.clockOutAt
                          ? new Date(entry.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "Active"}
                      </span>
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
                    <AdjustmentDetail entry={entry} />
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
