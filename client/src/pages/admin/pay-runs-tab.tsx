import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Calendar, ChevronRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  under_review: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  under_review: "Under Review",
  paid: "Paid",
  closed: "Closed",
};

interface PayRunFormData {
  name: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  notes: string;
}

const defaultForm: PayRunFormData = {
  name: "",
  periodStart: "",
  periodEnd: "",
  payDate: "",
  status: "draft",
  notes: "",
};

interface Props {
  onSelectPayRun?: (run: any) => void;
}

export default function PayRunsTab({ onSelectPayRun }: Props) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<PayRunFormData>(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: payRuns = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/payroll/pay-runs"] });

  const createMutation = useMutation({
    mutationFn: (data: PayRunFormData) => apiRequest("POST", "/api/payroll/pay-runs", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-runs"] }); setShowForm(false); setForm(defaultForm); toast({ title: "Pay run created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: PayRunFormData) => apiRequest("PATCH", `/api/payroll/pay-runs/${editing.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-runs"] }); setShowForm(false); setEditing(null); setForm(defaultForm); toast({ title: "Pay run updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payroll/pay-runs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/payroll/pay-runs"] }); setDeleteTarget(null); toast({ title: "Pay run deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    const today = new Date().toISOString().split("T")[0];
    setForm({ ...defaultForm, periodStart: today, periodEnd: today, payDate: today });
    setShowForm(true);
  }

  function openEdit(run: any) {
    setEditing(run);
    setForm({
      name: run.name || "",
      periodStart: run.periodStart || "",
      periodEnd: run.periodEnd || "",
      payDate: run.payDate || "",
      status: run.status || "draft",
      notes: run.notes || "",
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name || !form.periodStart || !form.periodEnd || !form.payDate) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (editing) updateMutation.mutate(form);
    else createMutation.mutate(form);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pay Runs</h2>
          <p className="text-sm text-muted-foreground">Manage payroll periods and batches</p>
        </div>
        <Button onClick={openCreate} size="sm" data-testid="button-create-pay-run">
          <Plus className="w-4 h-4 mr-1" />New Pay Run
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : payRuns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
            <p className="font-medium text-muted-foreground">No pay runs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a pay run to start generating pay stubs for employees.</p>
            <Button className="mt-4" onClick={openCreate} size="sm" data-testid="button-create-pay-run-empty">
              <Plus className="w-4 h-4 mr-1" />Create First Pay Run
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payRuns.map(run => (
            <div
              key={run.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
              data-testid={`card-pay-run-${run.id}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate" data-testid={`text-run-name-${run.id}`}>{run.name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${STATUS_COLORS[run.status] || ""}`}>
                      {STATUS_LABELS[run.status] || run.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)} &bull; Pay date: {fmtDate(run.payDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onSelectPayRun && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 hidden sm:flex" onClick={() => onSelectPayRun(run)} data-testid={`button-view-stubs-${run.id}`}>
                    Pay Stubs<ChevronRight className="w-3 h-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(run)} data-testid={`button-edit-run-${run.id}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {run.status === "draft" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(run)} data-testid={`button-delete-run-${run.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditing(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pay Run" : "Create Pay Run"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="pr-name">Name <span className="text-destructive">*</span></Label>
              <Input id="pr-name" placeholder="e.g. Biweekly Mar 1–14" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-run-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pr-start">Period Start <span className="text-destructive">*</span></Label>
                <Input id="pr-start" type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} data-testid="input-run-period-start" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pr-end">Period End <span className="text-destructive">*</span></Label>
                <Input id="pr-end" type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} data-testid="input-run-period-end" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-paydate">Pay Date <span className="text-destructive">*</span></Label>
              <Input id="pr-paydate" type="date" value={form.payDate} onChange={e => setForm(f => ({ ...f, payDate: e.target.value }))} data-testid="input-run-pay-date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-status">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger id="pr-status" data-testid="select-run-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-notes">Notes</Label>
              <Textarea id="pr-notes" placeholder="Optional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="resize-none" rows={2} data-testid="textarea-run-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); setForm(defaultForm); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-pay-run">
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Pay Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pay Run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. Any pay stubs inside it must be deleted separately first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(deleteTarget.id)} data-testid="button-confirm-delete-run">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
