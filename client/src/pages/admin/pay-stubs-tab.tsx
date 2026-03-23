import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Trash2, Printer, CheckCircle2, XCircle,
  Lock, Eye, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";

function fmt(n: number | string) { return parseFloat(n as string || "0").toFixed(2); }
function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDatetime(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300" },
  reviewed: { label: "Reviewed", color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300" },
  finalized: { label: "Finalized", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
  confirmed_paid: { label: "Confirmed Paid", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
  published: { label: "Published", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
  voided: { label: "Voided", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" },
};

const EARNING_TYPES = ["regular", "overtime", "holiday", "vacation", "sick", "bonus", "reimbursement", "commission", "adjustment", "other"];
const DEDUCTION_TYPES = ["tax", "provincial_tax", "cpp", "ei", "medical", "dental", "union", "retirement", "garnishment", "loan", "adjustment", "other"];

function typeLabel(t: string) { return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

// ─── Print helper ─────────────────────────────────────────────────────────────
function buildCompanyAddressLines(stub: any): string {
  const ca = stub.companyAddress || {};
  const lines: string[] = [];
  if (ca.address) lines.push(ca.address);
  const cityProvPostal = [ca.city, ca.province, ca.postalCode].filter(Boolean).join(", ");
  if (cityProvPostal) lines.push(cityProvPostal);
  if (ca.companyPhone) lines.push(ca.companyPhone);
  if (ca.companyEmail) lines.push(ca.companyEmail);
  return lines.join("<br>");
}

function printPayStub(stub: any, payRun: any) {
  const ytdLabel = `YTD ${stub.ytdYear || new Date().getFullYear()}`;
  const ytdE = stub.ytdEarningsByType || {};
  const ytdD = stub.ytdDeductionsByType || {};

  // 5-column earnings rows (desc | hours | rate | amount | ytd)
  const earningsRows = (stub.earnings || []).map((e: any) => `
    <tr>
      <td>${e.description}</td>
      <td style="text-align:right">${e.hours ? parseFloat(e.hours).toFixed(2) : "—"}</td>
      <td style="text-align:right">${e.rate ? "$" + parseFloat(e.rate).toFixed(2) : "—"}</td>
      <td style="text-align:right">$${parseFloat(e.amount||"0").toFixed(2)}</td>
      <td style="text-align:right">$${(ytdE[e.description] ?? parseFloat(e.amount||"0")).toFixed(2)}</td>
    </tr>`).join("");

  // 5-column deduction rows (desc | blank | blank | amount | ytd)
  const deductionRows = (stub.deductions || []).map((d: any) => `
    <tr>
      <td>${d.description}</td>
      <td></td>
      <td></td>
      <td style="text-align:right">$${parseFloat(d.amount||"0").toFixed(2)}</td>
      <td style="text-align:right">$${(ytdD[d.description] ?? parseFloat(d.amount||"0")).toFixed(2)}</td>
    </tr>`).join("");

  const displayId = stub.displayPaystubId || `PS-${stub.id.substring(0,8).toUpperCase()}`;
  const companyAddrHtml = buildCompanyAddressLines(stub);
  const payDate = stub.payDate || payRun?.payDate || "";

  const html = `<!DOCTYPE html><html><head><title>Pay Stub — ${displayId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px 28px; max-width: 780px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #111; margin-bottom: 18px; }
    .header-left h1 { font-size: 20px; font-weight: 700; }
    .header-right { text-align: right; }
    .header-right .label { font-size: 15px; font-weight: 700; letter-spacing: 1px; }
    .header-right .id { font-size: 10px; color: #555; margin-top: 3px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 16px; gap: 20px; }
    .info-block { flex: 1; }
    .info-block .block-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .info-block .block-name { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
    .info-block .block-detail { font-size: 11px; color: #444; line-height: 1.6; }
    .info-block.right { text-align: right; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f7f7f7; border: 1px solid #e5e5e5; border-radius: 4px; padding: 10px 14px; margin-bottom: 18px; }
    .meta-item .meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #777; margin-bottom: 3px; }
    .meta-item .meta-val { font-size: 12px; font-weight: 600; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #444; background: #f0f0f0; padding: 5px 8px; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; margin-bottom: 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    th { padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; background: #fafafa; border-bottom: 1px solid #ddd; }
    th:not(:first-child) { text-align: right; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: middle; }
    td:not(:first-child) { text-align: right; }
    .totals-row td { font-weight: 700; background: #f5f5f5; border-top: 1px solid #ccc; }
    .section-gap { height: 14px; }
    .takehome-row { display: flex; justify-content: flex-end; align-items: baseline; gap: 24px; border-top: 2px solid #111; margin-top: 14px; padding-top: 10px; }
    .takehome-label { font-size: 14px; font-weight: 700; }
    .takehome-amount { font-size: 22px; font-weight: 700; color: #166534; }
    .footer { font-size: 9px; color: #999; margin-top: 24px; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
    @media print { body { padding: 12px; } .footer { position: fixed; bottom: 0; left: 0; right: 0; } }
  </style></head><body>
  <div class="header">
    <div class="header-left"><h1>${stub.companyNameSnapshot || "Company"}</h1></div>
    <div class="header-right">
      <div class="label">PAY STUB</div>
      <div class="id">ID: ${displayId}</div>
    </div>
  </div>

  <div class="info-row">
    <div class="info-block">
      <div class="block-label">Employer</div>
      <div class="block-name">${stub.companyNameSnapshot || ""}</div>
      <div class="block-detail">${companyAddrHtml || ""}</div>
    </div>
    <div class="info-block right">
      <div class="block-label">Employee</div>
      <div class="block-name">${stub.employeeNameSnapshot || ""}</div>
      <div class="block-detail">${stub.employeeIdSnapshot ? "ID: " + stub.employeeIdSnapshot : ""}${stub.employeePositionSnapshot ? "<br>" + stub.employeePositionSnapshot : ""}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><div class="meta-label">Pay Period</div><div class="meta-val">${fmtDate(stub.periodStart)} – ${fmtDate(stub.periodEnd)}</div></div>
    <div class="meta-item"><div class="meta-label">Pay Date</div><div class="meta-val">${fmtDate(payDate)}</div></div>
    <div class="meta-item"><div class="meta-label">Pay Rate</div><div class="meta-val">$${parseFloat(stub.employeeRateSnapshot||"0").toFixed(2)}/hr</div></div>
    <div class="meta-item"><div class="meta-label">Pay Type</div><div class="meta-val">${typeLabel(stub.employeePayTypeSnapshot || "hourly")}</div></div>
  </div>

  <div class="section-title">Earnings</div>
  <table>
    <thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th><th>${ytdLabel}</th></tr></thead>
    <tbody>${earningsRows || '<tr><td colspan="5" style="text-align:center;color:#999">No earnings</td></tr>'}</tbody>
    <tfoot><tr class="totals-row"><td colspan="3">Gross Pay</td><td>$${fmt(stub.grossPay)}</td><td>$${Object.values(ytdE as Record<string,number>).reduce((a:number,b:number)=>a+b,0).toFixed(2) || fmt(stub.grossPay)}</td></tr></tfoot>
  </table>

  <div class="section-gap"></div>
  <div class="section-title">Deductions</div>
  <table>
    <thead><tr><th>Description</th><th></th><th></th><th>Amount</th><th>${ytdLabel}</th></tr></thead>
    <tbody>${deductionRows || '<tr><td colspan="5" style="text-align:center;color:#999">No deductions</td></tr>'}</tbody>
    <tfoot><tr class="totals-row"><td colspan="3">Total Deductions</td><td>$${fmt(stub.totalDeductions)}</td><td>$${Object.values(ytdD as Record<string,number>).reduce((a:number,b:number)=>a+b,0).toFixed(2) || fmt(stub.totalDeductions)}</td></tr></tfoot>
  </table>

  <div class="takehome-row">
    <div class="takehome-label">Take-Home Pay</div>
    <div class="takehome-amount">$${fmt(stub.netPay)}</div>
  </div>

  <div class="footer">${displayId} &bull; Generated by Clockfield</div>
  </body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
}

// ─── Pay Stub Editor ──────────────────────────────────────────────────────────
function PayStubEditor({ stub: initialStub, payRun, onClose }: { stub: any; payRun: any; onClose: () => void }) {
  const { toast } = useToast();
  const [voidReason, setVoidReason] = useState("");
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showConfirmPaidDialog, setShowConfirmPaidDialog] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [newEarning, setNewEarning] = useState({ type: "bonus", description: "", hours: "", rate: "", amount: "" });
  const [newDeduction, setNewDeduction] = useState({ type: "other", description: "", amount: "" });
  const [addEarning, setAddEarning] = useState(false);
  const [addDeduction, setAddDeduction] = useState(false);
  const [adminNotes, setAdminNotes] = useState(initialStub.adminNotes || "");

  const { data: stub, isLoading } = useQuery<any>({
    queryKey: ["/api/payroll/pay-stubs", initialStub.id],
    queryFn: () => fetch(`/api/payroll/pay-stubs/${initialStub.id}`, { credentials: "include" }).then(r => r.json()),
    initialData: initialStub,
  });

  const isEditable = ["draft", "reviewed"].includes(stub?.status);
  const isLocked = !isEditable;

  const recalcMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/payroll/pay-stubs/${stub.id}/recalculate`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs"] }); toast({ title: "Totals recalculated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/payroll/pay-stubs/${stub.id}/finalize`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs"] }); toast({ title: "Pay stub finalized" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const confirmPaidMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/payroll/pay-stubs/${stub.id}/confirm-paid`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs"] }); setShowConfirmPaidDialog(false); toast({ title: "Marked as paid — now visible to employee" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const voidMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/payroll/pay-stubs/${stub.id}/void`, { reason: voidReason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs"] }); setShowVoidDialog(false); toast({ title: "Pay stub voided" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveNotesMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/payroll/pay-stubs/${stub.id}`, { adminNotes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); toast({ title: "Notes saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addEarningMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/payroll/pay-stubs/${stub.id}/earnings`, { ...data, displayOrder: (stub.earnings?.length || 0) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); setAddEarning(false); setNewEarning({ type: "bonus", description: "", hours: "", rate: "", amount: "" }); toast({ title: "Earning added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteEarningMutation = useMutation({
    mutationFn: (earningId: string) => apiRequest("DELETE", `/api/payroll/pay-stubs/${stub.id}/earnings/${earningId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); toast({ title: "Earning removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addDeductionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/payroll/pay-stubs/${stub.id}/deductions`, { ...data, displayOrder: (stub.deductions?.length || 0) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); setAddDeduction(false); setNewDeduction({ type: "other", description: "", amount: "" }); toast({ title: "Deduction added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDeductionMutation = useMutation({
    mutationFn: (deductionId: string) => apiRequest("DELETE", `/api/payroll/pay-stubs/${stub.id}/deductions/${deductionId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs", stub.id] }); toast({ title: "Deduction removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !stub) return <div className="p-6 text-center text-muted-foreground">Loading…</div>;

  const cfg = STATUS_CONFIG[stub.status] || STATUS_CONFIG.draft;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
          {isLocked && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="w-3 h-3" />Locked</span>}
          {stub.employeeVisibleAt && <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Eye className="w-3 h-3" />Visible to employee</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isEditable && (
            <>
              <Button size="sm" variant="outline" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending} data-testid="button-recalculate">
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Recalculate
              </Button>
              <Button size="sm" variant="outline" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending} data-testid="button-finalize">
                <Lock className="w-3.5 h-3.5 mr-1" />Finalize
              </Button>
            </>
          )}
          {stub.status !== "voided" && stub.status !== "confirmed_paid" && stub.status !== "published" && (
            <Button size="sm" onClick={() => setShowConfirmPaidDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-confirm-paid">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Confirm Paid
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => printPayStub(stub, payRun)} data-testid="button-print-stub">
            <Printer className="w-3.5 h-3.5 mr-1" />Print / PDF
          </Button>
          {stub.status !== "voided" && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setShowVoidDialog(true)} data-testid="button-void-stub">
              <XCircle className="w-3.5 h-3.5 mr-1" />Void
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* Locked warning */}
        {isLocked && stub.status !== "voided" && (
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <Lock className="w-4 h-4 shrink-0" />
            <span>This pay stub is <strong>{cfg.label}</strong>. Edit line items is disabled. Use the Void action if a correction is needed.</span>
          </div>
        )}
        {stub.status === "voided" && (
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>This pay stub has been <strong>voided</strong> on {fmtDatetime(stub.voidedAt)}.</span>
          </div>
        )}

        {/* Employee + Company summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border">
            <CardHeader className="p-3 pb-1"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</CardTitle></CardHeader>
            <CardContent className="p-3 pt-1 space-y-0.5 text-sm">
              <p className="font-semibold" data-testid="text-stub-employee-name">{stub.employeeNameSnapshot || "—"}</p>
              {stub.employeeIdSnapshot && <p className="text-muted-foreground text-xs">ID: {stub.employeeIdSnapshot}</p>}
              {stub.employeePositionSnapshot && <p className="text-muted-foreground text-xs capitalize">{stub.employeePositionSnapshot}</p>}
              <p className="text-muted-foreground text-xs">Rate: ${parseFloat(stub.employeeRateSnapshot || "0").toFixed(2)}/hr &bull; {typeLabel(stub.employeePayTypeSnapshot || "hourly")}</p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="p-3 pb-1"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay Period</CardTitle></CardHeader>
            <CardContent className="p-3 pt-1 space-y-0.5 text-sm">
              <p className="font-semibold">{fmtDate(stub.periodStart)} – {fmtDate(stub.periodEnd)}</p>
              <p className="text-muted-foreground text-xs">Pay Date: {fmtDate(stub.payDate || payRun?.payDate || "")}</p>
              {stub.timesheetId && <p className="text-muted-foreground text-xs">Source: Approved Timesheet</p>}
              <p className="text-muted-foreground text-xs">{parseFloat(stub.totalHours || "0").toFixed(2)} total hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Earnings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Earnings</h3>
            {isEditable && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddEarning(v => !v)} data-testid="button-add-earning">
                <Plus className="w-3 h-3 mr-1" />Add Line
              </Button>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Hours</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Rate</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
                  {isEditable && <th className="w-8 p-2.5" />}
                </tr>
              </thead>
              <tbody>
                {(stub.earnings || []).map((e: any, i: number) => (
                  <tr key={e.id} className="border-t" data-testid={`row-earning-${i}`}>
                    <td className="p-2.5">
                      <div className="font-medium">{e.description}</div>
                      <div className="text-[10px] text-muted-foreground">{typeLabel(e.type)}</div>
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">{e.hours ? `${parseFloat(e.hours).toFixed(2)}h` : "—"}</td>
                    <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">{e.rate ? `$${parseFloat(e.rate).toFixed(2)}` : "—"}</td>
                    <td className="p-2.5 text-right font-medium">${parseFloat(e.amount).toFixed(2)}</td>
                    {isEditable && (
                      <td className="p-2.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteEarningMutation.mutate(e.id)} data-testid={`button-delete-earning-${i}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {(stub.earnings || []).length === 0 && (
                  <tr><td colSpan={5} className="p-3 text-center text-xs text-muted-foreground">No earning lines</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="p-2.5 font-semibold text-xs uppercase tracking-wide" colSpan={3}>Gross Pay</td>
                  <td className="p-2.5 text-right font-bold" data-testid="text-gross-pay">${fmt(stub.grossPay)}</td>
                  {isEditable && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add earning form */}
          {addEarning && (
            <div className="mt-2 p-3 border rounded-lg bg-muted/20 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Add Earning Line</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={newEarning.type} onValueChange={v => setNewEarning(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-earning-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{EARNING_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description *</Label>
                  <Input className="h-8 text-xs" value={newEarning.description} onChange={e => setNewEarning(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Bonus" data-testid="input-earning-desc" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hours (optional)</Label>
                  <Input className="h-8 text-xs" type="number" step="0.01" value={newEarning.hours} onChange={e => setNewEarning(f => ({ ...f, hours: e.target.value }))} placeholder="0.00" data-testid="input-earning-hours" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rate (optional)</Label>
                  <Input className="h-8 text-xs" type="number" step="0.01" value={newEarning.rate} onChange={e => setNewEarning(f => ({ ...f, rate: e.target.value }))} placeholder="0.00" data-testid="input-earning-rate" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Amount * ($)</Label>
                  <Input className="h-8 text-xs" type="number" step="0.01" value={newEarning.amount} onChange={e => setNewEarning(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" data-testid="input-earning-amount" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  if (!newEarning.description || !newEarning.amount) { toast({ title: "Description and amount required", variant: "destructive" }); return; }
                  addEarningMutation.mutate(newEarning);
                }} disabled={addEarningMutation.isPending} data-testid="button-save-earning">
                  Add
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddEarning(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Deductions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Deductions</h3>
            {isEditable && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddDeduction(v => !v)} data-testid="button-add-deduction">
                <Plus className="w-3 h-3 mr-1" />Add Line
              </Button>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
                  {isEditable && <th className="w-8 p-2.5" />}
                </tr>
              </thead>
              <tbody>
                {(stub.deductions || []).map((d: any, i: number) => (
                  <tr key={d.id} className="border-t" data-testid={`row-deduction-${i}`}>
                    <td className="p-2.5">
                      <div className="font-medium">{d.description}</div>
                      <div className="text-[10px] text-muted-foreground">{typeLabel(d.type)}</div>
                    </td>
                    <td className="p-2.5 text-right font-medium text-red-600 dark:text-red-400">−${parseFloat(d.amount).toFixed(2)}</td>
                    {isEditable && (
                      <td className="p-2.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteDeductionMutation.mutate(d.id)} data-testid={`button-delete-deduction-${i}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {(stub.deductions || []).length === 0 && (
                  <tr><td colSpan={3} className="p-3 text-center text-xs text-muted-foreground">No deductions</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="p-2.5 font-semibold text-xs uppercase tracking-wide">Total Deductions</td>
                  <td className="p-2.5 text-right font-bold text-red-600 dark:text-red-400" data-testid="text-total-deductions">−${fmt(stub.totalDeductions)}</td>
                  {isEditable && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add deduction form */}
          {addDeduction && (
            <div className="mt-2 p-3 border rounded-lg bg-muted/20 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Add Deduction Line</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={newDeduction.type} onValueChange={v => setNewDeduction(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-deduction-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{DEDUCTION_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description *</Label>
                  <Input className="h-8 text-xs" value={newDeduction.description} onChange={e => setNewDeduction(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Health Insurance" data-testid="input-deduction-desc" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Amount * ($)</Label>
                  <Input className="h-8 text-xs" type="number" step="0.01" value={newDeduction.amount} onChange={e => setNewDeduction(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" data-testid="input-deduction-amount" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  if (!newDeduction.description || !newDeduction.amount) { toast({ title: "Description and amount required", variant: "destructive" }); return; }
                  addDeductionMutation.mutate(newDeduction);
                }} disabled={addDeductionMutation.isPending} data-testid="button-save-deduction">Add</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddDeduction(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Net Pay summary */}
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Gross Pay</span>
            <span className="font-medium">${fmt(stub.grossPay)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Total Deductions</span>
            <span className="font-medium text-red-600 dark:text-red-400">−${fmt(stub.totalDeductions)}</span>
          </div>
          <Separator className="mb-2" />
          <div className="flex items-center justify-between">
            <span className="font-bold text-base">Net Pay</span>
            <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400" data-testid="text-net-pay">${fmt(stub.netPay)}</span>
          </div>
        </div>

        {/* Admin notes */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Admin Notes <span className="text-xs text-muted-foreground font-normal">(internal only)</span></Label>
          <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes not visible to employee…" className="resize-none" rows={2} data-testid="textarea-admin-notes" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveNotesMutation.mutate()} disabled={saveNotesMutation.isPending} data-testid="button-save-notes">
            Save Notes
          </Button>
        </div>

        {/* Audit log toggle */}
        <div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground -ml-1" onClick={() => setShowAuditLog(v => !v)} data-testid="button-toggle-audit">
            {showAuditLog ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}Audit Log ({(stub.auditLog || []).length})
          </Button>
          {showAuditLog && (
            <div className="mt-2 space-y-1.5">
              {(stub.auditLog || []).map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">{fmtDatetime(entry.createdAt)}</span>
                  <span className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground capitalize">by {entry.actorRole || "system"}</span>
                </div>
              ))}
              {(stub.auditLog || []).length === 0 && <p className="text-xs text-muted-foreground">No audit entries yet</p>}
            </div>
          )}
        </div>
      </div>

      {/* Void dialog */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" />Void Pay Stub?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the pay stub as voided. The employee will no longer see it. This action creates an audit record.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Label className="text-sm">Reason for voiding</Label>
            <Textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Explain why this pay stub is being voided…" className="mt-1.5 resize-none" rows={2} data-testid="textarea-void-reason" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => voidMutation.mutate()} data-testid="button-confirm-void">
              Void Pay Stub
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm paid dialog */}
      <AlertDialog open={showConfirmPaidDialog} onOpenChange={setShowConfirmPaidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" />Confirm Employee Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              This will finalize the pay stub (if not already finalized) and make it visible to <strong>{stub.employeeNameSnapshot}</strong> in their portal. They will be able to view and download it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => confirmPaidMutation.mutate()} data-testid="button-confirm-confirm-paid">
              Yes, Confirm Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Generate Pay Stub Dialog ─────────────────────────────────────────────────
function GenerateStubDialog({ open, onClose, payRuns, employees }: { open: boolean; onClose: () => void; payRuns: any[]; employees: any[] }) {
  const { toast } = useToast();
  const [payRunId, setPayRunId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [duplicateError, setDuplicateError] = useState<{ employeeName: string; payRunName: string } | null>(null);

  function clearDuplicate() { setDuplicateError(null); }

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/payroll/pay-stubs/generate", { payRunId, employeeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-stubs"] });
      toast({ title: "Pay stub draft generated" });
      onClose();
      setPayRunId(""); setEmployeeId(""); setDuplicateError(null);
    },
    onError: (e: any) => {
      const msg: string = e.message || "";
      const isDuplicate = msg.includes("already exists") || msg.includes("pay stub already");
      if (isDuplicate) {
        const emp = employees.find(emp => emp.id === employeeId);
        const run = payRuns.find(r => r.id === payRunId);
        setDuplicateError({
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "This employee",
          payRunName: run?.name || "the selected pay period",
        });
      } else {
        toast({ title: "Error generating pay stub", description: msg.replace(/^\d+:\s*/, "").replace(/[{}""]/g, "").replace("message:", "").trim(), variant: "destructive" });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={open2 => { if (!open2) { onClose(); setDuplicateError(null); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Generate Pay Stub</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Pay Run *</Label>
            <Select value={payRunId} onValueChange={v => { setPayRunId(v); clearDuplicate(); }}>
              <SelectTrigger data-testid="select-generate-pay-run"><SelectValue placeholder="Select pay run…" /></SelectTrigger>
              <SelectContent>
                {payRuns.filter(r => r.status !== "closed").map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Employee *</Label>
            <Select value={employeeId} onValueChange={v => { setEmployeeId(v); clearDuplicate(); }}>
              <SelectTrigger data-testid="select-generate-employee"><SelectValue placeholder="Select employee…" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duplicate pay stub inline alert */}
          {duplicateError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 flex gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pay stub already exists</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {duplicateError.employeeName} already has a pay stub for {duplicateError.payRunName}. Open the existing pay stub instead of generating a new one.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">The system will look for an approved timesheet for the selected pay run period. If none is found, it will fall back to raw time entries.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setDuplicateError(null); }}>Cancel</Button>
          <Button onClick={() => {
            if (!payRunId || !employeeId) { toast({ title: "Select a pay run and employee", variant: "destructive" }); return; }
            setDuplicateError(null);
            generateMutation.mutate();
          }} disabled={generateMutation.isPending} data-testid="button-generate-stub">
            {generateMutation.isPending ? "Generating…" : "Generate Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Pay Stubs Tab ───────────────────────────────────────────────────────
export default function PayStubsTab() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedStub, setSelectedStub] = useState<any>(null);
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayRun, setFilterPayRun] = useState("all");

  const { data: stubs = [], isLoading: stubsLoading } = useQuery<any[]>({ queryKey: ["/api/payroll/pay-stubs"] });
  const { data: payRuns = [] } = useQuery<any[]>({ queryKey: ["/api/payroll/pay-runs"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const filteredStubs = useMemo(() => {
    return stubs.filter(s => {
      if (filterEmployee !== "all" && s.employeeId !== filterEmployee) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterPayRun !== "all" && s.payRunId !== filterPayRun) return false;
      return true;
    });
  }, [stubs, filterEmployee, filterStatus, filterPayRun]);

  const selectedPayRun = useMemo(() => payRuns.find(r => r.id === selectedStub?.payRunId), [payRuns, selectedStub]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Pay Stubs</h2>
          <p className="text-sm text-muted-foreground">Generate, review, and publish employee pay stubs</p>
        </div>
        <Button onClick={() => setShowGenerate(true)} size="sm" data-testid="button-generate-stub-open">
          <Plus className="w-4 h-4 mr-1" />Generate Pay Stub
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-filter-employee"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPayRun} onValueChange={setFilterPayRun}>
          <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-filter-pay-run"><SelectValue placeholder="All Pay Runs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pay Runs</SelectItem>
            {payRuns.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-filter-status"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {stubsLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filteredStubs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
            <p className="font-medium text-muted-foreground">{stubs.length === 0 ? "No pay stubs yet" : "No pay stubs match your filters"}</p>
            {stubs.length === 0 && (
              <>
                <p className="text-sm text-muted-foreground mt-1">Create a pay run first, then generate pay stubs for your employees.</p>
                <Button className="mt-4" onClick={() => setShowGenerate(true)} size="sm" data-testid="button-generate-stub-empty">
                  <Plus className="w-4 h-4 mr-1" />Generate First Pay Stub
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredStubs.map(stub => {
            const cfg = STATUS_CONFIG[stub.status] || STATUS_CONFIG.draft;
            const run = payRuns.find(r => r.id === stub.payRunId);
            return (
              <div
                key={stub.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => setSelectedStub(stub)}
                data-testid={`card-pay-stub-${stub.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" data-testid={`text-stub-name-${stub.id}`}>{stub.employeeNameSnapshot || "Employee"}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${cfg.color}`}>{cfg.label}</Badge>
                    {stub.employeeVisibleAt && <Eye className="w-3 h-3 text-emerald-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(stub.periodStart)} – {fmtDate(stub.periodEnd)}
                    {run ? ` · ${run.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">${fmt(stub.netPay)}</p>
                  <p className="text-xs text-muted-foreground">net · ${fmt(stub.grossPay)} gross</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pay Stub Editor Sheet */}
      <Sheet open={!!selectedStub} onOpenChange={open => { if (!open) setSelectedStub(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b shrink-0">
            <SheetTitle className="text-base">
              Pay Stub — {selectedStub?.employeeNameSnapshot}
              <span className="text-xs font-normal text-muted-foreground ml-2">{fmtDate(selectedStub?.periodStart)} – {fmtDate(selectedStub?.periodEnd)}</span>
            </SheetTitle>
          </SheetHeader>
          {selectedStub && <PayStubEditor stub={selectedStub} payRun={selectedPayRun} onClose={() => setSelectedStub(null)} />}
        </SheetContent>
      </Sheet>

      {/* Generate dialog */}
      <GenerateStubDialog open={showGenerate} onClose={() => setShowGenerate(false)} payRuns={payRuns} employees={employees} />
    </div>
  );
}
