import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle, Clock, Send, Printer, FileText } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", approved: "Approved", needs_review: "Needs Review",
};
const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "secondary", submitted: "default", approved: "outline", needs_review: "destructive",
};

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}
function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getPayPeriodBounds(cycleStartDate: string | null, periodType: string, referenceDate: string) {
  const periodDays = periodType === "weekly" ? 7 : 14;
  const anchor = cycleStartDate || referenceDate;
  const startDate = new Date(anchor + "T12:00:00");
  const ref = new Date(referenceDate + "T12:00:00");
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((ref.getTime() - startDate.getTime()) / msPerDay);
  const periodIndex = Math.floor(diffDays / periodDays);
  const periodStartMs = startDate.getTime() + periodIndex * periodDays * msPerDay;
  const ps = new Date(periodStartMs);
  const pe = new Date(periodStartMs + (periodDays - 1) * msPerDay);
  return { start: ps.toISOString().split("T")[0], end: pe.toISOString().split("T")[0] };
}

function shiftPeriod(current: string, periodDays: number, direction: 1 | -1): string {
  const d = new Date(current + "T12:00:00");
  d.setDate(d.getDate() + direction * periodDays);
  return d.toISOString().split("T")[0];
}

function printTimesheet(ts: any, user: any, companyName: string) {
  const entries: any[] = ts.entries || [];
  const rows = entries.map((e: any) => `
    <tr>
      <td>${new Date(e.clockInAt).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</td>
      <td>${fmtTime(e.clockInAt)}</td>
      <td>${e.clockOutAt ? fmtTime(e.clockOutAt) : "—"}</td>
      <td>${fmtMins(e.workedMinutes || 0)}</td>
      <td>${(e.flags || []).join(", ").replace(/_/g, " ") || "—"}</td>
    </tr>`).join("");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Timesheet</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #555; margin-bottom: 16px; }
    .summary { display: flex; gap: 24px; margin-bottom: 16px; background: #f5f5f5; padding: 12px; border-radius: 6px; flex-wrap: wrap; }
    .stat-label { font-size: 11px; color: #777; }
    .stat-value { font-size: 16px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 12px; }
    td { border-top: 1px solid #e5e5e5; padding: 6px 8px; }
    .footer { margin-top: 24px; color: #777; font-size: 11px; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #e5e5e5; font-weight: bold; }
    @media print { button { display: none; } }
  </style></head><body>
  <h1>Timesheet</h1>
  <div class="meta">
    <strong>${companyName}</strong><br/>
    Employee: ${user?.firstName || ""} ${user?.lastName || ""} ${user?.employeeId ? `(${user.employeeId})` : ""}<br/>
    Pay Period: ${fmtDate(ts.payPeriodStart)} – ${fmtDate(ts.payPeriodEnd)}<br/>
    Status: <span class="status">${STATUS_LABELS[ts.status] || ts.status}</span>
    ${ts.submittedAt ? `&nbsp;· Submitted ${fmtDateTime(ts.submittedAt)}` : ""}
    ${ts.approvedAt ? `&nbsp;· Approved ${fmtDateTime(ts.approvedAt)}` : ""}
  </div>
  <div class="summary">
    <div class="stat"><div class="stat-label">Total Hours</div><div class="stat-value">${fmtMins(ts.totalWorkedMinutes)}</div></div>
    <div class="stat"><div class="stat-label">Regular</div><div class="stat-value">${fmtMins(ts.regularMinutes)}</div></div>
    <div class="stat"><div class="stat-label">Overtime</div><div class="stat-value">${fmtMins(ts.overtimeMinutes)}</div></div>
    <div class="stat"><div class="stat-label">Shifts</div><div class="stat-value">${ts.totalShifts}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Flags</th></tr></thead>
    <tbody>${rows || "<tr><td colspan='5' style='color:#999;text-align:center;padding:16px'>No entries this period</td></tr>"}</tbody>
  </table>
  <div class="footer">Generated ${new Date().toLocaleDateString("en-CA")}</div>
  <br/><button onclick="window.print()">Print</button>
  </body></html>`);
  win.document.close();
  win.focus();
}

export default function EmployeeTimesheets() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: company } = useQuery<any>({ queryKey: ["/api/company"] });

  const today = new Date().toISOString().split("T")[0];
  const periodDays = company?.defaultPayPeriodType === "weekly" ? 7 : 14;
  const currentBounds = company
    ? getPayPeriodBounds(company.payrollCycleStartDate, company.defaultPayPeriodType, today)
    : { start: today, end: today };

  const [periodStart, setPeriodStart] = useState<string>("");

  useEffect(() => {
    if (company && !periodStart) setPeriodStart(currentBounds.start);
  }, [company]);

  const periodEnd = periodStart
    ? (() => {
        const ps = new Date(periodStart + "T12:00:00");
        const pe = new Date(ps.getTime() + (periodDays - 1) * 24 * 60 * 60 * 1000);
        return pe.toISOString().split("T")[0];
      })()
    : "";

  const { data: allTimesheets, isLoading: listLoading } = useQuery<any[]>({
    queryKey: ["/api/timesheets"],
    staleTime: 30 * 1000,
  });

  const currentTs = allTimesheets?.find(t => t.payPeriodStart === periodStart);

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/timesheets", currentTs?.id],
    queryFn: async () => {
      const res = await fetch(`/api/timesheets/${currentTs!.id}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!currentTs?.id,
    staleTime: 0,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/timesheets/generate", { periodStart, periodEnd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({ title: "Timesheet generated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/timesheets/${currentTs!.id}/submit`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", currentTs?.id] });
      toast({ title: "Timesheet submitted to admin" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const ts = detail || currentTs;
  const isCurrentPeriod = periodStart === currentBounds.start;

  return (
    <div className="p-4 pb-24 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" data-testid="text-emp-timesheets-title">My Timesheets</h1>
        <p className="text-sm text-muted-foreground">Review and submit your pay period timesheets</p>
      </div>

      {/* Period navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setPeriodStart(s => shiftPeriod(s, periodDays, -1))}
          data-testid="button-period-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold">
            {periodStart && periodEnd ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}` : "Loading…"}
          </p>
          <p className="text-xs text-muted-foreground">{company?.defaultPayPeriodType || "biweekly"} period</p>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setPeriodStart(s => shiftPeriod(s, periodDays, 1))}
          disabled={periodStart >= currentBounds.start}
          data-testid="button-period-next"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Loading */}
      {(listLoading || detailLoading) ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !ts ? (
        /* No timesheet yet */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground font-medium text-sm">No timesheet for this period</p>
            <p className="text-muted-foreground text-xs mt-1 mb-4">
              {isCurrentPeriod ? "Generate your timesheet from your attendance records" : "No attendance data for this period"}
            </p>
            {isCurrentPeriod && (
              <Button size="sm" onClick={() => generateMut.mutate()} disabled={generateMut.isPending} data-testid="button-generate-my-ts">
                <RefreshCw className={`w-4 h-4 mr-1.5 ${generateMut.isPending ? "animate-spin" : ""}`} />
                {generateMut.isPending ? "Generating…" : "Generate Timesheet"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status + actions bar */}
          <div className="flex items-center justify-between gap-2">
            <Badge variant={STATUS_VARIANT[ts.status] || "secondary"} className="text-xs px-2 py-0.5">
              {STATUS_LABELS[ts.status] || ts.status}
            </Badge>
            <div className="flex items-center gap-2">
              {isCurrentPeriod && ts.status === "draft" && (
                <Button variant="outline" size="sm" onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generateMut.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => printTimesheet(ts, user, company?.name || "Company")}
                data-testid="button-print-my-ts"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print
              </Button>
              {ts.status === "draft" && (
                <Button size="sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending} data-testid="button-submit-my-ts">
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {submitMut.isPending ? "Submitting…" : "Submit"}
                </Button>
              )}
              {ts.status === "approved" && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />Approved
                </span>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Total Hours", value: fmtMins(ts.totalWorkedMinutes), icon: <Clock className="w-4 h-4 text-primary" /> },
              { label: "Regular", value: fmtMins(ts.regularMinutes) },
              { label: "Overtime", value: fmtMins(ts.overtimeMinutes) },
              { label: "Shifts", value: String(ts.totalShifts) },
              { label: "Late Arrivals", value: String(ts.lateCount) },
              { label: "Left Early", value: String(ts.leftEarlyCount) },
              { label: "Missed Shifts", value: String(ts.missedShiftCount) },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold mt-0.5">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {ts.submittedAt && (
            <p className="text-xs text-muted-foreground">Submitted {fmtDateTime(ts.submittedAt)}</p>
          )}
          {ts.approvedAt && (
            <p className="text-xs text-green-600">✓ Approved {fmtDateTime(ts.approvedAt)}</p>
          )}

          {/* Daily breakdown */}
          <div>
            <p className="text-sm font-medium mb-2">Daily Breakdown</p>
            {!(detail?.entries?.length) ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">No time entries recorded this period</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {detail.entries.map((e: any) => (
                  <Card key={e.id} className="overflow-hidden" data-testid={`row-ts-entry-${e.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {new Date(e.clockInAt).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtTime(e.clockInAt)} → {e.clockOutAt ? fmtTime(e.clockOutAt) : "Still clocked in"}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold">{fmtMins(e.workedMinutes || 0)}</p>
                          {(e.flags || []).length > 0 && (
                            <p className="text-[10px] text-orange-500 mt-0.5">
                              {(e.flags as string[]).map(f => f.replace(/_/g, " ")).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
