import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Copy, Mail, Eye, Save, Plus, Trash2, GripVertical,
  ChevronLeft, ChevronRight, Check, ExternalLink, Printer,
  FileText, User, MapPin, Settings, DollarSign, AlignLeft, Share2,
} from "lucide-react";
import type {
  Proposal, ScopeSection, IncludedItem, PricingLineItem, TaxConfig, PricingConfig, ServiceDetails,
} from "@shared/schema";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "client", label: "Client", icon: User },
  { id: "service", label: "Service", icon: Settings },
  { id: "scope", label: "Scope", icon: AlignLeft },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "terms", label: "Terms", icon: FileText },
  { id: "share", label: "Share", icon: Share2 },
];

const SERVICE_TYPES = [
  "Commercial Cleaning", "Office Cleaning", "Restaurant Cleaning", "Post-Construction Cleaning",
  "Move-In / Move-Out Cleaning", "Deep Cleaning", "Floor Care", "Janitorial Service", "Custom",
];
const FREQUENCIES = ["One-Time", "Daily", "Weekly", "Bi-Weekly", "Monthly", "Custom"];
const DAYS_PER_WEEK = ["1 day/week", "2 days/week", "3 days/week", "4 days/week", "5 days/week", "6 days/week", "7 days/week", "Custom"];
const PREFERRED_TIMES = ["Morning", "Afternoon", "Evening", "After-Hours", "Custom"];
const CONTRACT_LENGTHS = ["One-Time", "Monthly", "3 Months", "6 Months", "12 Months", "Custom"];
const TAX_TYPES = [
  { value: "none", label: "No Tax", rate: 0 },
  { value: "gst", label: "GST (5%)", rate: 5 },
  { value: "pst", label: "PST (7%)", rate: 7 },
  { value: "hst", label: "HST (13%)", rate: 13 },
  { value: "custom", label: "Custom Rate", rate: 0 },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  thinking: "bg-amber-100 text-amber-700",
};

