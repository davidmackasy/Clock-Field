import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Building2, FileText,
  Footprints, CheckCircle2, XCircle, Clock, Send, UserPlus, Loader2,
  Tag, Globe, Clipboard, MessageSquare,
} from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  new_request: "New Request",
  estimated: "Estimated",
  needs_review: "Needs Review",
  quote_ready: "Quote Ready",
  quote_sent: "Quote Sent",
  follow_up: "Follow Up",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  new_request: "bg-blue-100 text-blue-700",
  estimated: "bg-purple-100 text-purple-700",
  needs_review: "bg-yellow-100 text-yellow-700",
  quote_ready: "bg-orange-100 text-orange-700",
  quote_sent: "bg-sky-100 text-sky-700",
  follow_up: "bg-pink-100 text-pink-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-gray-100 text-gray-500",
};

const SITE_TYPES = [
  { value: "commercial", label: "Commercial Office" },
  { value: "restaurant", label: "Restaurant / Food Service" },
  { value: "medical", label: "Medical / Healthcare" },
  { value: "residential", label: "Residential Home" },
  { value: "industrial", label: "Industrial / Warehouse" },
  { value: "retail", label: "Retail / Storefront" },
  { value: "other", label: "Other" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function AdminSalesLeadDetail() {
  const { leadId } = useParams<{ leadId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [walkOpen, setWalkOpen] = useState(false);
  const [walkTitle, setWalkTitle] = useState("");
  const [walkSiteType, setWalkSiteType] = useState("commercial");

  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");

  const { data: sub, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/submissions", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/submissions/${leadId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const stageMutation = useMutation({
    mutationFn: (stage: string) => apiRequest("PATCH", `/api/admin/submissions/${leadId}`, { pipelineStage: stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions", leadId] });
      toast({ title: "Stage updated." });
    },
  });

  const createWalkMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jobsite-walks", {
      submissionId: leadId,
      title: walkTitle.trim() || `Walk — ${sub?.clientName || "Lead"}`,
      siteType: walkSiteType,
    }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks"] });
      stageMutation.mutate("quote_ready");
      setWalkOpen(false);
      navigate(`/admin/field-notes/jobsite-walks/${data.id}`);
    },
    onError: (err: any) => toast({
      title: "Could not start walk",
      description: err?.message || "Please try again.",
      variant: "destructive",
    }),
  });

  const createProposalMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/proposals", {
      title: proposalTitle.trim() || `Proposal — ${sub?.clientName || "Lead"}`,
      clientName: sub?.clientName || `${sub?.firstName || ""} ${sub?.lastName || ""}`.trim(),
      clientEmail: sub?.email || "",
      clientPhone: sub?.phone || "",
      serviceAddress: sub?.serviceAddress || "",
    }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setProposalOpen(false);
      navigate(`/admin/proposals/${data.id}`);
    },
    onError: (err: any) => toast({
      title: "Could not create proposal",
      description: err?.message || "Please try again.",
      variant: "destructive",
    }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Lead not found.</p>
        <Button variant="outline" onClick={() => navigate("/admin/sales/leads")}>Back to Lead Inbox</Button>
      </div>
    );
  }

  const stage = sub.pipelineStage || "new_request";
  const data = sub.data || {};
  const clientName = sub.clientName || `${sub.firstName || ""} ${sub.lastName || ""}`.trim() || "Unknown";

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin/sales/leads")} data-testid="button-back-to-leads">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{clientName}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {sub.companyName && <span className="text-xs text-muted-foreground">{sub.companyName}</span>}
              <Badge className={`text-[10px] h-4 px-1.5 ${STAGE_COLORS[stage] || "bg-gray-100"}`}>
                {STAGE_LABELS[stage] || stage}
              </Badge>
              <span className="text-xs text-muted-foreground">{fmtDate(sub.submittedAt)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setWalkTitle(`Walk — ${clientName}`); setWalkOpen(true); }} data-testid="button-start-walk-lead">
            <Footprints className="w-3.5 h-3.5" /> Start Site Walk
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setProposalTitle(`Proposal — ${clientName}`); setProposalOpen(true); }} data-testid="button-create-proposal-lead">
            <FileText className="w-3.5 h-3.5" /> Create Proposal
          </Button>
          {sub.email && (
            <Button size="sm" variant="outline" className="gap-1.5" asChild data-testid="button-email-lead">
              <a href={`mailto:${sub.email}`}><Mail className="w-3.5 h-3.5" /> Send Email</a>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Stage mover */}
          <div className="border rounded-xl bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Pipeline Stage</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STAGE_LABELS).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => stageMutation.mutate(s)}
                  disabled={stageMutation.isPending}
                  data-testid={`stage-btn-${s}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    stage === s
                      ? STAGE_COLORS[s] + " ring-2 ring-offset-1 ring-current/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div className="border rounded-xl bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4 text-muted-foreground" /> Contact Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow icon={UserPlus} label="Name" value={clientName} />
              <InfoRow icon={Building2} label="Company" value={sub.companyName} />
              <InfoRow icon={Mail} label="Email" value={sub.email} />
              <InfoRow icon={Phone} label="Phone" value={sub.phone} />
              <InfoRow icon={MapPin} label="Service Address" value={sub.serviceAddress || data.serviceAddress} />
              <InfoRow icon={Globe} label="Lead Source" value={sub.formName} />
              <InfoRow icon={Calendar} label="Submitted" value={fmtDate(sub.submittedAt)} />
            </div>
          </div>

          {/* Service info */}
          {(data.serviceType || data.serviceAddress || data.propertyCategory || data.sqft || data.cleaningFrequency) && (
            <div className="border rounded-xl bg-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clipboard className="w-4 h-4 text-muted-foreground" /> Service Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoRow icon={Clipboard} label="Service Type" value={data.serviceType} />
                <InfoRow icon={Building2} label="Property Type" value={data.propertyCategory} />
                <InfoRow icon={FileText} label="Frequency" value={data.cleaningFrequency} />
                <InfoRow icon={MapPin} label="Property Sq Ft" value={data.sqft ? `${data.sqft} sq ft` : undefined} />
                <InfoRow icon={Clock} label="Preferred Time" value={data.preferredTime} />
                <InfoRow icon={Calendar} label="Preferred Date" value={data.preferredDate} />
              </div>
              {data.specialRequests && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Special Requests</p>
                  <p className="text-sm">{data.specialRequests}</p>
                </div>
              )}
            </div>
          )}

          {/* AI Estimate */}
          {sub.estimate && (
            <div className="border rounded-xl bg-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Send className="w-4 h-4 text-muted-foreground" /> AI Estimate</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Monthly", value: sub.estimate.monthlyPrice ? `$${sub.estimate.monthlyPrice}` : null },
                  { label: "Per Visit", value: sub.estimate.perVisitPrice ? `$${sub.estimate.perVisitPrice}` : null },
                  { label: "Labor Hours", value: sub.estimate.laborHours ? `${sub.estimate.laborHours}h` : null },
                  { label: "Confidence", value: sub.estimate.confidenceLevel },
                ].filter(i => i.value).map(item => (
                  <div key={item.label} className="text-center rounded-lg bg-muted/50 p-3">
                    <p className="text-sm font-bold">{item.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
              {sub.estimate.suggestedServices && (
                <p className="mt-3 text-xs bg-purple-50 text-purple-800 rounded-lg p-2">{sub.estimate.suggestedServices}</p>
              )}
              {sub.estimate.riskNotes && (
                <p className="mt-2 text-xs bg-yellow-50 text-yellow-700 rounded-lg p-2">{sub.estimate.riskNotes}</p>
              )}
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Mark Won", icon: CheckCircle2, color: "text-green-600", stage: "won" },
              { label: "Mark Lost", icon: XCircle, color: "text-red-500", stage: "lost" },
              { label: "Follow Up", icon: Clock, color: "text-amber-600", stage: "follow_up" },
              { label: "Quote Sent", icon: Send, color: "text-sky-600", stage: "quote_sent" },
            ].map(action => (
              <Button
                key={action.stage}
                variant="outline"
                size="sm"
                className={`gap-1.5 ${action.color}`}
                disabled={stageMutation.isPending || stage === action.stage}
                onClick={() => stageMutation.mutate(action.stage)}
                data-testid={`button-mark-${action.stage}`}
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Start Walk Dialog */}
      <Dialog open={walkOpen} onOpenChange={o => !o && setWalkOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-violet-500" /> Start Site Walk
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Walk Title</Label>
              <Input
                value={walkTitle}
                onChange={e => setWalkTitle(e.target.value)}
                placeholder="e.g. Site Walk — Acme Corp"
                data-testid="input-walk-title-lead"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Site Type</Label>
              <Select value={walkSiteType} onValueChange={setWalkSiteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              This walk will be linked to the lead for <strong>{clientName}</strong>. You'll be able to add photos and measurements during the walkthrough.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkOpen(false)}>Cancel</Button>
            <Button onClick={() => createWalkMutation.mutate()} disabled={createWalkMutation.isPending} data-testid="button-confirm-walk">
              {createWalkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Footprints className="w-4 h-4 mr-2" />}
              Start Walk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Proposal Dialog */}
      <Dialog open={proposalOpen} onOpenChange={o => !o && setProposalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-500" /> Create Proposal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Proposal Title</Label>
              <Input
                value={proposalTitle}
                onChange={e => setProposalTitle(e.target.value)}
                placeholder="e.g. Commercial Cleaning Proposal"
                data-testid="input-proposal-title-lead"
              />
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>Client info will be pre-filled from this lead:</p>
              {sub.email && <p className="font-medium text-foreground">{sub.email}</p>}
              {(sub.serviceAddress || data.serviceAddress) && <p className="font-medium text-foreground">{sub.serviceAddress || data.serviceAddress}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposalOpen(false)}>Cancel</Button>
            <Button onClick={() => createProposalMutation.mutate()} disabled={createProposalMutation.isPending || !proposalTitle.trim()} data-testid="button-confirm-proposal">
              {createProposalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
