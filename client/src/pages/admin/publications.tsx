import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Newspaper, Search, ExternalLink, Copy, Pencil, Trash2,
  Globe, FileText, EyeOff, Archive, FileSignature, Send, Eye,
  CheckCircle2, XCircle, Clock, MoreHorizontal, Loader2, Edit3,
  LayoutTemplate,
} from "lucide-react";
import type { Agreement, AgreementTemplate } from "@shared/schema";
import AdminProposals from "@/pages/admin/proposals";

// ── Publication helpers ───────────────────────────────────────────────────────
const PUB_STATUS_META: Record<string, { label: string; color: string }> = {
  draft:       { label: "Draft",       color: "bg-gray-100 text-gray-600" },
  published:   { label: "Published",   color: "bg-green-100 text-green-700" },
  unpublished: { label: "Unpublished", color: "bg-yellow-100 text-yellow-700" },
  archived:    { label: "Archived",    color: "bg-slate-100 text-slate-500" },
};
const PUB_STATUS_ICON: Record<string, any> = {
  draft: FileText, published: Globe, unpublished: EyeOff, archived: Archive,
};

// ── Agreement helpers ─────────────────────────────────────────────────────────
const AGR_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Viewed", signed: "Signed",
  completed: "Completed", declined: "Declined",
};
const AGR_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  signed: "bg-green-100 text-green-700",
  completed: "bg-teal-100 text-teal-700",
  declined: "bg-red-100 text-red-700",
};
const AGR_STATUS_ICONS: Record<string, any> = {
  draft: FileText, sent: Send, viewed: Eye,
  signed: CheckCircle2, completed: CheckCircle2, declined: XCircle,
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

// ── Default agreement body for templates ─────────────────────────────────────
const DEFAULT_BODY = `This Service Agreement is entered into as of {date_generated} between {company_name} ("Service Provider") and {client_full_name} ({client_company}) ("Client").

SCOPE OF SERVICES
The Service Provider agrees to perform cleaning services as described and agreed upon at: {service_address}.

PAYMENT TERMS
{payment_frequency}. Payment is due as specified. Late payments may result in service suspension.

CONTRACT DURATION
{contract_duration}

CANCELLATION POLICY
{cancellation_policy}

CLIENT RESPONSIBILITIES
The Client agrees to provide safe and reasonable access to the service location and ensure the environment is free from hazards.

CONFIDENTIALITY
Both parties agree to maintain the confidentiality of any sensitive information shared during this engagement.

ACCEPTANCE
By signing below, both parties confirm they have read, understood, and agree to the terms of this Agreement.`;

// ── New Agreement Dialog ──────────────────────────────────────────────────────
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
              <Label className="text-xs mb-1 block">Template (optional)</Label>
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
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create Agreement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Template Editor Dialog ────────────────────────────────────────────────────
function TemplateEditorDialog({ template, open, onClose }: { template: AgreementTemplate | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !template?.id;
  const [form, setForm] = useState<Partial<AgreementTemplate>>({});

  useEffect(() => {
    setForm(template ? { ...template } : {
      name: "", title: "Service Agreement", body: DEFAULT_BODY,
      termsText: "", paymentTerms: "", contractDuration: "12 months",
      cancellationPolicy: "30 days written notice required",
      witnessEnabled: false, isDefault: false,
    });
  }, [template, open]);

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
            <p className="text-xs text-muted-foreground mb-1">Variables: {`{client_full_name}, {client_company}, {service_address}, {payment_frequency}, {contract_duration}, {cancellation_policy}, {date_generated}, {company_name}`}</p>
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
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {isNew ? "Create Template" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Agreements Sub-Page ───────────────────────────────────────────────────────
export function AgreementsSubPage({ proposalId }: { proposalId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [newDialogOpen, setNewDialogOpen] = useState(!!proposalId);
  const [agrtab, setAgrtab] = useState<"list" | "templates">("list");
  const [editingTemplate, setEditingTemplate] = useState<AgreementTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [deleteAgrTarget, setDeleteAgrTarget] = useState<string | null>(null);

  const { data: agreements = [], isLoading: agrLoading } = useQuery<Agreement[]>({
    queryKey: ["/api/admin/agreements"],
  });
  const { data: templates = [], isLoading: tmplLoading } = useQuery<AgreementTemplate[]>({
    queryKey: ["/api/admin/agreement-templates"],
  });

  const deleteAgrMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/agreements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agreements"] });
      toast({ title: "Agreement deleted" });
      setDeleteAgrTarget(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const deleteTmplMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/agreement-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agreement-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const filtered = agreements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.clientCompany || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agreements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create, send, and manage digital service agreements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }} data-testid="button-new-template">
            <LayoutTemplate className="w-4 h-4 mr-2" /> Templates
          </Button>
          <Button data-testid="button-new-agreement" onClick={() => setNewDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Agreement
          </Button>
        </div>
      </div>

      <Tabs value={agrtab} onValueChange={v => setAgrtab(v as any)}>
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-agreements-list">Agreements</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search agreements…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-agreements"
            />
          </div>

          {agrLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <FileSignature className="w-6 h-6 text-blue-400" />
              </div>
              {search ? (
                <p className="text-sm text-gray-600">No agreements matching "{search}"</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">No agreements yet</p>
                  <p className="text-xs text-gray-400 mt-1">Create your first service agreement and send it for signature</p>
                  <Button className="mt-4" size="sm" onClick={() => setNewDialogOpen(true)} data-testid="button-empty-new-agreement">
                    <Plus className="w-4 h-4 mr-2" /> Create Agreement
                  </Button>
                </>
              )}
            </div>
          ) : (
            filtered.map(agr => {
              const Icon = AGR_STATUS_ICONS[agr.status] || FileText;
              const colorClass = AGR_STATUS_COLORS[agr.status] || "bg-gray-100 text-gray-700";
              return (
                <Card key={agr.id} className="hover:shadow-sm transition-shadow cursor-pointer"
                  data-testid={`card-agreement-${agr.id}`}
                  onClick={() => navigate(`/admin/agreements/${agr.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-sm">{agr.title}</h3>
                          <Badge className={`text-[10px] px-2 py-0 h-4 rounded-full font-medium ${colorClass}`}>
                            {AGR_STATUS_LABELS[agr.status] || agr.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {agr.clientName || "No client"}{agr.clientCompany ? ` · ${agr.clientCompany}` : ""}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Created {fmtDate(agr.createdAt)}
                          {agr.sentAt ? ` · Sent ${fmtDate(agr.sentAt)}` : ""}
                          {agr.signedAt ? ` · Signed ${fmtDate(agr.signedAt)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-gray-700"
                          onClick={() => navigate(`/admin/agreements/${agr.id}`)}
                          data-testid={`button-edit-agreement-${agr.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-destructive"
                          onClick={() => setDeleteAgrTarget(agr.id)}
                          data-testid={`button-delete-agreement-${agr.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }} data-testid="button-new-template-tab">
              <Plus className="w-4 h-4 mr-2" /> New Template
            </Button>
          </div>
          {tmplLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <LayoutTemplate className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No templates yet</p>
              <p className="text-xs text-gray-400 mt-1">Templates let you quickly create agreements with pre-filled content</p>
              <Button className="mt-4" size="sm" onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Create Template
              </Button>
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="rounded-xl border bg-card p-4 flex items-start justify-between gap-3"
                data-testid={`card-template-${t.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    {t.isDefault && <Badge className="bg-blue-100 text-blue-700 text-xs">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.title}</p>
                  {t.witnessEnabled && <p className="text-xs text-amber-600 mt-1">Witness required</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                    onClick={() => { setEditingTemplate(t); setTemplateDialogOpen(true); }}
                    data-testid={`button-edit-template-${t.id}`}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => deleteTmplMutation.mutate(t.id)}
                    data-testid={`button-delete-template-${t.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <NewAgreementDialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} proposalId={proposalId} />
      <TemplateEditorDialog template={editingTemplate} open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} />

      <AlertDialog open={!!deleteAgrTarget} onOpenChange={o => !o && setDeleteAgrTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agreement?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the agreement and all its activity. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAgrTarget && deleteAgrMutation.mutate(deleteAgrTarget)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-agreement">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Publications Sub-Page ─────────────────────────────────────────────────────
function PublicationsSubPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: publications = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/publications"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/publications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publications"] });
      toast({ title: "Publication deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = publications.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.subtitle || "").toLowerCase().includes(search.toLowerCase())
  );

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!", description: url }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage your public-facing service pages</p>
        </div>
        <Link href="/admin/publications/new">
          <Button data-testid="button-new-publication">
            <Plus className="w-4 h-4 mr-2" /> New Publication
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search publications…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-publications"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Newspaper className="w-6 h-6 text-gray-400" />
          </div>
          {search ? (
            <>
              <p className="text-sm font-medium text-gray-700">No results for "{search}"</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">No publications yet</p>
              <p className="text-xs text-gray-400 mt-1">Create your first publication to share with clients</p>
              <Link href="/admin/publications/new">
                <Button className="mt-4" size="sm" data-testid="button-empty-new"><Plus className="w-4 h-4 mr-2" />Create Publication</Button>
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pub => {
            const meta = PUB_STATUS_META[pub.status] || PUB_STATUS_META.draft;
            const Icon = PUB_STATUS_ICON[pub.status] || FileText;
            return (
              <Card key={pub.id} className="hover:shadow-sm transition-shadow" data-testid={`card-publication-${pub.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug">{pub.title}</h3>
                        <Badge className={`text-[10px] px-2 py-0 h-4 rounded-full font-medium ${meta.color}`}>{meta.label}</Badge>
                        {pub.category && <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0 h-4 rounded-full flex items-center">{pub.category}</span>}
                      </div>
                      {pub.subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{pub.subtitle}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {pub.status === "published" ? `Published ${pub.publishedAt ? new Date(pub.publishedAt).toLocaleDateString() : ""}` : `Created ${new Date(pub.createdAt).toLocaleDateString()}`}
                        {" · "}<span className="font-mono text-[10px]">/p/{pub.slug}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {pub.status === "published" && (
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-blue-600"
                          onClick={() => window.open(`/p/${pub.slug}`, "_blank")}
                          title="View public page" data-testid={`button-view-${pub.id}`}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-gray-600"
                        onClick={() => copyLink(pub.slug)} title="Copy public link" data-testid={`button-copy-${pub.id}`}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Link href={`/admin/publications/${pub.id}`}>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-gray-700"
                          title="Edit" data-testid={`button-edit-${pub.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-destructive"
                        onClick={() => setDeleteTarget(pub.id)} title="Delete" data-testid={`button-delete-${pub.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Publication?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the publication, all its sections, images, and pricing. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive hover:bg-destructive/90" data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPublications() {
  const [activeTab, setActiveTab] = useState("publications");

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <div className="flex gap-1 border-b pb-0 -mb-6">
          <button
            onClick={() => setActiveTab("publications")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${activeTab === "publications" ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-publications">
            <Newspaper className="w-4 h-4" /> Publications
          </button>
          <button
            onClick={() => setActiveTab("proposals")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${activeTab === "proposals" ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-proposals">
            <FileText className="w-4 h-4" /> Proposals
          </button>
        </div>

        <div className="pt-2">
          {activeTab === "publications" ? (
            <PublicationsSubPage />
          ) : (
            <AdminProposals />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Standalone Agreements Page (for /admin/agreements route) ──────────────────
export function AdminAgreementsPage() {
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const proposalId = searchParams.get("proposalId") || undefined;
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        <AgreementsSubPage proposalId={proposalId} />
      </div>
    </div>
  );
}