export default function AdminProposalBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");

  const { data: proposal, isLoading } = useQuery<Proposal>({
    queryKey: ["/api/proposals", id],
    queryFn: () => fetch(`/api/proposals/${id}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: activityLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/proposals", id, "activity"],
    queryFn: () => fetch(`/api/proposals/${id}/activity`, { credentials: "include" }).then(r => r.json()),
  });

  // Local state for all editable fields
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [serviceDetails, setServiceDetails] = useState<ServiceDetails>({
    serviceType: "", frequency: "", daysPerWeek: "", hoursPerVisit: "",
    numCleaners: "1", preferredTime: "", contractLength: "", proposedStartDate: "",
  });
  const [scopeSections, setScopeSections] = useState<ScopeSection[]>([]);
  const [includedItems, setIncludedItems] = useState<IncludedItem[]>([]);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    lineItems: [], taxConfig: { type: "none", rate: 0, label: "No Tax" }, subtotalOverride: null, notes: "",
  });
  const [termsText, setTermsText] = useState("");

  // Sync from server
  useEffect(() => {
    if (!proposal) return;
    setTitle(proposal.title);
    setClientName(proposal.clientName);
    setClientCompany(proposal.clientCompany);
    setClientEmail(proposal.clientEmail);
    setClientPhone(proposal.clientPhone);
    setServiceAddress(proposal.serviceAddress);
    setBillingAddress(proposal.billingAddress);
    setContactPerson(proposal.contactPerson);
    setLeadSource(proposal.leadSource);
    setExpiryDate(proposal.expiryDate);
    setInternalNotes(proposal.internalNotes);
    setTermsText(proposal.termsText);
    setEmailAddress(proposal.clientEmail || "");
    try { setServiceDetails(JSON.parse(proposal.serviceDetails)); } catch { }
    try { setScopeSections(JSON.parse(proposal.scopeSections)); } catch { }
    try { setIncludedItems(JSON.parse(proposal.includedItems)); } catch { }
    try { setPricingConfig(JSON.parse(proposal.pricingConfig)); } catch { }
  }, [proposal]);

  const saveMutation = useMutation({
    mutationFn: (patch: Record<string, any>) => apiRequest("PATCH", `/api/proposals/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  const save = useCallback((extra?: Record<string, any>) => {
    saveMutation.mutate({
      title, clientName, clientCompany, clientEmail, clientPhone,
      serviceAddress, billingAddress, contactPerson, leadSource,
      expiryDate, internalNotes, termsText,
      serviceDetails: JSON.stringify(serviceDetails),
      scopeSections: JSON.stringify(scopeSections),
      includedItems: JSON.stringify(includedItems),
      pricingConfig: JSON.stringify(pricingConfig),
      ...extra,
    });
  }, [
    title, clientName, clientCompany, clientEmail, clientPhone, serviceAddress,
    billingAddress, contactPerson, leadSource, expiryDate, internalNotes, termsText,
    serviceDetails, scopeSections, includedItems, pricingConfig,
  ]);

  const sendEmailMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/proposals/${id}/send-email`),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setEmailDialogOpen(false);
      if (data.emailError) {
        toast({ title: "Saved — email not sent", description: data.emailError });
      } else {
        toast({ title: "Email sent", description: "The proposal link was sent to the client." });
      }
    },
    onError: () => toast({ title: "Error", description: "Could not send email.", variant: "destructive" }),
  });

  function copyLink() {
    if (!proposal) return;
    const url = `${window.location.origin}/public/proposals/${proposal.publicToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Share this link with your client." });
  }

  function openPreview() {
    if (!proposal) return;
    window.open(`/public/proposals/${proposal.publicToken}`, "_blank");
  }

  function printProposal() {
    if (!proposal) return;
    const url = `/public/proposals/${proposal.publicToken}?print=1`;
    const w = window.open(url, "_blank");
    if (w) setTimeout(() => w.print(), 1200);
  }

  // ── Scope helpers ───────────────────────────────────────────────────────
  function addSection() {
    setScopeSections(s => [...s, { id: uid(), title: "New Section", items: [] }]);
  }
  function updateSectionTitle(sIdx: number, title: string) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? { ...sec, title } : sec));
  }
  function removeSection(sIdx: number) {
    setScopeSections(s => s.filter((_, i) => i !== sIdx));
  }
  function addBullet(sIdx: number) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? { ...sec, items: [...sec.items, { id: uid(), text: "" }] } : sec));
  }
  function updateBullet(sIdx: number, bIdx: number, text: string) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? {
      ...sec, items: sec.items.map((b, j) => j === bIdx ? { ...b, text } : b),
    } : sec));
  }
  function removeBullet(sIdx: number, bIdx: number) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? {
      ...sec, items: sec.items.filter((_, j) => j !== bIdx),
    } : sec));
  }

  // ── Pricing helpers ─────────────────────────────────────────────────────
  function addLineItem() {
    setPricingConfig(p => ({
      ...p,
      lineItems: [...p.lineItems, { id: uid(), name: "", description: "", quantity: 1, unitPrice: 0, taxable: true }],
    }));
  }
  function updateLineItem(idx: number, patch: Partial<PricingLineItem>) {
    setPricingConfig(p => ({
      ...p,
      lineItems: p.lineItems.map((li, i) => i === idx ? { ...li, ...patch } : li),
    }));
  }
  function removeLineItem(idx: number) {
    setPricingConfig(p => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== idx) }));
  }
  function setTaxType(type: string) {
    const preset = TAX_TYPES.find(t => t.value === type);
    setPricingConfig(p => ({
      ...p,
      taxConfig: { type: type as TaxConfig["type"], rate: preset?.rate ?? p.taxConfig.rate, label: preset?.label ?? p.taxConfig.label },
    }));
  }

  // ── Included items helpers ──────────────────────────────────────────────
  function addIncludedItem() {
    setIncludedItems(items => [...items, { id: uid(), label: "", status: "included" }]);
  }
  function updateIncludedItem(idx: number, patch: Partial<IncludedItem>) {
    setIncludedItems(items => items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function removeIncludedItem(idx: number) {
    setIncludedItems(items => items.filter((_, i) => i !== idx));
  }

  // ── Pricing math ────────────────────────────────────────────────────────
  const lineSubtotal = pricingConfig.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const effectiveSubtotal = pricingConfig.subtotalOverride != null ? pricingConfig.subtotalOverride : lineSubtotal;
  const taxableAmount = pricingConfig.subtotalOverride != null
    ? effectiveSubtotal
    : pricingConfig.lineItems.filter(i => i.taxable).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = taxableAmount * (pricingConfig.taxConfig.rate / 100);
  const totalAmount = effectiveSubtotal + taxAmount;

  const publicUrl = proposal ? `${window.location.origin}/public/proposals/${proposal.publicToken}` : "";

  const formatActivity = (log: any) => {
    const labels: Record<string, string> = {
      created: "Proposal created", sent_email: "Sent by email", viewed: "Client viewed", archived: "Archived",
      unarchived: "Unarchived", accepted: "Client accepted", rejected: "Client rejected", thinking: "Client is thinking",
    };
    return labels[log.eventType] || log.eventType;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="space-y-3 w-64">
          <div className="h-4 bg-muted animate-pulse rounded" />
          <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Proposal not found.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/proposals")} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-sm truncate max-w-[200px]">{proposal.title}</h1>
              <span className="text-xs text-muted-foreground font-mono">{proposal.proposalNumber}</span>
              <Badge className={`text-[10px] h-5 px-2 ${STATUS_COLORS[proposal.status] || "bg-gray-100 text-gray-600"}`}>
                {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { save(); toast({ title: "Saved" }); }} disabled={saveMutation.isPending} data-testid="button-save-proposal">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink} data-testid="button-copy-proposal-link">
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={openPreview} data-testid="button-preview-proposal">
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Preview
          </Button>
          <Button size="sm" onClick={() => setEmailDialogOpen(true)} data-testid="button-send-email-proposal">
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Step navigation */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20 overflow-x-auto">
        {STEPS.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => { save(); setStep(idx); }}
            data-testid={`step-${s.id}`}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              step === idx ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <s.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{s.label}</span>
            <span className="sm:hidden">{idx + 1}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

          {/* ── Step 0: Client ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold mb-4">Client / Lead Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Proposal Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Office Cleaning Proposal" data-testid="input-proposal-title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client / Lead Name</Label>
                    <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith" data-testid="input-client-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Name</Label>
                    <Input value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="ABC Restaurant" data-testid="input-client-company" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client Email</Label>
                    <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@example.com" data-testid="input-client-email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client Phone</Label>
                    <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(204) 555-0100" data-testid="input-client-phone" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Service Address</Label>
                    <Input value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} placeholder="123 Main Street, Winnipeg, MB" data-testid="input-service-address" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Billing Address <span className="text-muted-foreground text-xs">(if different)</span></Label>
                    <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Same as service address" data-testid="input-billing-address" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact Person</Label>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Office Manager" data-testid="input-contact-person" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lead Source</Label>
                    <Input value={leadSource} onChange={e => setLeadSource(e.target.value)} placeholder="Referral, Google, etc." data-testid="input-lead-source" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expiry Date</Label>
                    <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} data-testid="input-expiry-date" />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>Internal Notes <span className="text-muted-foreground text-xs">(never shown on public proposal)</span></Label>
                <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Notes visible only to your team…" data-testid="input-internal-notes" />
              </div>
            </div>
          )}

          {/* ── Step 1: Service Details ──────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Service Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Service Type</Label>
                  <Select value={serviceDetails.serviceType} onValueChange={v => setServiceDetails(d => ({ ...d, serviceType: v }))}>
                    <SelectTrigger data-testid="select-service-type"><SelectValue placeholder="Select service type…" /></SelectTrigger>
                    <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={serviceDetails.frequency} onValueChange={v => setServiceDetails(d => ({ ...d, frequency: v }))}>
                    <SelectTrigger data-testid="select-frequency"><SelectValue placeholder="How often?" /></SelectTrigger>
                    <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Days Per Week</Label>
                  <Select value={serviceDetails.daysPerWeek} onValueChange={v => setServiceDetails(d => ({ ...d, daysPerWeek: v }))}>
                    <SelectTrigger data-testid="select-days-per-week"><SelectValue placeholder="Days/week?" /></SelectTrigger>
                    <SelectContent>{DAYS_PER_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Hours Per Visit</Label>
                  <Input value={serviceDetails.hoursPerVisit} onChange={e => setServiceDetails(d => ({ ...d, hoursPerVisit: e.target.value }))} placeholder="e.g. 2" data-testid="input-hours-per-visit" />
                </div>
                <div className="space-y-1.5">
                  <Label>Number of Cleaners</Label>
                  <Input value={serviceDetails.numCleaners} onChange={e => setServiceDetails(d => ({ ...d, numCleaners: e.target.value }))} placeholder="e.g. 2" data-testid="input-num-cleaners" />
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Time</Label>
                  <Select value={serviceDetails.preferredTime} onValueChange={v => setServiceDetails(d => ({ ...d, preferredTime: v }))}>
                    <SelectTrigger data-testid="select-preferred-time"><SelectValue placeholder="Time preference?" /></SelectTrigger>
                    <SelectContent>{PREFERRED_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Contract Length</Label>
                  <Select value={serviceDetails.contractLength} onValueChange={v => setServiceDetails(d => ({ ...d, contractLength: v }))}>
                    <SelectTrigger data-testid="select-contract-length"><SelectValue placeholder="Contract length?" /></SelectTrigger>
                    <SelectContent>{CONTRACT_LENGTHS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Proposed Start Date</Label>
                  <Input type="date" value={serviceDetails.proposedStartDate} onChange={e => setServiceDetails(d => ({ ...d, proposedStartDate: e.target.value }))} data-testid="input-proposed-start" />
                </div>
              </div>

              {/* Monthly estimate */}
              {serviceDetails.hoursPerVisit && serviceDetails.numCleaners && serviceDetails.daysPerWeek && (
                <div className="rounded-xl bg-muted/40 border p-4 space-y-1 text-sm">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">Monthly Estimate</p>
                  {(() => {
                    const hpv = parseFloat(serviceDetails.hoursPerVisit) || 0;
                    const nc = parseFloat(serviceDetails.numCleaners) || 1;
                    const dpw = parseFloat(serviceDetails.daysPerWeek) || 0;
                    const weeklyHours = hpv * nc * dpw;
                    const monthlyHours = weeklyHours * 4.33;
                    return (
                      <>
                        <p>Hours per visit: <strong>{hpv} × {nc} cleaner{nc !== 1 ? "s" : ""} = {hpv * nc} hrs</strong></p>
                        <p>Weekly hours: <strong>{weeklyHours.toFixed(1)} hrs ({dpw} days/week)</strong></p>
                        <p>Estimated monthly hours: <strong>{monthlyHours.toFixed(1)} hrs</strong></p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Scope of Work ──────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Scope of Work</h2>
                <Button variant="outline" size="sm" onClick={addSection} data-testid="button-add-section">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Section
                </Button>
              </div>

              {scopeSections.length === 0 && (
                <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                  <AlignLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No scope sections yet. Add your first section.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addSection}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Section
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {scopeSections.map((section, sIdx) => (
                  <div key={section.id} className="border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={section.title}
                        onChange={e => updateSectionTitle(sIdx, e.target.value)}
                        className="h-7 text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 flex-1"
                        placeholder="Section title…"
                        data-testid={`input-section-title-${sIdx}`}
                      />
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeSection(sIdx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {section.items.map((bullet, bIdx) => (
                        <div key={bullet.id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-px" />
                          <Input
                            value={bullet.text}
                            onChange={e => updateBullet(sIdx, bIdx, e.target.value)}
                            className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 flex-1"
                            placeholder="Bullet point…"
                            data-testid={`input-bullet-${sIdx}-${bIdx}`}
                          />
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeBullet(sIdx, bIdx)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 mt-1" onClick={() => addBullet(sIdx)} data-testid={`button-add-bullet-${sIdx}`}>
                        <Plus className="w-3 h-3 mr-1" /> Add bullet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">What's Included</h3>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={addIncludedItem} data-testid="button-add-included">
                    <Plus className="w-3 h-3 mr-1" /> Add item
                  </Button>
                </div>
                <div className="space-y-2">
                  {includedItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Input
                        value={item.label}
                        onChange={e => updateIncludedItem(idx, { label: e.target.value })}
                        className="h-8 text-sm flex-1"
                        placeholder="Item name…"
                        data-testid={`input-included-label-${idx}`}
                      />
                      <Select value={item.status} onValueChange={v => updateIncludedItem(idx, { status: v as IncludedItem["status"] })}>
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="included">Included</SelectItem>
                          <SelectItem value="not_included">Not Included</SelectItem>
                          <SelectItem value="extra_cost">Extra Cost</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeIncludedItem(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {includedItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">No items yet. Add what's included in the service.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Pricing ───────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">Pricing</h2>
                  <Button variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Line Item
                  </Button>
                </div>

                {/* Line items */}
                <div className="space-y-2">
                  {/* Header */}
                  {pricingConfig.lineItems.length > 0 && (
                    <div className="grid grid-cols-[1fr_80px_100px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                      <span>Item</span><span className="text-center">Qty</span><span className="text-center">Unit Price</span><span className="text-right">Subtotal</span><span />
                    </div>
                  )}
                  {pricingConfig.lineItems.map((item, idx) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-[1fr_80px_100px_80px_32px] gap-2 items-center">
                        <Input
                          value={item.name}
                          onChange={e => updateLineItem(idx, { name: e.target.value })}
                          className="h-8 text-sm"
                          placeholder="Service or item name"
                          data-testid={`input-line-name-${idx}`}
                        />
                        <Input
                          type="number" min="0" step="1"
                          value={item.quantity}
                          onChange={e => updateLineItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-sm text-center"
                          data-testid={`input-line-qty-${idx}`}
                        />
                        <Input
                          type="number" min="0" step="0.01"
                          value={item.unitPrice}
                          onChange={e => updateLineItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-sm text-right"
                          data-testid={`input-line-price-${idx}`}
                        />
                        <span className="text-sm font-medium text-right tabular-nums">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => removeLineItem(idx)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-4">
                        <Input
                          value={item.description}
                          onChange={e => updateLineItem(idx, { description: e.target.value })}
                          className="h-7 text-xs flex-1 text-muted-foreground"
                          placeholder="Optional description…"
                        />
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                          <Switch
                            checked={item.taxable}
                            onCheckedChange={v => updateLineItem(idx, { taxable: v })}
                            className="scale-75"
                            data-testid={`switch-taxable-${idx}`}
                          />
                          <span>Taxable</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pricingConfig.lineItems.length === 0 && (
                    <div className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground text-sm">
                      Add line items to build the price.
                    </div>
                  )}
                </div>
              </div>

              {/* Tax */}
              <div className="border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">Tax</h3>
                <div className="flex items-center gap-3">
                  <Select value={pricingConfig.taxConfig.type} onValueChange={setTaxType}>
                    <SelectTrigger className="w-52" data-testid="select-tax-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {pricingConfig.taxConfig.type === "custom" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min="0" step="0.1"
                        value={pricingConfig.taxConfig.rate}
                        onChange={e => setPricingConfig(p => ({ ...p, taxConfig: { ...p.taxConfig, rate: parseFloat(e.target.value) || 0, label: `Custom (${e.target.value}%)` } }))}
                        className="h-9 w-20 text-sm"
                        data-testid="input-custom-tax-rate"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subtotal override */}
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Manual Subtotal Override</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={pricingConfig.subtotalOverride != null}
                      onCheckedChange={v => setPricingConfig(p => ({ ...p, subtotalOverride: v ? lineSubtotal : null }))}
                      data-testid="switch-subtotal-override"
                    />
                    Override calculated total
                  </div>
                </div>
                {pricingConfig.subtotalOverride != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={pricingConfig.subtotalOverride}
                      onChange={e => setPricingConfig(p => ({ ...p, subtotalOverride: parseFloat(e.target.value) || 0 }))}
                      className="h-9 w-36 text-sm"
                      data-testid="input-subtotal-override"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-sm">Pricing Notes</Label>
                <Textarea
                  value={pricingConfig.notes}
                  onChange={e => setPricingConfig(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Price based on estimated square footage. May be adjusted after site visit."
                  data-testid="textarea-pricing-notes"
                />
              </div>

              {/* Summary */}
              <div className="border rounded-xl bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Line total</span><span className="tabular-nums">${lineSubtotal.toFixed(2)}</span></div>
                {pricingConfig.subtotalOverride != null && (
                  <div className="flex justify-between text-amber-700"><span>Manual override</span><span className="tabular-nums">${effectiveSubtotal.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">{pricingConfig.taxConfig.label}</span><span className="tabular-nums">${taxAmount.toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="tabular-nums">${totalAmount.toFixed(2)}</span></div>
              </div>
            </div>
          )}

          {/* ── Step 4: Terms ─────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Terms & Conditions</h2>
              <p className="text-sm text-muted-foreground">These terms will appear on the public proposal. Edit them to match your business policies.</p>
              <Textarea
                value={termsText}
                onChange={e => setTermsText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="Enter your terms and conditions…"
                data-testid="textarea-terms"
              />
            </div>
          )}

          {/* ── Step 5: Share ─────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold">Preview & Share</h2>

              {/* Public link */}
              <div className="border rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold">Shareable Link</h3>
                <div className="flex items-center gap-2">
                  <Input value={publicUrl} readOnly className="text-sm font-mono bg-muted/40" data-testid="input-public-url" />
                  <Button variant="outline" size="icon" onClick={copyLink} data-testid="button-copy-link-share">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={openPreview} data-testid="button-open-link-share">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={openPreview} data-testid="button-preview-public">
                  <Eye className="w-5 h-5" />
                  <span className="text-sm">Preview</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={copyLink} data-testid="button-copy-link-final">
                  <Copy className="w-5 h-5" />
                  <span className="text-sm">Copy Link</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setEmailDialogOpen(true)} data-testid="button-send-email-final">
                  <Mail className="w-5 h-5" />
                  <span className="text-sm">Send Email</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={printProposal} data-testid="button-print-proposal">
                  <Printer className="w-5 h-5" />
                  <span className="text-sm">Print</span>
                </Button>
              </div>

              {/* Activity log */}
              {activityLogs.length > 0 && (
                <div className="border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Activity Timeline</h3>
                  <div className="space-y-2">
                    {activityLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{formatActivity(log)}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {new Date(log.createdAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Client response info */}
              {["accepted", "rejected", "thinking"].includes(proposal.status) && (() => {
                try {
                  const cr = JSON.parse(proposal.clientResponse || "{}");
                  return (
                    <div className="border rounded-xl p-4 space-y-2 bg-muted/20">
                      <h3 className="text-sm font-semibold">Client Response</h3>
                      {cr.name && <p className="text-sm"><span className="text-muted-foreground">Name:</span> {cr.name}</p>}
                      {cr.email && <p className="text-sm"><span className="text-muted-foreground">Email:</span> {cr.email}</p>}
                      {cr.rejectionReason && <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {cr.rejectionReason}</p>}
                      {cr.note && <p className="text-sm"><span className="text-muted-foreground">Note:</span> {cr.note}</p>}
                      {cr.preferredStartDate && <p className="text-sm"><span className="text-muted-foreground">Preferred start:</span> {cr.preferredStartDate}</p>}
                      {cr.followUpDate && <p className="text-sm"><span className="text-muted-foreground">Follow-up by:</span> {cr.followUpDate}</p>}
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          )}

          {/* Step nav buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => { save(); setStep(s => Math.max(0, s - 1)); }} disabled={step === 0}>
              <ChevronLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button onClick={() => { save(); step < STEPS.length - 1 ? setStep(s => s + 1) : toast({ title: "All done! Use the Share step to send your proposal." }); }}>
              {step < STEPS.length - 1 ? <><span>Next</span><ChevronRight className="w-4 h-4 ml-1.5" /></> : <><Check className="w-4 h-4 mr-1.5" />Save & Done</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Send Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Proposal by Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client Email</Label>
              <Input
                type="email"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                placeholder="client@example.com"
                data-testid="input-send-email-address"
              />
              <p className="text-xs text-muted-foreground">The email will include a secure link to view the proposal.</p>
            </div>
            {!clientEmail && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                No client email saved. Add one in Step 1 before sending.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await save({ clientEmail: emailAddress });
                sendEmailMutation.mutate();
              }}
              disabled={sendEmailMutation.isPending || !emailAddress}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending ? "Sending…" : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
