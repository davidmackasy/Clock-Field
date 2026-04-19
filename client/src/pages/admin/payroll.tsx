import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Clock, Users, TrendingDown, ChevronRight, Calendar } from "lucide-react";
import PayRunsTab from "./pay-runs-tab";
import PayStubsTab from "./pay-stubs-tab";
import AdminTimesheets from "./timesheets";

// ── Period helpers ────────────────────────────────────────────────────────────

type PeriodFilter = "this_week" | "last_week" | "this_2_weeks" | "last_2_weeks" | "this_month" | "last_month";
type AllPeriodFilter = PeriodFilter | "custom";

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getBiweeklyPeriod(offset: number, anchor: string): { start: string; end: string } {
  const anchorMs = new Date(anchor + "T00:00:00").getTime();
  const todayMs = new Date(toDateStr(new Date()) + "T00:00:00").getTime();
  const diffDays = Math.floor((todayMs - anchorMs) / 86400000);
  const currentIdx = Math.floor(diffDays / 14);
  const idx = currentIdx + offset;
  const startMs = anchorMs + idx * 14 * 86400000;
  const endMs = startMs + 13 * 86400000;
  return { start: toDateStr(new Date(startMs)), end: toDateStr(new Date(endMs)) };
}

function getDateRange(filter: PeriodFilter, cycleAnchor: string): { start: string; end: string; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filter === "this_week") {
    const mon = getMondayOf(today);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: toDateStr(mon), end: toDateStr(sun), label: "This Week" };
  }
  if (filter === "last_week") {
    const mon = getMondayOf(today); mon.setDate(mon.getDate() - 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: toDateStr(mon), end: toDateStr(sun), label: "Last Week" };
  }
  if (filter === "this_2_weeks") {
    const { start, end } = getBiweeklyPeriod(0, cycleAnchor);
    return { start, end, label: "This 2 Weeks" };
  }
  if (filter === "last_2_weeks") {
    const { start, end } = getBiweeklyPeriod(-1, cycleAnchor);
    return { start, end, label: "Last 2 Weeks" };
  }
  if (filter === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: toDateStr(start), end: toDateStr(end), label: "This Month" };
  }
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  return { start: toDateStr(start), end: toDateStr(end), label: "Last Month" };
}

function isInRange(clockInAt: string, start: string, end: string): boolean {
  const date = clockInAt.substring(0, 10);
  return date >= start && date <= end;
}

type DeductionConfig = {
  enabled: boolean;
  federalTaxMode: string;
  federalTaxPercent: number;
  provincialTaxMode: string;
  provincialTaxPercent: number;
  cppMode: string;
  cppPercent: number;
  eiMode: string;
  eiPercent: number;
  customDeductions: Array<{ id: string; label: string; type: string; value: number; isActive: boolean }>;
};

type PayrollStats = {
  hours: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  otPay: number;
  grossPay: number;
  federalTax: number;
  provincialTax: number;
  cpp: number;
  ei: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  entriesCount: number;
};

function computeDeductions(grossPay: number, config: DeductionConfig): {
  federalTax: number; provincialTax: number; cpp: number; ei: number; otherDeductions: number; totalDeductions: number;
} {
  if (!config.enabled) {
    return { federalTax: 0, provincialTax: 0, cpp: 0, ei: 0, otherDeductions: 0, totalDeductions: 0 };
  }
  const federalTax = config.federalTaxMode === "percent" ? grossPay * config.federalTaxPercent / 100 : 0;
  const provincialTax = config.provincialTaxMode === "percent" ? grossPay * config.provincialTaxPercent / 100 : 0;
  const cpp = config.cppMode === "percent" ? grossPay * config.cppPercent / 100 : 0;
  const ei = config.eiMode === "percent" ? grossPay * config.eiPercent / 100 : 0;

  const otherDeductions = config.customDeductions
    .filter(d => d.isActive)
    .reduce((sum, d) => {
      if (d.type === "percent") return sum + grossPay * d.value / 100;
      return sum + d.value;
    }, 0);

  const totalDeductions = federalTax + provincialTax + cpp + ei + otherDeductions;
  return { federalTax, provincialTax, cpp, ei, otherDeductions, totalDeductions };
}

