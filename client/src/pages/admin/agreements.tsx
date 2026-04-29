import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Plus, FileSignature, Clock, CheckCircle2, XCircle, Eye, Send, Copy, Trash2,
  MoreHorizontal, FileText, ArrowRight, Loader2, ChevronLeft, LayoutTemplate,
  AlertCircle, Edit3,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Agreement, AgreementTemplate } from "@shared/schema";

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
const STATUS_ICONS: Record<string, any> = {
  draft: FileText, sent: Send, viewed: Eye, signed: CheckCircle2, completed: CheckCircle2, declined: XCircle,
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

// ── Default template body ────────────────────────────────────────────────────
const DEFAULT_BODY = `This Service Agreement ("Agreement") is entered into as of {date_generated} between {company_name} ("Service Provider") and {client_full_name} ({client_company}) ("Client").

1. SCOPE OF SERVICES
The Service Provider agrees to perform the cleaning services as described and agreed upon, at the location: {service_address}.

2. SERVICE SCHEDULE
Services will be provided at a frequency and schedule agreed upon by both parties. Any changes to the schedule must be communicated at least 48 hours in advance.

3. PAYMENT TERMS
{payment_frequency}. Payment is due as specified. Late payments may result in service suspension.

4. CONTRACT DURATION
{contract_duration}

5. CANCELLATION POLICY
{cancellation_policy}

6. CLIENT RESPONSIBILITIES
The Client agrees to provide safe and reasonable access to the service location and to ensure the environment is free from hazards.

7. CONFIDENTIALITY
Both parties agree to maintain the confidentiality of any sensitive information shared during this engagement.

8. ACCEPTANCE
By signing below, both parties confirm they have read, understood, and agree to the terms of this Agreement.`;

// ── New Agreement Dialog ─────────────────────────────────────────────────────
function NewAgreementDialog({ open, onClose, proposalId }: { open: boolean; onClose: () => void; proposalId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("Service Agreement");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [witnessEnabled, setWitnessEnabled] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("blank");

  const { data: templates = [] } = useQuery<AgreementTemplate[]>({ queryKey: ["/api/admin/agreement-templates"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/admin/agreements", data).then(r => r.json()),
    onSuccess: (agr: Agreement) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agreements"] });
      toast({ title: "Agreement created." });
      navigate(`/admin/agreements/${agr.id}`);
      onClose();
    },
    onError: () => toast({ title: "Failed to create agreement", variant: "destructive" }),
  });

  function handleCreate() {
    const tmpl = templates.find(t => t.id === selectedTemplate);
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
    let content = tmpl?.body || DEFAULT_BODY;
    content = content
      .replace(/{date_generated}/g, dateStr)
      .replace(/{client_full_name}/g, clientName || "{client_full_name}")
      .replace(/{client_company}/g, clientCompany || "{client_company}")
      .replace(/{client_email}/g, clientEmail || "{client_email}")
      .replace(/{client_phone}/g, clientPhone || "{client_phone}")
      .replace(/{service_address}/g, serviceAddress || "{service_address}")
      .replace(/{payment_frequency}/g, tmpl?.paymentTerms || "Payment terms to be confirmed")
      .replace(/{contract_duration}/g, tmpl?.contractDuration || "Month-to-month")
      .replace(/{cancellation_policy}/g, tmpl?.cancellationPolicy || "30 days written notice required");

    createMutation.mutate({
      title,
      templateId: tmpl?.id || null,
      proposalId: proposalId || null,
      content,
      witnessEnabled,
      clientInfo: { clientName, clientEmail, clientCompany, clientPhone, serviceAddress },
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSignature className="w-4 h-4" /> New Agreement</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-1 block">Agreement Title</Label>
            <Input data-testid="input-agreement-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Service Agreement" />
          </div>
          {templates.length > 0 && (
            <div>
              <Label className="text-xs mb-1 block">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger data-testid="select-agreement-template"><SelectValue placeholder="Blank (no template)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Client Full Name</Label>
              <Input data-testid="input-client-name" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Client Email</Label>
              <Input data-testid="input-client-email" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Company Name</Label>
              <Input data-testid="input-client-company" value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Phone</Label>
              <Input data-testid="input-client-phone" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Service Address</Label>
            <Input data-testid="input-service-address" value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="witness-toggle" checked={witnessEnabled} onCheckedChange={setWitnessEnabled} data-testid="switch-witness-enabled" />
            <Label htmlFor="witness-toggle" className="text-sm">Require witness signature</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-create-agreement" onClick={handleCreate} disabled={createMutation.isPending} className="gap-1.5">
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create Agreement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Template Manager ─────────────────────────────────────────────────────────
function TemplateCard({ template, onEdit, onDelete }: { template: AgreementTemplate; onEdit: (t: AgreementTemplate) => void; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm truncate">{template.name}</p>
          {template.isDefault && <Badge className="bg-blue-100 text-blue-700 text-xs">Default</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{template.title}</p>
        {template.witnessEnabled && <p className="text-xs text-amber-600 mt-1">Witness required</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(template)} data-testid={`button-edit-template-${template.id}`}><Edit3 className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => onDelete(template.id)} data-testid={`button-delete-template-${template.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

function TemplateEditorDialog({ template, open, onClose }: { template: AgreementTemplate | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<AgreementTemplate>>({});

  const isNew = !template?.id;

  useState(() => {
    setForm(template ? { ...template } : {
      name: "", title: "Service Agreement", body: DEFAULT_BODY,
      termsText: "", paymentTerms: "", contractDuration: "12 months",
      cancellationPolicy: "30 days written notice required", witnessEnabled: false, isDefault: false,
    });
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => isNew
      ? apiRequest("POST", "/api/admin/agreement-templates", data).then(r => r.json())
      : apiRequest("PATCH", `/api/admin/agreement-templates/${template!.id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agreement-templates"] });
      toast({ title: isNew ? "Template created." : "Template saved." });
      onClose();
    },
    onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
  });

  const f = (key: keyof AgreementTemplate) => ({
    value: (form[key] as string) ?? "",
    onChange: (e: any) => setForm(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "New Template" : "Edit Template"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Template Name</Label>
              <Input data-testid="input-template-name" {...f("name")} placeholder="e.g. Residential Cleaning Agreement" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Agreement Title (shown to client)</Label>
              <Input data-testid="input-template-title" {...f("title")} placeholder="Service Agreement" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Agreement Body</Label>
            <p className="text-xs text-muted-foreground mb-1">Variables: {"{"}{"{"}client_full_name{"}"}, {"{"}client_company{"}"}, {"{"}service_address{"}"}, {"{"}payment_frequency{"}"}, {"{"}contract_duration{"}"}, {"{"}cancellation_policy{"}"}, {"{"}date_generated{"}"}</p>
            <Textarea data-testid="input-template-body" className="min-h-[200px] text-sm font-mono" {...f("body")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Payment Terms</Label>
              <Input data-testid="input-template-paymentTerms" {...f("paymentTerms")} placeholder="e.g. Monthly billing on 1st" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Contract Duration</Label>
              <Input data-testid="input-template-contractDuration" {...f("contractDuration")} placeholder="e.g. 12 months" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Cancellation Policy</Label>
            <Input data-testid="input-template-cancellationPolicy" {...f("cancellationPolicy")} placeholder="e.g. 30 days written notice" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Terms & Conditions (optional)</Label>
            <Textarea data-testid="input-template-termsText" className="min-h-[80px] text-sm" {...f("termsText")} placeholder="Additional terms..." />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="tmpl-witness" checked={!!(form.witnessEnabled)} onCheckedChange={v => setForm(p => ({ ...p, witnessEnabled: v }))} />
            <Label htmlFor="tmpl-witness" className="text-sm">Require witness signature</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="tmpl-default" checked={!!(form.isDefault)} onCheckedChange={v => setForm(p => ({ ...p, isDefault: v }))} />
            <Label htmlFor="tmpl-default" className="text-sm">Set as default template</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-template" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-1.5">
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Agreements Page ─────────────────────────────────────────────────────
export default function AdminAgreements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState("agreements");
  // Detect proposalId from query string (e.g. from proposal builder "Agreement" button)
  const urlProposalId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("proposalId") || undefined
    : undefined;
  const [newAgreementOpen, setNewAgreementOpen] = useState(!!urlProposalId);
  const [editTemplate, setEditTemplate] = useState<AgreementTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: agreements = [], isLoading } = useQuery<Agreement[]>({ queryKey: ["/api/admin/agreements"] });
  const { data: templates = [], isLoading: tmplLoading } = useQuery<AgreementTemplate[]>({ queryKey: ["/api/admin/agreement-templates"] });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/agreement-templates/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/agreement-templates"] }); toast({ title: "Template deleted." }); },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const filtered = agreements.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.clientName.toLowerCase().includes(search.toLowerCase()) ||
    a.clientEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <FileSignature className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-semibold text-lg">Agreements</h1>
            <p className="text-xs text-muted-foreground">Create, send, and collect digital signatures</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === "templates" ? (
            <Button data-testid="button-new-template" onClick={() => { setEditTemplate(null); setTemplateDialogOpen(true); }} className="gap-1.5" size="sm">
              <Plus className="w-3.5 h-3.5" /> New Template
            </Button>
          ) : (
            <Button data-testid="button-new-agreement" onClick={() => setNewAgreementOpen(true)} className="gap-1.5" size="sm">
              <Plus className="w-3.5 h-3.5" /> New Agreement
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 border-b shrink-0">
          <TabsList className="h-10 bg-transparent p-0 gap-0">
            <TabsTrigger value="agreements" data-testid="tab-agreements" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 h-10">
              Agreements
              {agreements.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{agreements.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 h-10">
              Templates
              {templates.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{templates.length}</span>}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agreements" className="flex-1 overflow-auto p-6 m-0 space-y-4">
          <div className="flex gap-3">
            <Input placeholder="Search agreements..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" data-testid="input-search-agreements" />
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FileSignature className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No agreements yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first agreement to get started</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setNewAgreementOpen(true)} data-testid="button-new-agreement-empty">
                <Plus className="w-3.5 h-3.5" /> New Agreement
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(agr => {
                const Icon = STATUS_ICONS[agr.status] || FileText;
                return (
                  <div key={agr.id} data-testid={`card-agreement-${agr.id}`}
                    className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/agreements/${agr.id}`)}>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{agr.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {agr.clientName || "—"}{agr.clientEmail ? ` · ${agr.clientEmail}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={`text-xs ${STATUS_COLORS[agr.status] || "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[agr.status] || agr.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:block">{fmtDate(agr.createdAt)}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="flex-1 overflow-auto p-6 m-0">
          {tmplLoading ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-20">
              <LayoutTemplate className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No templates yet</p>
              <p className="text-xs text-muted-foreground mt-1">Templates let you quickly generate agreements from a standard layout</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => { setEditTemplate(null); setTemplateDialogOpen(true); }} data-testid="button-new-template-empty">
                <Plus className="w-3.5 h-3.5" /> New Template
              </Button>
            </div>
          ) : (
            <div className="max-w-2xl space-y-3">
              <p className="text-xs text-muted-foreground">Templates define the standard layout for your agreements. Variables like {"{"}{"{"}client_full_name{"}"} are auto-filled when you create a new agreement.</p>
              {templates.map(t => (
                <TemplateCard key={t.id} template={t}
                  onEdit={tmpl => { setEditTemplate(tmpl); setTemplateDialogOpen(true); }}
                  onDelete={id => { if (confirm("Delete this template?")) deleteTemplateMutation.mutate(id); }} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NewAgreementDialog open={newAgreementOpen} onClose={() => setNewAgreementOpen(false)} proposalId={urlProposalId} />
      <TemplateEditorDialog open={templateDialogOpen} template={editTemplate} onClose={() => { setTemplateDialogOpen(false); setEditTemplate(null); }} />
    </div>
  );
}
