import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, ChevronLeft, Printer, DollarSign } from "lucide-react";
import { Link } from "wouter";

function fmt(n: number | string) { return parseFloat(n as string || "0").toFixed(2); }
function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function typeLabel(t: string) { return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

function getYear(s: string) { return s ? s.substring(0, 4) : ""; }

function printPayStub(stub: any) {
  const earningsRows = (stub.earnings || []).map((e: any) => `
    <tr>
      <td>${e.description}</td>
      <td style="text-align:right">${parseFloat(e.hours||"0").toFixed(2)}</td>
      <td style="text-align:right">$${parseFloat(e.rate||"0").toFixed(2)}</td>
      <td style="text-align:right">$${parseFloat(e.amount||"0").toFixed(2)}</td>
      <td style="text-align:right">—</td>
    </tr>`).join("");
  const deductionRows = (stub.deductions || []).map((d: any) => `
    <tr>
      <td>${d.description}</td>
      <td style="text-align:right">$${parseFloat(d.amount||"0").toFixed(2)}</td>
      <td style="text-align:right">—</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><title>Pay Stub</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 24px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0; }
    h2 { font-size: 13px; margin: 0 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 14px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 18px; gap: 20px; }
    .info-block { flex: 1; }
    .meta { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 18px; background: #f8f8f8; padding: 10px 14px; border-radius: 4px; font-size:11px; }
    .meta-item strong { display: block; font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #f0f0f0; padding: 6px 8px; text-align: left; font-size: 11px; border-bottom: 1px solid #ccc; }
    th:not(:first-child) { text-align: right; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    .net-pay-row { font-size: 15px; font-weight: bold; }
    .footer { font-size: 10px; color: #999; margin-top: 24px; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    @media print { body { padding: 0; } }
  </style></head><body>
  <div class="header">
    <div><h1>${stub.companyNameSnapshot || "Company"}</h1></div>
    <div style="text-align:right"><strong style="font-size:16px">PAY STUB</strong><div style="font-size:10px; color:#777">ID: ${stub.id.substring(0,8).toUpperCase()}</div></div>
  </div>
  <div class="info-row">
    <div class="info-block"><strong>Employer</strong><br>${stub.companyNameSnapshot || ""}</div>
    <div class="info-block" style="text-align:right"><strong>Employee</strong><br>${stub.employeeNameSnapshot || ""}${stub.employeeIdSnapshot ? "<br>ID: " + stub.employeeIdSnapshot : ""}${stub.employeePositionSnapshot ? "<br>" + stub.employeePositionSnapshot : ""}</div>
  </div>
  <div class="meta">
    <div class="meta-item"><strong>Pay Period</strong>${fmtDate(stub.periodStart)} – ${fmtDate(stub.periodEnd)}</div>
    <div class="meta-item"><strong>Pay Date</strong>${fmtDate(stub.payDate || "")}</div>
    <div class="meta-item"><strong>Pay Rate</strong>$${parseFloat(stub.employeeRateSnapshot||"0").toFixed(2)}/hr</div>
    <div class="meta-item"><strong>Hours</strong>${parseFloat(stub.totalHours||"0").toFixed(2)}</div>
  </div>
  <h2>Earnings</h2>
  <table>
    <thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th><th>YTD</th></tr></thead>
    <tbody>${earningsRows}</tbody>
    <tfoot><tr class="total-row"><td colspan="3">Gross Pay</td><td style="text-align:right">$${fmt(stub.grossPay)}</td><td style="text-align:right">—</td></tr></tfoot>
  </table>
  <h2>Deductions</h2>
  <table>
    <thead><tr><th>Description</th><th>Amount</th><th>YTD</th></tr></thead>
    <tbody>${deductionRows || '<tr><td colspan="3" style="text-align:center; color:#999">No deductions</td></tr>'}</tbody>
    <tfoot><tr class="total-row"><td>Total Deductions</td><td style="text-align:right">$${fmt(stub.totalDeductions)}</td><td style="text-align:right">—</td></tr></tfoot>
  </table>
  <table>
    <tfoot><tr class="net-pay-row"><td>Net Pay</td><td style="text-align:right; color:#166534">$${fmt(stub.netPay)}</td></tr></tfoot>
  </table>
  <div class="footer">Pay Stub ID: ${stub.id} &bull; Cloud Clock Field &bull; This is an official pay record.</div>
  </body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
}

// ─── Pay Stub Detail Sheet ────────────────────────────────────────────────────
function PayStubDetail({ stub: initialStub, onClose }: { stub: any; onClose: () => void }) {
  const { data: stub, isLoading } = useQuery<any>({
    queryKey: ["/api/employee/pay-stubs", initialStub.id],
    queryFn: () => fetch(`/api/employee/pay-stubs/${initialStub.id}`, { credentials: "include" }).then(r => r.json()),
    initialData: initialStub,
  });

  if (isLoading || !stub) return <div className="p-6 text-center text-muted-foreground text-sm">Loading pay stub…</div>;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header action bar */}
      <div className="p-4 border-b bg-muted/20 shrink-0">
        <Button onClick={() => printPayStub(stub)} className="w-full sm:w-auto gap-2" data-testid="button-download-stub">
          <Printer className="w-4 h-4" />Print / Download PDF
        </Button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Company + Employee */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Employer</p>
            <p className="font-semibold">{stub.companyNameSnapshot || "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Employee</p>
            <p className="font-semibold">{stub.employeeNameSnapshot || "—"}</p>
            {stub.employeeIdSnapshot && <p className="text-xs text-muted-foreground">ID: {stub.employeeIdSnapshot}</p>}
            {stub.employeePositionSnapshot && <p className="text-xs text-muted-foreground capitalize">{stub.employeePositionSnapshot}</p>}
          </div>
        </div>

        {/* Period info */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Pay Period</p>
            <p className="font-medium">{fmtDate(stub.periodStart)} – {fmtDate(stub.periodEnd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pay Date</p>
            <p className="font-medium">{fmtDate(stub.payDate || "")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pay Rate</p>
            <p className="font-medium">${parseFloat(stub.employeeRateSnapshot || "0").toFixed(2)}/hr</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="font-medium">{parseFloat(stub.totalHours || "0").toFixed(2)}h</p>
          </div>
        </div>

        {/* Earnings */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Earnings</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2.5 text-xs text-muted-foreground font-semibold">Description</th>
                  <th className="text-right p-2.5 text-xs text-muted-foreground font-semibold hidden sm:table-cell">Hrs</th>
                  <th className="text-right p-2.5 text-xs text-muted-foreground font-semibold">Amount</th>
                  <th className="text-right p-2.5 text-xs text-muted-foreground font-semibold hidden sm:table-cell">YTD</th>
                </tr>
              </thead>
              <tbody>
                {(stub.earnings || []).map((e: any, i: number) => (
                  <tr key={e.id || i} className="border-t" data-testid={`row-emp-earning-${i}`}>
                    <td className="p-2.5">
                      <div className="font-medium">{e.description}</div>
                      <div className="text-[10px] text-muted-foreground">{typeLabel(e.type)}</div>
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">{e.hours ? `${parseFloat(e.hours).toFixed(2)}h` : "—"}</td>
                    <td className="p-2.5 text-right">${parseFloat(e.amount).toFixed(2)}</td>
                    <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">—</td>
                  </tr>
                ))}
                {(stub.earnings || []).length === 0 && (
                  <tr><td colSpan={4} className="p-3 text-center text-xs text-muted-foreground">No earnings</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="p-2.5 font-semibold text-xs" colSpan={2}>Gross Pay</td>
                  <td className="p-2.5 text-right font-bold" data-testid="text-emp-gross">${fmt(stub.grossPay)}</td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Deductions */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Deductions</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2.5 text-xs text-muted-foreground font-semibold">Description</th>
                  <th className="text-right p-2.5 text-xs text-muted-foreground font-semibold">Amount</th>
                  <th className="text-right p-2.5 text-xs text-muted-foreground font-semibold hidden sm:table-cell">YTD</th>
                </tr>
              </thead>
              <tbody>
                {(stub.deductions || []).map((d: any, i: number) => (
                  <tr key={d.id || i} className="border-t" data-testid={`row-emp-deduction-${i}`}>
                    <td className="p-2.5">
                      <div className="font-medium">{d.description}</div>
                      <div className="text-[10px] text-muted-foreground">{typeLabel(d.type)}</div>
                    </td>
                    <td className="p-2.5 text-right text-red-600 dark:text-red-400">−${parseFloat(d.amount).toFixed(2)}</td>
                    <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">—</td>
                  </tr>
                ))}
                {(stub.deductions || []).length === 0 && (
                  <tr><td colSpan={3} className="p-3 text-center text-xs text-muted-foreground">No deductions</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="p-2.5 font-semibold text-xs">Total Deductions</td>
                  <td className="p-2.5 text-right font-bold text-red-600 dark:text-red-400" data-testid="text-emp-deductions">−${fmt(stub.totalDeductions)}</td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Net Pay */}
        <div className="rounded-lg border p-4 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <span className="font-bold text-base">Net Pay</span>
            <span className="font-bold text-2xl text-emerald-700 dark:text-emerald-400" data-testid="text-emp-net">${fmt(stub.netPay)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">Pay Stub ID: {stub.id.substring(0,8).toUpperCase()}</p>
      </div>
    </div>
  );
}

// ─── Main Employee Pay Stubs Page ─────────────────────────────────────────────
export default function EmployeePayStubs() {
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedStub, setSelectedStub] = useState<any>(null);

  const { data: stubs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/employee/pay-stubs"] });

  const years = useMemo(() => {
    const ys = new Set(stubs.map(s => getYear(s.periodStart)).filter(Boolean));
    return Array.from(ys).sort().reverse();
  }, [stubs]);

  const filtered = useMemo(() => {
    if (yearFilter === "all") return stubs;
    return stubs.filter(s => getYear(s.periodStart) === yearFilter);
  }, [stubs, yearFilter]);

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Link href="/employee/profile">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-profile">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-none" data-testid="text-pay-stubs-title">My Pay Stubs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Official payroll records from your employer</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Year filter */}
        {years.length > 1 && (
          <div className="flex items-center gap-2">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-year-filter">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{filtered.length} pay stub{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="font-semibold text-muted-foreground">No pay stubs yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {stubs.length === 0
                ? "Your pay stubs will appear here once your employer processes and confirms your payroll."
                : "No pay stubs found for the selected year."}
            </p>
          </div>
        )}

        {/* Pay stub list */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(stub => (
              <div
                key={stub.id}
                className="bg-card border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-all active:scale-[0.99]"
                onClick={() => setSelectedStub(stub)}
                data-testid={`card-emp-stub-${stub.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">{fmtDate(stub.periodStart)} – {fmtDate(stub.periodEnd)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                        Paid
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Pay date: {fmtDate(stub.payDate || "")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{parseFloat(stub.totalHours || "0").toFixed(1)} hours</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid={`text-emp-net-${stub.id}`}>${fmt(stub.netPay)}</p>
                    <p className="text-xs text-muted-foreground">net pay</p>
                    <p className="text-xs text-muted-foreground">${fmt(stub.grossPay)} gross</p>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tap to view details</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); setSelectedStub(stub); }} data-testid={`button-view-stub-${stub.id}`}>
                    <Download className="w-3 h-3" />View & Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* YTD summary card at bottom */}
        {!isLoading && filtered.length > 0 && (
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">
                  {yearFilter === "all" ? "All-time Total" : `${yearFilter} Total`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-ytd-net">
                    ${filtered.reduce((s, stub) => s + parseFloat(stub.netPay || "0"), 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Pay</p>
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-ytd-gross">
                    ${filtered.reduce((s, stub) => s + parseFloat(stub.grossPay || "0"), 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gross Pay</p>
                </div>
                <div>
                  <p className="text-lg font-bold" data-testid="text-ytd-deductions">
                    ${filtered.reduce((s, stub) => s + parseFloat(stub.totalDeductions || "0"), 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deductions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="pb-4" />
      </div>

      {/* Pay stub detail sheet */}
      <Sheet open={!!selectedStub} onOpenChange={open => { if (!open) setSelectedStub(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b shrink-0">
            <SheetTitle className="text-base">
              Pay Stub Details
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {selectedStub && `${fmtDate(selectedStub.periodStart)} – ${fmtDate(selectedStub.periodEnd)}`}
              </span>
            </SheetTitle>
          </SheetHeader>
          {selectedStub && <PayStubDetail stub={selectedStub} onClose={() => setSelectedStub(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