function computePayroll(
  allEntries: any[],
  employeeId: string,
  start: string,
  end: string,
  rate: number,
  overtimeRate: number,
  overtimeThreshold: number,
  config: DeductionConfig,
): PayrollStats {
  const empEntries = allEntries.filter(
    e => e.employeeId === employeeId && e.status === "completed" && isInRange(e.clockInAt, start, end)
  );
  const totalMinutes = empEntries.reduce((s: number, e: any) => s + (e.workedMinutes || 0) + (e.totalAdjustmentMinutes || 0), 0);
  const hours = totalMinutes / 60;
  const regularHours = Math.min(hours, overtimeThreshold);
  const overtimeHours = Math.max(0, hours - overtimeThreshold);
  const regularPay = regularHours * rate;
  const otPay = overtimeHours * overtimeRate;
  const grossPay = regularPay + otPay;
  const { federalTax, provincialTax, cpp, ei, otherDeductions, totalDeductions } = computeDeductions(grossPay, config);
  const netPay = grossPay - totalDeductions;
  return { hours, regularHours, overtimeHours, regularPay, otPay, grossPay, federalTax, provincialTax, cpp, ei, otherDeductions, totalDeductions, netPay, entriesCount: empEntries.length };
}

function formatD(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function fmt(n: number) { return n.toFixed(2); }

// ── Payroll History Modal ─────────────────────────────────────────────────────

function PayrollHistoryModal({
  employee,
  allEntries,
  filter,
  cycleAnchor,
  overtimeThreshold,
  deductionConfig,
  onClose,
}: {
  employee: any;
  allEntries: any[];
  filter: PeriodFilter;
  cycleAnchor: string;
  overtimeThreshold: number;
  deductionConfig: DeductionConfig;
  onClose: () => void;
}) {
  const [localFilter, setLocalFilter] = useState<PeriodFilter>(filter);

  const rate = parseFloat(employee.hourlyRate || "0");
  const overtimeRate = parseFloat(employee.overtimeRate || "0") || rate * 1.5;

  const currentRange = useMemo(() => getDateRange(localFilter, cycleAnchor), [localFilter, cycleAnchor]);

  const currentSummary = useMemo(
    () => computePayroll(allEntries, employee.id, currentRange.start, currentRange.end, rate, overtimeRate, overtimeThreshold, deductionConfig),
    [allEntries, employee.id, currentRange, rate, overtimeRate, overtimeThreshold, deductionConfig]
  );

  const historyPeriods = useMemo(() => {
    const periods: Array<ReturnType<typeof computePayroll> & { start: string; end: string; isCurrent: boolean }> = [];
    if (localFilter === "this_2_weeks" || localFilter === "last_2_weeks") {
      for (let i = 0; i >= -5; i--) {
        const { start, end } = getBiweeklyPeriod(i, cycleAnchor);
        const isCurrent = localFilter === "this_2_weeks" ? i === 0 : i === -1;
        const stats = computePayroll(allEntries, employee.id, start, end, rate, overtimeRate, overtimeThreshold, deductionConfig);
        periods.push({ start, end, isCurrent, ...stats });
      }
    } else if (localFilter === "this_week" || localFilter === "last_week") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let i = 0; i >= -5; i--) {
        const mon = getMondayOf(today); mon.setDate(mon.getDate() + i * 7);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const start = toDateStr(mon); const end = toDateStr(sun);
        const isCurrent = localFilter === "this_week" ? i === 0 : i === -1;
        const stats = computePayroll(allEntries, employee.id, start, end, rate, overtimeRate, overtimeThreshold, deductionConfig);
        periods.push({ start, end, isCurrent, ...stats });
      }
    } else {
      const today = new Date();
      for (let i = 0; i >= -5; i--) {
        const mo = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const me = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
        const start = toDateStr(mo); const end = toDateStr(me);
        const isCurrent = localFilter === "this_month" ? i === 0 : i === -1;
        const stats = computePayroll(allEntries, employee.id, start, end, rate, overtimeRate, overtimeThreshold, deductionConfig);
        periods.push({ start, end, isCurrent, ...stats });
      }
    }
    return periods;
  }, [localFilter, cycleAnchor, allEntries, employee.id, rate, overtimeRate, overtimeThreshold, deductionConfig]);

  const showDeductions = deductionConfig.enabled;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-history-title">
            {employee.firstName} {employee.lastName} — Payroll History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center gap-3">
            <Select value={localFilter} onValueChange={v => setLocalFilter(v as PeriodFilter)}>
              <SelectTrigger className="w-44" data-testid="select-popup-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="this_2_weeks">This 2 Weeks</SelectItem>
                <SelectItem value="last_2_weeks">Last 2 Weeks</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {formatD(currentRange.start)} – {formatD(currentRange.end)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gross Pay</p>
                <p className="text-lg font-bold" data-testid="stat-current-gross">${fmt(currentSummary.grossPay)}</p>
              </CardContent>
            </Card>
            {showDeductions && (
              <Card>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Deductions</p>
                  <p className="text-lg font-bold text-red-500">−${fmt(currentSummary.totalDeductions)}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Pay</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-current-net">
                  ${fmt(currentSummary.netPay)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hours</p>
                <p className="text-lg font-bold">{currentSummary.hours.toFixed(1)}h</p>
              </CardContent>
            </Card>
          </div>

          {showDeductions && currentSummary.grossPay > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Estimated Deduction Breakdown</p>
              {currentSummary.federalTax > 0 && <div className="flex justify-between"><span>Federal Tax</span><span className="text-red-500">−${fmt(currentSummary.federalTax)}</span></div>}
              {currentSummary.provincialTax > 0 && <div className="flex justify-between"><span>Provincial Tax</span><span className="text-red-500">−${fmt(currentSummary.provincialTax)}</span></div>}
              {currentSummary.cpp > 0 && <div className="flex justify-between"><span>CPP</span><span className="text-red-500">−${fmt(currentSummary.cpp)}</span></div>}
              {currentSummary.ei > 0 && <div className="flex justify-between"><span>EI</span><span className="text-red-500">−${fmt(currentSummary.ei)}</span></div>}
              {currentSummary.otherDeductions > 0 && <div className="flex justify-between"><span>Other Deductions</span><span className="text-red-500">−${fmt(currentSummary.otherDeductions)}</span></div>}
              <div className="flex justify-between font-semibold border-t pt-1.5 mt-1.5">
                <span>Total Deductions</span><span className="text-red-500">−${fmt(currentSummary.totalDeductions)}</span>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />Pay Period History
            </h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pay Period</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">OT Hrs</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    {showDeductions && <TableHead className="text-right">Fed. Tax</TableHead>}
                    {showDeductions && <TableHead className="text-right">Prov. Tax</TableHead>}
                    {showDeductions && <TableHead className="text-right">CPP</TableHead>}
                    {showDeductions && <TableHead className="text-right">EI</TableHead>}
                    {showDeductions && <TableHead className="text-right">Other</TableHead>}
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right font-semibold">Net Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyPeriods.map((p, i) => (
                    <TableRow key={i} data-testid={`row-period-${i}`} className={p.isCurrent ? "bg-muted/40" : ""}>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.isCurrent && (
                            <Badge variant="outline" className="text-[9px] px-1 h-4 text-blue-600 border-blue-300">Current</Badge>
                          )}
                          <span>{formatD(p.start)} – {formatD(p.end)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{p.hours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-sm">{p.overtimeHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-sm">${fmt(p.grossPay)}</TableCell>
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.federalTax > 0 ? `−$${fmt(p.federalTax)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.provincialTax > 0 ? `−$${fmt(p.provincialTax)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.cpp > 0 ? `−$${fmt(p.cpp)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.ei > 0 ? `−$${fmt(p.ei)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.otherDeductions > 0 ? `−$${fmt(p.otherDeductions)}` : "—"}</TableCell>}
                      <TableCell className="text-right text-sm text-red-500">{p.totalDeductions > 0 ? `−$${fmt(p.totalDeductions)}` : "—"}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        ${fmt(p.netPay)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Estimated payroll only. Deductions are estimates and may differ from official CRA calculations, remittances, and actual payroll.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Payroll Estimator (inner component) ──────────────────────────────────────

function PayrollEstimatorContent() {
  const [filter, setFilter] = useState<AllPeriodFilter>("this_2_weeks");
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [customStart, setCustomStart] = useState<string>(toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState<string>(toDateStr(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  const { data: employees, isLoading: empLoading } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: entries, isLoading: entLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });
  const { data: company } = useQuery<any>({ queryKey: ["/api/company"] });
  const { data: customDeductions } = useQuery<any[]>({ queryKey: ["/api/payroll-deductions"] });

  const isLoading = empLoading || entLoading;

  const cycleAnchor = company?.payrollCycleStartDate || "2025-01-01";
  const overtimeThreshold = company?.overtimeThresholdWeekly || 40;

  const deductionConfig: DeductionConfig = useMemo(() => ({
    enabled: company?.deductionsEnabled ?? false,
    federalTaxMode: company?.federalTaxMode || "off",
    federalTaxPercent: parseFloat(company?.federalTaxPercent || "0"),
    provincialTaxMode: company?.provincialTaxMode || "off",
    provincialTaxPercent: parseFloat(company?.provincialTaxPercent || "0"),
    cppMode: company?.cppMode || "off",
    cppPercent: parseFloat(company?.cppPercent || "0"),
    eiMode: company?.eiMode || "off",
    eiPercent: parseFloat(company?.eiPercent || "0"),
    customDeductions: (customDeductions || []).map(d => ({
      id: d.id,
      label: d.label,
      type: d.type,
      value: parseFloat(d.value || "0"),
      isActive: d.isActive,
    })),
  }), [company, customDeductions]);

  const dateRange = useMemo(() => {
    if (filter === "custom") {
      const start = customStart || toDateStr(new Date());
      const end = customEnd || toDateStr(new Date());
      return { start, end, label: "Custom" };
    }
    return getDateRange(filter as PeriodFilter, cycleAnchor);
  }, [filter, cycleAnchor, customStart, customEnd]);

  const allPayrollData = useMemo(() => {
    return (employees || []).map(emp => {
      const rate = parseFloat(emp.hourlyRate || "0");
      const overtimeRate = parseFloat(emp.overtimeRate || "0") || rate * 1.5;
      const stats = computePayroll(entries || [], emp.id, dateRange.start, dateRange.end, rate, overtimeRate, overtimeThreshold, deductionConfig);
      return { ...emp, ...stats };
    });
  }, [employees, entries, dateRange, deductionConfig, overtimeThreshold]);

  const payrollData = useMemo(() => {
    if (empFilter === "all") return allPayrollData;
    return allPayrollData.filter(p => p.id === empFilter);
  }, [allPayrollData, empFilter]);

  const totalGross = payrollData.reduce((s, p) => s + p.grossPay, 0);
  const totalNet = payrollData.reduce((s, p) => s + p.netPay, 0);
  const totalHours = payrollData.reduce((s, p) => s + p.hours, 0);
  const totalDeductions = payrollData.reduce((s, p) => s + p.totalDeductions, 0);

  const showDeductions = deductionConfig.enabled;

  const safePeriodForModal: PeriodFilter = filter === "custom" ? "this_2_weeks" : (filter as PeriodFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Payroll Estimator</h2>
          <p className="text-muted-foreground text-sm mt-1">Estimated payroll based on tracked hours</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Select value={filter} onValueChange={v => setFilter(v as AllPeriodFilter)}>
              <SelectTrigger className="w-40" data-testid="select-payroll-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="this_2_weeks">This 2 Weeks</SelectItem>
                <SelectItem value="last_2_weeks">Last 2 Weeks</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={empFilter} onValueChange={setEmpFilter}>
              <SelectTrigger className="w-44" data-testid="select-payroll-employee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {(employees || []).map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filter === "custom" ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="h-8 w-36 text-xs"
                  data-testid="input-custom-start"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="h-8 w-36 text-xs"
                  data-testid="input-custom-end"
                />
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {formatD(dateRange.start)} – {formatD(dateRange.end)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Gross</p>
              <p className="text-xl font-bold" data-testid="stat-total-pay">${fmt(totalGross)}</p>
            </div>
          </CardContent>
        </Card>
        {showDeductions && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Deductions</p>
                <p className="text-xl font-bold text-red-500" data-testid="stat-total-deductions">−${fmt(totalDeductions)}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Net</p>
              <p className="text-xl font-bold text-teal-600 dark:text-teal-400" data-testid="stat-total-net">${fmt(totalNet)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Hours</p>
              <p className="text-xl font-bold" data-testid="stat-total-hours">{totalHours.toFixed(1)}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Employees</p>
              <p className="text-xl font-bold">{payrollData.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : payrollData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <DollarSign className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No payroll data</p>
            <p className="text-muted-foreground text-sm mt-1">Add employees and track their hours</p>
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
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">OT Hours</TableHead>
                    <TableHead className="text-right">Regular Pay</TableHead>
                    <TableHead className="text-right">OT Pay</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    {showDeductions && <TableHead className="text-right">Fed. Tax</TableHead>}
                    {showDeductions && <TableHead className="text-right">Prov. Tax</TableHead>}
                    {showDeductions && <TableHead className="text-right">CPP</TableHead>}
                    {showDeductions && <TableHead className="text-right">EI</TableHead>}
                    {showDeductions && <TableHead className="text-right">Other Ded.</TableHead>}
                    {showDeductions && <TableHead className="text-right">Total Ded.</TableHead>}
                    <TableHead className="text-right font-semibold">Net Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollData.map((p: any) => (
                    <TableRow key={p.id} data-testid={`row-payroll-${p.id}`}>
                      <TableCell>
                        <button
                          data-testid={`button-emp-history-${p.id}`}
                          className="font-medium text-sm text-foreground hover:text-primary flex items-center gap-1 group"
                          onClick={() => setSelectedEmployee(p)}
                        >
                          {p.firstName} {p.lastName}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </TableCell>
                      <TableCell className="text-right text-sm">${p.hourlyRate || "0.00"}/hr</TableCell>
                      <TableCell className="text-right text-sm">{p.hours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-sm">{p.overtimeHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-sm">${fmt(p.regularPay)}</TableCell>
                      <TableCell className="text-right text-sm">${fmt(p.otPay)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">${fmt(p.grossPay)}</TableCell>
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.federalTax > 0 ? `−$${fmt(p.federalTax)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.provincialTax > 0 ? `−$${fmt(p.provincialTax)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.cpp > 0 ? `−$${fmt(p.cpp)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.ei > 0 ? `−$${fmt(p.ei)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.otherDeductions > 0 ? `−$${fmt(p.otherDeductions)}` : "—"}</TableCell>}
                      {showDeductions && <TableCell className="text-right text-sm text-red-500">{p.totalDeductions > 0 ? `−$${fmt(p.totalDeductions)}` : "—"}</TableCell>}
                      <TableCell className="text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        ${fmt(p.netPay)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Estimated payroll only. {showDeductions ? "Deductions are estimates and may differ from official CRA calculations and actual payroll." : "Enable estimated deductions in Settings → Payroll Deductions to see a full breakdown."}
      </p>

      {selectedEmployee && entries && (
        <PayrollHistoryModal
          employee={selectedEmployee}
          allEntries={entries}
          filter={safePeriodForModal}
          cycleAnchor={cycleAnchor}
          overtimeThreshold={overtimeThreshold}
          deductionConfig={deductionConfig}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}

// ── Main Payroll Page (tabbed) ─────────────────────────────────────────────────
export default function AdminPayroll() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" data-testid="text-payroll-title">Payroll</h1>
        <p className="text-muted-foreground text-sm mt-1">Estimator, pay runs, and official pay stubs</p>
      </div>
      <Tabs defaultValue="estimator" className="space-y-5">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex" data-testid="tabs-payroll">
          <TabsTrigger value="estimator" data-testid="tab-estimator">Estimator</TabsTrigger>
          <TabsTrigger value="pay-runs" data-testid="tab-pay-runs">Pay Runs</TabsTrigger>
          <TabsTrigger value="pay-stubs" data-testid="tab-pay-stubs">Pay Stubs</TabsTrigger>
          <TabsTrigger value="timesheets" data-testid="tab-timesheets">Timesheets</TabsTrigger>
        </TabsList>
        <TabsContent value="estimator" className="mt-0">
          <PayrollEstimatorContent />
        </TabsContent>
        <TabsContent value="pay-runs" className="mt-0">
          <PayRunsTab />
        </TabsContent>
        <TabsContent value="pay-stubs" className="mt-0">
          <PayStubsTab />
        </TabsContent>
        <TabsContent value="timesheets" className="mt-0">
          <AdminTimesheets />
        </TabsContent>
      </Tabs>
    </div>
  );
}
