import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Clock, Users, TrendingDown, ChevronRight, Calendar } from "lucide-react";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function PayrollHistoryModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/payroll/employees", employee.id, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/employees/${employee.id}/history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const current = data?.currentPeriod;
  const periods = data?.periods || [];

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee.firstName} {employee.lastName} — Payroll History</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Gross</p>
                  <p className="text-lg font-bold text-foreground" data-testid="stat-current-gross">
                    ${current?.grossPay.toFixed(2) ?? "0.00"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Net</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-current-net">
                    ${current?.netPay.toFixed(2) ?? "0.00"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Hours</p>
                  <p className="text-lg font-bold text-foreground">
                    {current?.hours.toFixed(1) ?? "0.0"}h
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hourly Rate</p>
                  <p className="text-lg font-bold text-foreground">
                    ${data?.employee.hourlyRate.toFixed(2) ?? "0.00"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />Pay Period History
              </h3>
              {periods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No payroll history yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pay Period</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">OT Hrs</TableHead>
                        <TableHead className="text-right">Gross Pay</TableHead>
                        <TableHead className="text-right">Tax (5%)</TableHead>
                        <TableHead className="text-right font-semibold">Net Pay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.map((p: any) => (
                        <TableRow
                          key={p.index}
                          data-testid={`row-period-${p.index}`}
                          className={p.isCurrent ? "bg-muted/40" : ""}
                        >
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              {p.isCurrent && (
                                <Badge variant="outline" className="text-[9px] px-1 h-4 text-blue-600 border-blue-300">
                                  Current
                                </Badge>
                              )}
                              <span>{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{p.hours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right text-sm">{p.overtimeHours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right text-sm">${p.grossPay.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm text-red-500">−${p.taxAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            ${p.netPay.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Tax deduction shown is a fixed 5% estimate. Actual deductions may vary.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPayroll() {
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  const { data: employees, isLoading: empLoading } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: entries, isLoading: entLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });

  const isLoading = empLoading || entLoading;

  const payrollData = (employees || []).map(emp => {
    const empEntries = (entries || []).filter(e => e.employeeId === emp.id && e.status === "completed");
    const totalMinutes = empEntries.reduce((sum: number, e: any) => sum + (e.workedMinutes || 0), 0);
    const rate = parseFloat(emp.hourlyRate || "0");
    const hours = totalMinutes / 60;
    const regularHours = Math.min(hours, 40);
    const overtimeHours = Math.max(0, hours - 40);
    const overtimeRate = parseFloat(emp.overtimeRate || "0") || rate * 1.5;
    const regularPay = regularHours * rate;
    const overtimePay = overtimeHours * overtimeRate;
    const grossPay = regularPay + overtimePay;
    const taxAmount = grossPay * 0.05;
    const netPay = grossPay - taxAmount;

    return {
      ...emp,
      totalMinutes,
      hours: hours.toFixed(1),
      regularHours: regularHours.toFixed(1),
      overtimeHours: overtimeHours.toFixed(1),
      regularPay: regularPay.toFixed(2),
      overtimePay: overtimePay.toFixed(2),
      grossPay: grossPay.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      netPay: netPay.toFixed(2),
      entriesCount: empEntries.length,
    };
  });

  const totalGross = payrollData.reduce((s, p) => s + parseFloat(p.grossPay), 0);
  const totalNet = payrollData.reduce((s, p) => s + parseFloat(p.netPay), 0);
  const totalHours = payrollData.reduce((s, p) => s + parseFloat(p.hours), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-payroll-title">Payroll Estimator</h1>
        <p className="text-muted-foreground text-sm mt-1">Estimated gross pay based on tracked hours</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Gross</p>
              <p className="text-xl font-bold" data-testid="stat-total-pay">${totalGross.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Net</p>
              <p className="text-xl font-bold text-teal-600 dark:text-teal-400" data-testid="stat-total-net">${totalNet.toFixed(2)}</p>
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
                      <TableCell className="text-right text-sm">{p.regularHours}h</TableCell>
                      <TableCell className="text-right text-sm">{p.overtimeHours}h</TableCell>
                      <TableCell className="text-right text-sm">${p.regularPay}</TableCell>
                      <TableCell className="text-right text-sm">${p.overtimePay}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">${p.grossPay}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        ${p.netPay}
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
        This is an estimate only. Net pay uses a 5% fixed tax deduction. Actual payroll may differ based on deductions, taxes, and adjustments.
      </p>

      {selectedEmployee && (
        <PayrollHistoryModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
