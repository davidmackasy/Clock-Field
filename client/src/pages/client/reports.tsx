import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportSignaturePad, type SigCapture } from "@/components/report-signature-pad";
import {
  FileText, Plus, CheckCircle2, PenLine, ChevronRight, Send as SendIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompanyLongDate } from "@/lib/timezone";

const REPORT_TYPES = [
  { value: "complaint", label: "Complaint" },
  { value: "issue", label: "Issue Report" },
  { value: "damage", label: "Damage Report" },
  { value: "general", label: "General Report" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  sent: "bg-indigo-100 text-indigo-700",
  viewed: "bg-cyan-100 text-cyan-700",
  awaiting_client: "bg-orange-100 text-orange-700",
  awaiting_signature: "bg-amber-100 text-amber-700",
  in_review: "bg-purple-100 text-purple-700",
  finalized: "bg-green-100 text-green-700",
  archived: "bg-slate-100 text-slate-600",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}
function reportId(id: string) { return `RPT-${id.slice(0, 8).toUpperCase()}`; }

// ─── Submit Report Dialog ─────────────────────────────────────────────────────
function SubmitReportDialog({ open, onClose }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    reportType: "issue", title: "", summary: "",
    incidentDate: "", incidentTime: "", clientComments: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const report = await apiRequest("POST", "/api/reports", data);
      if (report?.id) {
        await apiRequest("POST", `/api/reports/${report.id}/submit`, {});
      }
      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report submitted to admin" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (f: string, v: any) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Submit Report to Admin
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Report Type</Label>
            <Select value={form.reportType} onValueChange={v => set("reportType", v)}>
              <SelectTrigger data-testid="select-report-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              data-testid="input-report-title"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Brief description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" data-testid="input-date" value={form.incidentDate} onChange={e => set("incidentDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" data-testid="input-time" value={form.incidentTime} onChange={e => set("incidentTime", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              data-testid="input-summary"
              value={form.summary}
              onChange={e => set("summary", e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Additional Comments</Label>
            <Textarea
              data-testid="input-comments"
              value={form.clientComments}
              onChange={e => set("clientComments", e.target.value)}
              placeholder="Any additional context..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">Cancel</Button>
          <Button
            onClick={() => createMut.mutate({ ...form, status: "draft", createdByRole: "client" })}
            disabled={!form.title || !form.summary || createMut.isPending}
            data-testid="button-submit"
          >
            <SendIcon className="w-4 h-4 mr-1.5" />Submit to Admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report View Dialog ────────────────────────────────────────────────────────
function ReportViewDialog({ reportId: rptId, open, onClose }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [sigForm, setSigForm] = useState({ name: "", ack: false });
  const [sigCapture, setSigCapture] = useState<SigCapture>({ signatureType: "typed", signatureDataUrl: null });
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const timezone = timezoneData?.timezone || "UTC";
  const [comments, setComments] = useState("");

  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["/api/reports", rptId],
    queryFn: () => fetch(`/api/reports/${rptId}`).then(r => r.json()),
    enabled: !!rptId && open,
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/reports/${rptId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Comments saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const signMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/reports/${rptId}/sign`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reports", rptId] }); toast({ title: "Report signed" }); setSigForm({ name: "", ack: false }); setSigCapture({ signatureType: "typed", signatureDataUrl: null }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rpt = report;
  const mySignature = rpt?.signatures?.find((s: any) => s.signerUserId === user?.id);
  const canSign = rpt && !mySignature && rpt.requiresClientSignature;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : rpt ? (
          <>
            <DialogHeader>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", STATUS_COLORS[rpt.status] || "bg-gray-100 text-gray-600")}>
                    {statusLabel(rpt.status)}
                  </span>
                  {rpt.createdByRole === "admin" && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">From Admin</span>}
                </div>
                <DialogTitle className="text-base">{rpt.title}</DialogTitle>
                <p className="text-xs text-muted-foreground">{reportId(rpt.id)}</p>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Details */}
              <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Report Details</p>
                {rpt.incidentDate && <p className="text-sm"><span className="text-muted-foreground">Date:</span> {rpt.incidentDate}</p>}
                {rpt.summary && <p className="text-sm mt-1 whitespace-pre-wrap">{rpt.summary}</p>}
              </div>

              {/* Immediate action admin took */}
              {rpt.immediateAction && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Action Taken</p>
                  <p className="text-sm">{rpt.immediateAction}</p>
                </div>
              )}

              {/* Corrective action (if visible) */}
              {rpt.status === "finalized" && rpt.correctiveAction && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Corrective Action</p>
                  <p className="text-sm">{rpt.correctiveAction}</p>
                </div>
              )}

              {/* Client comments */}
              {rpt.status !== "finalized" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Your Comments</Label>
                  <Textarea
                    data-testid="input-comments"
                    defaultValue={rpt.clientComments || ""}
                    onChange={e => setComments(e.target.value)}
                    placeholder="Add your comments..."
                    rows={3}
                  />
                  <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ clientComments: comments || rpt.clientComments })} disabled={updateMut.isPending} data-testid="button-save-comments">
                    Save Comments
                  </Button>
                </div>
              )}
              {rpt.clientComments && rpt.status === "finalized" && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Your Comments</p>
                  <p className="text-sm">{rpt.clientComments}</p>
                </div>
              )}

              {/* Signatures */}
              {rpt.signatures?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Signatures</p>
                  {rpt.signatures.map((sig: any) => (
                    <div key={sig.id} className="rounded-md bg-green-50 border border-green-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-medium">{sig.signerName}</span>
                        <span className="text-xs text-muted-foreground capitalize ml-auto">{sig.signerRole} · {sig.signedAt ? formatCompanyLongDate(sig.signedAt, timezone) : ""}</span>
                      </div>
                      {sig.signatureType === "drawn" && sig.signatureDataUrl ? (
                        <div className="mx-3 mb-2 rounded bg-white border border-green-100 p-2">
                          <img src={sig.signatureDataUrl} alt="Signature" className="h-10 w-auto max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="mx-3 mb-2 rounded bg-white border border-green-100 px-3 py-0.5">
                          <p className="text-xl text-foreground leading-tight" style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 600 }}>
                            {sig.signerName}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sign form */}
              {canSign && (
                <div className="rounded-md border p-4 space-y-3 bg-amber-50 border-amber-200">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-amber-600" />
                    Your acknowledgement is required
                  </p>
                  <ReportSignaturePad
                    name={sigForm.name}
                    onChangeName={n => setSigForm(f => ({ ...f, name: n }))}
                    onChange={v => setSigCapture(prev => ({ ...prev, ...v }))}
                    namePlaceholder="Type your full name..."
                  />
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={sigForm.ack} onCheckedChange={v => setSigForm(f => ({ ...f, ack: !!v }))} data-testid="check-acknowledge" />
                    <span>I acknowledge that I have read and reviewed this report.</span>
                  </label>
                  <Button
                    size="sm"
                    disabled={
                      !sigForm.name || !sigForm.ack || signMut.isPending ||
                      (sigCapture.signatureType === "drawn" && !sigCapture.signatureDataUrl)
                    }
                    onClick={() => signMut.mutate({
                      signerName: sigForm.name,
                      signatureType: sigCapture.signatureType,
                      signatureDataUrl: sigCapture.signatureDataUrl,
                      acknowledgementText: "I acknowledge that I have read and reviewed this report.",
                    })}
                    data-testid="button-sign"
                  >
                    <PenLine className="w-3.5 h-3.5 mr-1.5" />Sign
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-center py-8 text-muted-foreground">Report not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Client Reports Page ─────────────────────────────────────────────────
export default function ClientReports() {
  const [location] = useLocation();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("all");

  const { data: reports = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/reports"] });
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const timezone = timezoneData?.timezone || "UTC";

  const received = reports.filter(r => r.sentToClient && r.createdByRole === "admin");
  const submitted = reports.filter(r => r.createdByRole === "client");
  const needsAction = reports.filter(r => r.requiresClientSignature && !["finalized", "archived"].includes(r.status) && r.sentToClient);

  const filtered = tab === "received" ? received
    : tab === "submitted" ? submitted
    : tab === "needs_action" ? needsAction
    : reports;

  return (
    <div className="flex-1 overflow-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">Reports</h1>
          <p className="text-xs text-muted-foreground">View and submit reports</p>
        </div>
        <Button size="sm" onClick={() => setSubmitOpen(true)} data-testid="button-submit-report">
          <Plus className="w-4 h-4 mr-1.5" />Submit
        </Button>
      </div>

      {/* Section nav */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg w-fit">
          <Link href="/client/reports">
            <button data-testid="nav-section-reports" className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${location === "/client/reports" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Reports
            </button>
          </Link>
          <Link href="/client/requests">
            <button data-testid="nav-section-requests" className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${location.startsWith("/client/requests") ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Requests
            </button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1 text-xs" data-testid="tab-all">All ({reports.length})</TabsTrigger>
            <TabsTrigger value="received" className="flex-1 text-xs" data-testid="tab-received">
              Received {received.length > 0 && <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1 rounded-full">{received.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="submitted" className="flex-1 text-xs" data-testid="tab-submitted">Submitted ({submitted.length})</TabsTrigger>
            <TabsTrigger value="needs_action" className="flex-1 text-xs" data-testid="tab-needs-action">
              Action {needsAction.length > 0 && <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1 rounded-full">{needsAction.length}</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <FileText className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No reports yet</p>
            <p className="text-xs mt-1">Use the submit button to report an issue to admin</p>
          </div>
        ) : (
          filtered.map(r => (
            <div
              key={r.id}
              className="border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedId(r.id)}
              data-testid={`card-report-${r.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600")}>
                      {statusLabel(r.status)}
                    </span>
                    {r.createdByRole === "admin" && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">From Admin</span>}
                    {r.requiresClientSignature && !["finalized", "archived"].includes(r.status) && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center gap-1"><PenLine className="w-2.5 h-2.5" />Sign required</span>
                    )}
                  </div>
                  <p className="font-medium text-sm leading-snug truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.reportType?.replace(/_/g, " ")} · {r.createdAt ? formatCompanyLongDate(r.createdAt, timezone) : "—"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </div>
          ))
        )}
      </div>

      {submitOpen && <SubmitReportDialog open={submitOpen} onClose={() => setSubmitOpen(false)} />}
      {selectedId && <ReportViewDialog reportId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
