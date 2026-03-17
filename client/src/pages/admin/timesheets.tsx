import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, RefreshCw, CheckCircle, Clock,
  User2, AlertTriangle, Printer, Users,
} from "lucide-react";

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
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
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

function printTimesheet(ts: any, employee: any, companyName: string) {
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
    .summary { display: flex; gap: 24px; margin-bottom: 16px; background: #f5f5f5; padding: 12px; border-radius: 6px; }
    .stat { }
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
    Employee: ${employee?.firstName || ""} ${employee?.lastName || ""} ${employee?.employeeId ? `(${employee.employeeId})` : ""}<br/>
    Pay Period: ${fmtDate(ts.payPeriodStart)} – ${fmtDate(ts.payPeriodEnd)}<br/>
    Status: <span class="status">${STATUS_LABELS[ts.status] || ts.status}</span>
    ${ts.approvedAt ? `&nbsp;· Approved ${fmtDateTime(ts.approvedAt)}` : ""}
    ${ts.submittedAt ? `&nbsp;· Submitted ${fmtDateTime(ts.submittedAt)}` : ""}
  </div>
  <div class="summary">
    <div class="stat"><div class="stat-label">Total Hours</div><div class="stat-value">${fmtMins(ts.totalWorkedMinutes)}</div></div>
    <div class="stat"><div class="stat-label">Regular</div><div class="stat-value">${fmtMins(ts.regularMinutes)}</div></div>
    <div class="stat"><div class="stat-label">Overtime</div><div class="stat-value">${fmtMins(ts.overtimeMinutes)}</div></div>
    <div class="stat"><div class="stat-label">Shifts</div><div class="stat-value">${ts.totalShifts}</div></div>
    <div class="stat"><div class="stat-label">Late</div><div class="stat-value">${ts.lateCount}</div></div>
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

export default function AdminTimesheets() {
  const { toast } = useToast();
  const { data: company } = useQuery<any>({ queryKey: ["/api/company"] });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const today = new Date().toISOString().split("T")[0];
  const periodDays = company?.defaultPayPeriodType === "weekly" ? 7 : 14;
  const currentBounds = company
    ? getPayPeriodBounds(company.payrollCycleStartDate, company.defaultPayPeriodType, today)
    : { start: today, end: today };

  const prevBounds = company
    ? getPayPeriodBounds(company.payrollCycleStartDate, company.defaultPayPeriodType,
        shiftPeriod(currentBounds.start, periodDays, -1))
    : null;
  const prev2Bounds = company && prevBounds
    ? getPayPeriodBounds(company.payrollCycleStartDate, company.defaultPayPeriodType,
        shiftPeriod(prevBounds.start, periodDays, -1))
    : null;

  const [periodStart, setPeriodStart] = useState<string>("");
  const [empFilter, setEmpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);

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

  const { data: timesheets, isLoading: tsLoading } = useQuery<any[]>({
    queryKey: ["/api/timesheets", periodStart],
    queryFn: async () => {
      const res = await fetch(`/api/timesheets?periodStart=${periodStart}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!periodStart,
    staleTime: 30 * 1000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/timesheets", detailId],
    queryFn: async () => {
      const res = await fetch(`/api/timesheets/${detailId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!detailId,
    staleTime: 0,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/timesheets/generate", { periodStart, periodEnd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", periodStart] });
      toast({ title: `Generated ${data.length} timesheet(s)` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/timesheets/${id}/approve`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", periodStart] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", detailId] });
      toast({ title: "Timesheet approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const empMap = new Map((employees || []).map((e: any) => [e.id, e]));

  const filtered = [...(timesheets || [])]
    .filter(t => empFilter === "all" || t.employeeId === empFilter)
    .filter(t => statusFilter === "all" || t.status === statusFilter);

  const detailEmp = detail ? empMap.get(detail.employeeId) : null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-timesheets-title">Timesheets</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and approve employee timesheets by pay period</p>
        </div>
        <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending || !periodStart} data-testid="button-generate-timesheets">
          <RefreshCw className={`w-4 h-4 mr-2 ${generateMut.isPending ? "animate-spin" : ""}`} />
          {generateMut.isPending ? "Generating…" : "Generate Timesheets"}
        </Button>
      </div>

      {/* Period presets + nav */}
      <div className="space-y-2">
        {company && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={periodStart === currentBounds.start ? "default" : "outline"}
              size="sm" className="h-7 text-xs"
              onClick={() => setPeriodStart(currentBounds.start)}
              data-testid="button-preset-current"
            >
              Current Period
            </Button>
            {prevBounds && (
              <Button
                variant={periodStart === prevBounds.start ? "default" : "outline"}
                size="sm" className="h-7 text-xs"
                onClick={() => setPeriodStart(prevBounds.start)}
                data-testid="button-preset-previous"
              >
                Previous Period
              </Button>
            )}
            {prev2Bounds && (
              <Button
                variant={periodStart === prev2Bounds.start ? "default" : "outline"}
                size="sm" className="h-7 text-xs"
                onClick={() => setPeriodStart(prev2Bounds.start)}
                data-testid="button-preset-2ago"
              >
                2 Periods Ago
              </Button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setPeriodStart(s => shiftPeriod(s, periodDays, -1))}
            data-testid="button-period-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-3 py-1.5 rounded-md bg-muted text-sm font-medium min-w-[200px] text-center">
            {periodStart && periodEnd ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}` : "Loading…"}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setPeriodStart(s => shiftPeriod(s, periodDays, 1))}
            disabled={!periodStart || periodStart >= currentBounds.start}
            data-testid="button-period-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={empFilter} onValueChange={setEmpFilter}>
          <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-ts-employee">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {(employees || []).map((e: any) => (
              <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-ts-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {tsLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="w-14 h-14 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No timesheets for this period</p>
            <p className="text-muted-foreground text-sm mt-1">Click "Generate Timesheets" to create them from attendance records</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ts: any) => {
            const emp = empMap.get(ts.employeeId);
            return (
              <Card key={ts.id} className="cursor-pointer hover:shadow-sm transition-shadow" data-testid={`card-ts-${ts.id}`} onClick={() => setDetailId(ts.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</p>
                          {emp?.employeeId && <span className="text-xs text-muted-foreground font-mono">{emp.employeeId}</span>}
                          <Badge variant={STATUS_VARIANT[ts.status] || "secondary"} className="text-xs">
                            {STATUS_LABELS[ts.status] || ts.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtMins(ts.totalWorkedMinutes)} hrs</span>
                          {ts.overtimeMinutes > 0 && <span className="text-amber-600 font-medium">OT: {fmtMins(ts.overtimeMinutes)}</span>}
                          <span>{ts.totalShifts} shifts</span>
                          {ts.lateCount > 0 && <span className="flex items-center gap-0.5 text-orange-500"><AlertTriangle className="w-3 h-3" />{ts.lateCount} late</span>}
                          {ts.submittedAt && <span>Submitted {fmtDateTime(ts.submittedAt)}</span>}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
          {detailLoading || !detail ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle className="text-base">
                      {detailEmp ? `${detailEmp.firstName} ${detailEmp.lastName}` : "Timesheet"}
                      {detailEmp?.employeeId && <span className="text-muted-foreground font-normal text-sm ml-2 font-mono">{detailEmp.employeeId}</span>}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(detail.payPeriodStart)} – {fmtDate(detail.payPeriodEnd)}
                      &nbsp;·&nbsp;{detail.payPeriodType}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[detail.status] || "secondary"} className="text-xs flex-shrink-0">
                    {STATUS_LABELS[detail.status] || detail.status}
                  </Badge>
                </div>
                {detail.submittedAt && (
                  <p className="text-xs text-muted-foreground">Submitted {fmtDateTime(detail.submittedAt)}</p>
                )}
                {detail.approvedAt && (
                  <p className="text-xs text-green-600">Approved {fmtDateTime(detail.approvedAt)}</p>
                )}
              </DialogHeader>

              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-2 py-1">
                {[
                  { label: "Total Hours", value: fmtMins(detail.totalWorkedMinutes) },
                  { label: "Regular", value: fmtMins(detail.regularMinutes) },
                  { label: "Overtime", value: fmtMins(detail.overtimeMinutes) },
                  { label: "Shifts", value: detail.totalShifts },
                  { label: "Late", value: detail.lateCount },
                  { label: "Left Early", value: detail.leftEarlyCount },
                  { label: "Missed", value: detail.missedShiftCount },
                ].map(s => (
                  <div key={s.label} className="bg-muted/60 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Daily entries */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <p className="text-xs font-medium text-muted-foreground mb-2">Daily Breakdown</p>
                {!detail.entries?.length ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No time entries recorded this period</p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_80px_80px_60px_100px] gap-2 text-[10px] font-medium text-muted-foreground px-2 pb-1 border-b">
                      <span>Date</span><span>In</span><span>Out</span><span>Hours</span><span>Flags</span>
                    </div>
                    {detail.entries.map((e: any) => (
                      <div key={e.id} className="grid grid-cols-[1fr_80px_80px_60px_100px] gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/40">
                        <span className="text-foreground font-medium">
                          {new Date(e.clockInAt).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="text-muted-foreground">{fmtTime(e.clockInAt)}</span>
                        <span className="text-muted-foreground">{e.clockOutAt ? fmtTime(e.clockOutAt) : "—"}</span>
                        <span className="font-medium">{fmtMins(e.workedMinutes || 0)}</span>
                        <span className="text-muted-foreground truncate">
                          {(e.flags || []).length ? (e.flags as string[]).map(f => f.replace(/_/g, " ")).join(", ") : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t pt-3 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printTimesheet(detail, detailEmp, (company as any)?.name || "Company")}
                  data-testid="button-print-timesheet"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Print / Download
                </Button>
                {detail.status !== "approved" && (
                  <Button
                    size="sm"
                    onClick={() => approveMut.mutate(detail.id)}
                    disabled={approveMut.isPending}
                    data-testid="button-approve-timesheet"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    {approveMut.isPending ? "Approving…" : "Approve"}
                  </Button>
                )}
                {detail.status === "approved" && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />Approved
                  </span>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
