import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Clock, Users } from "lucide-react";

export default function AdminPayroll() {
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

    return {
      ...emp,
      totalMinutes,
      hours: hours.toFixed(1),
      regularHours: regularHours.toFixed(1),
      overtimeHours: overtimeHours.toFixed(1),
      regularPay: regularPay.toFixed(2),
      overtimePay: overtimePay.toFixed(2),
      grossPay: grossPay.toFixed(2),
      entriesCount: empEntries.length,
    };
  });

  const totalGross = payrollData.reduce((s, p) => s + parseFloat(p.grossPay), 0);
  const totalHours = payrollData.reduce((s, p) => s + parseFloat(p.hours), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-payroll-title">Payroll Estimator</h1>
        <p className="text-muted-foreground text-sm mt-1">Estimated gross pay based on tracked hours</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Estimated Pay</p>
              <p className="text-xl font-bold" data-testid="stat-total-pay">${totalGross.toFixed(2)}</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollData.map((p: any) => (
                    <TableRow key={p.id} data-testid={`row-payroll-${p.id}`}>
                      <TableCell className="font-medium text-sm">{p.firstName} {p.lastName}</TableCell>
                      <TableCell className="text-right text-sm">${p.hourlyRate || "0.00"}/hr</TableCell>
                      <TableCell className="text-right text-sm">{p.regularHours}h</TableCell>
                      <TableCell className="text-right text-sm">{p.overtimeHours}h</TableCell>
                      <TableCell className="text-right text-sm">${p.regularPay}</TableCell>
                      <TableCell className="text-right text-sm">${p.overtimePay}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">${p.grossPay}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        This is an estimate only. Actual payroll may differ based on deductions, taxes, and adjustments.
      </p>
    </div>
  );
}
