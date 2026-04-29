import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ChevronLeft, Save, Send, Copy, ExternalLink, CheckCircle2, XCircle, Eye,
  FileText, Clock, Loader2, Download, AlertCircle, FileSignature, Activity,
  Mail, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agreement, AgreementActivityLog } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Viewed", signed: "Signed",
  completed: "Completed", declined: "Declined",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  signed: "bg-green-100 text-green-700",
  completed: "bg-teal-100 text-teal-700",
  declined: "bg-red-100 text-red-700",
};
const EVENT_LABELS: Record<string, string> = {
  created: "Agreement created",
  sent_email: "Agreement sent via email",
  sent_link: "Link shared",
  viewed: "Agreement viewed by client",
  signed: "Agreement signed",
  declined: "Agreement declined",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

// ── Send Email Dialog ─────────────────────────────────────────────────────────
function SendEmailDialog({ agreement, open, onClose, publicUrl }: { agreement: Agreement; open: boolean; onClose: () => void; publicUrl: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState(`Agreement for Your Review — ${agreement.title}`);
  const [copied, setCopied] = useState(false);

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/agreements/${agreement.id}/send-email`, { subject }).then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agreements", agreement.id] });
      qc.invalidateQueries({ queryKey: ["/api/admin/agreements", agreement.id, "activity"] });
      if (data.success) {
        toast({ title: "Agreement sent successfully." });
      } else {
        toast({ title: "Email failed — agreement marked as sent. Copy the link to share manually.", variant: "destructive" });
      }
      onClose();
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" /> Send Agreement</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">{agreement.clientName || "Client"}</p>
            <p className="text-muted-foreground text-xs">{agreement.clientEmail || "No email on file"}</p>
          </div>
          {!agreement.clientEmail && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>No client email — the agreement will be marked as sent but no email will be delivered. Share the link manually.</span>
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Email Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} data-testid="input-email-subject" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Public Link</Label>
            <div className="flex gap-2">
              <Input value={publicUrl} readOnly className="text-xs" data-testid="input-public-url" />
              <Button variant="outline" size="sm" className="shrink-0" onClick={copyLink} data-testid="button-copy-link">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-send-email" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} className="gap-1.5">
            {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PDF Print View ─────────────────────────────────────────────────────────
function openPrintPreview(agreement: Agreement, businessName: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${agreement.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; font-size: 12pt; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22pt; margin-bottom: 6px; }
    .meta { font-size: 10pt; color: #555; margin-bottom: 32px; }
    .section { margin-bottom: 24px; white-space: pre-wrap; line-height: 1.7; }
    .sig-block { margin-top: 48px; border-top: 1px solid #ccc; padding-top: 24px; }
    .sig-row { display: flex; gap: 48px; margin-top: 16px; }
    .sig-field { flex: 1; }
    .sig-field label { font-size: 9pt; color: #555; display: block; margin-bottom: 4px; }
    .sig-field p { font-size: 11pt; font-weight: bold; }
    .sig-img { max-height: 80px; border-bottom: 1px solid #333; display: block; margin-bottom: 4px; }
    .terms { font-size: 9pt; color: #444; border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px; white-space: pre-wrap; line-height: 1.6; }
    .agreement-id { font-size: 8pt; color: #999; margin-top: 16px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${agreement.title}</h1>
  <div class="meta">
    Prepared by ${businessName} &nbsp;·&nbsp; ${fmtDateShort(agreement.createdAt)}
    ${agreement.clientName ? ` &nbsp;·&nbsp; ${agreement.clientName}` : ""}
  </div>
  <div class="section">${agreement.content}</div>
  ${agreement.signedAt ? `
  <div class="sig-block">
    <strong>Client Signature</strong>
    <div class="sig-row">
      <div class="sig-field">
        <label>Signed by</label><p>${agreement.signerName}</p>
      </div>
      <div class="sig-field">
        <label>Date</label><p>${fmtDateShort(agreement.signedAt)}</p>
      </div>
    </div>
    ${agreement.signatureImage ? `<img class="sig-img" src="${agreement.signatureImage}" alt="Signature" />` : ""}
    ${agreement.witnessName ? `
    <div style="margin-top:24px"><strong>Witness</strong></div>
    <div class="sig-row">
      <div class="sig-field"><label>Witness Name</label><p>${agreement.witnessName}</p></div>
      <div class="sig-field"><label>Contact</label><p>${agreement.witnessContact || "—"}</p></div>
    </div>
    ${agreement.witnessSignature ? `<img class="sig-img" src="${agreement.witnessSignature}" alt="Witness Signature" />` : ""}
    ` : ""}
  </div>
  ` : '<div class="sig-block"><p style="color:#888;font-style:italic">Not yet signed</p></div>'}
  <div class="agreement-id">Agreement ID: ${agreement.id} &nbsp;·&nbsp; Token: ${agreement.publicToken}</div>
</body>
</html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

// ── Main Agreement Builder ─────────────────────────────────────────────────
export default function AdminAgreementBuilder() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [view, setView] = useState<"edit" | "preview" | "activity">("edit");

  const { data: agr, isLoading } = useQuery<Agreement>({
    queryKey: ["/api/admin/agreements", params.id],
    queryFn: () => apiRequest("GET", `/api/admin/agreements/${params.id}`).then(r => r.json()),
  });

  const { data: activity = [] } = useQuery<AgreementActivityLog[]>({
    queryKey: ["/api/admin/agreements", params.id, "activity"],
    queryFn: () => apiRequest("GET", `/api/admin/agreements/${params.id}/activity`).then(r => r.json()),
  });

  const [form, setForm] = useState<Partial<Agreement>>({});
  useEffect(() => { if (agr) setForm({ ...agr }); }, [agr]);

  const isSigned = agr?.status === "signed" || agr?.status === "completed";

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/admin/agreements/${params.id}`, data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/agreements", params.id] }); toast({ title: "Agreement saved." }); },
    onError: (e: any) => toast({ title: e?.message || "Failed to save", variant: "destructive" }),
  });

  const publicUrl = agr ? `${window.location.origin}/public/agreements/${agr.publicToken}` : "";

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copied." });
  }

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );
  if (!agr) return (
    <div className="p-6 text-center text-muted-foreground">Agreement not found.</div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={() => navigate("/admin/agreements")} data-testid="button-back">
          <ChevronLeft className="w-4 h-4" /> Agreements
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">{agr.title}</p>
            <Badge className={`text-xs shrink-0 ${STATUS_COLORS[agr.status] || "bg-gray-100 text-gray-700"}`}>
              {STATUS_LABELS[agr.status] || agr.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{agr.clientName || "No client"} · Created {fmtDateShort(agr.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={copyLink} data-testid="button-copy-link">
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8"
            onClick={() => window.open(publicUrl, "_blank")} data-testid="button-preview-public">
            <ExternalLink className="w-3.5 h-3.5" /> Preview
          </Button>
          {!isSigned && (
            <Button size="sm" className="gap-1.5 h-8" onClick={() => setSendDialogOpen(true)} data-testid="button-send-agreement">
              <Send className="w-3.5 h-3.5" /> Send
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 h-8"
            onClick={() => openPrintPreview(agr, window.document.title)} data-testid="button-download-pdf">
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* View switcher */}
      <div className="border-b px-6 shrink-0">
        <div className="flex gap-0">
          {(["edit", "preview", "activity"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} data-testid={`button-view-${v}`}
              className={cn("px-4 py-2.5 text-sm border-b-2 transition-colors capitalize",
                view === v ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {v === "activity" ? "Activity Log" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Edit View */}
        {view === "edit" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-full">
            {/* Main content editor */}
            <div className="lg:col-span-2 p-6 space-y-4 border-r">
              {isSigned && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>This agreement was signed by <strong>{agr.signerName}</strong> on {fmtDate(agr.signedAt)}. It is locked and cannot be edited.</span>
                </div>
              )}
              <div>
                <Label className="text-xs mb-1 block">Agreement Title</Label>
                <Input data-testid="input-agr-title" value={form.title || ""} disabled={isSigned}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Agreement Content</Label>
                <Textarea data-testid="input-agr-content"
                  className="min-h-[400px] text-sm font-mono" disabled={isSigned}
                  value={form.content || ""}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Internal Notes (not visible to client)</Label>
                <Textarea data-testid="input-agr-notes"
                  className="min-h-[60px] text-sm"
                  value={form.internalNotes || ""}
                  onChange={e => setForm(p => ({ ...p, internalNotes: e.target.value }))} />
              </div>
              {!isSigned && (
                <Button data-testid="button-save-agreement" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-1.5">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Agreement
                </Button>
              )}
            </div>
            {/* Sidebar */}
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client Info</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs mb-1 block">Full Name</Label>
                    <Input value={form.clientName || ""} disabled={isSigned} className="h-8 text-sm" data-testid="input-client-name"
                      onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Email</Label>
                    <Input value={form.clientEmail || ""} disabled={isSigned} type="email" className="h-8 text-sm" data-testid="input-client-email"
                      onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Company</Label>
                    <Input value={form.clientCompany || ""} disabled={isSigned} className="h-8 text-sm"
                      onChange={e => setForm(p => ({ ...p, clientCompany: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Phone</Label>
                    <Input value={form.clientPhone || ""} disabled={isSigned} className="h-8 text-sm"
                      onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Service Address</Label>
                    <Input value={form.serviceAddress || ""} disabled={isSigned} className="h-8 text-sm"
                      onChange={e => setForm(p => ({ ...p, serviceAddress: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Settings</p>
                <div className="flex items-center gap-3">
                  <Switch id="witness-sw" checked={!!(form.witnessEnabled)} disabled={isSigned}
                    onCheckedChange={v => setForm(p => ({ ...p, witnessEnabled: v }))} />
                  <Label htmlFor="witness-sw" className="text-sm">Require witness signature</Label>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Timeline</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground text-xs">Created</span><span className="text-xs">{fmtDateShort(agr.createdAt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground text-xs">Sent</span><span className="text-xs">{fmtDateShort(agr.sentAt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground text-xs">Viewed</span><span className="text-xs">{fmtDateShort(agr.viewedAt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground text-xs">Signed</span><span className="text-xs">{fmtDateShort(agr.signedAt)}</span></div>
                </div>
              </div>

              {isSigned && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Signature</p>
                  {agr.signatureImage && (
                    <img src={agr.signatureImage} alt="Signature" className="border rounded-lg max-h-24 w-full object-contain bg-white p-2" />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Signed by: {agr.signerName}</p>
                  {agr.signerIp && <p className="text-xs text-muted-foreground">IP: {agr.signerIp}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview View */}
        {view === "preview" && (
          <div className="max-w-3xl mx-auto p-6 md:p-10">
            <div className="bg-white border rounded-2xl shadow-sm p-8 md:p-12 space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-1">{agr.title}</h1>
                <p className="text-sm text-muted-foreground">Created {fmtDateShort(agr.createdAt)}</p>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{agr.content}</div>
              {isSigned && (
                <div className="border-t pt-6">
                  <p className="text-sm font-semibold mb-3">Signature</p>
                  {agr.signatureImage && <img src={agr.signatureImage} alt="Signature" className="max-h-24 border-b border-gray-300 pb-1" />}
                  <p className="text-sm mt-2">{agr.signerName}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(agr.signedAt)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Log */}
        {view === "activity" && (
          <div className="max-w-xl p-6 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity Log</p>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p>{EVENT_LABELS[log.eventType] || log.eventType}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {agr && (
        <SendEmailDialog agreement={agr} open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} publicUrl={publicUrl} />
      )}
    </div>
  );
}
