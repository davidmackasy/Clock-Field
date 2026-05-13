import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, Users, FileText, ArrowRight, Plus,
  CheckCircle2, Send, Inbox, MapPin, ChevronRight, Loader2,
} from "lucide-react";
import { Link } from "wouter";

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

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  thinking: "bg-amber-100 text-amber-700",
  expired: "bg-orange-100 text-orange-700",
  converted: "bg-teal-100 text-teal-700",
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
  return new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function AdminSalesHub() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [walkOpen, setWalkOpen] = useState(false);
  const [walkTitle, setWalkTitle] = useState("");
  const [walkSiteType, setWalkSiteType] = useState("commercial");
  const [walkAddress, setWalkAddress] = useState("");

  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalClientName, setProposalClientName] = useState("");
  const [proposalEmail, setProposalEmail] = useState("");

  const { data: submissions = [], isLoading: subLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/submissions"],
  });
  const { data: proposals = [], isLoading: propLoading } = useQuery<any[]>({
    queryKey: ["/api/proposals"],
  });
  const { data: walks = [], isLoading: walkLoading } = useQuery<any[]>({
    queryKey: ["/api/jobsite-walks"],
  });

  const createWalkMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jobsite-walks", {
      title: walkTitle.trim() || "New Site Walk",
      siteType: walkSiteType,
      notes: walkAddress.trim() || null,
    }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks"] });
      setWalkOpen(false);
      setWalkTitle(""); setWalkSiteType("commercial"); setWalkAddress("");
      navigate(`/admin/field-notes/jobsite-walks/${data.id}`);
    },
    onError: (err: any) => toast({
      title: "Could not create site walk",
      description: err?.message || "Please try again.",
      variant: "destructive",
    }),
  });

  const createProposalMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/proposals", {
      title: proposalTitle.trim() || "New Proposal",
      clientName: proposalClientName.trim(),
      clientEmail: proposalEmail.trim(),
    }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setProposalOpen(false);
      setProposalTitle(""); setProposalClientName(""); setProposalEmail("");
      navigate(`/admin/proposals/${data.id}`);
    },
    onError: (err: any) => toast({
      title: "Could not create proposal",
      description: err?.message || "Please check your details and try again.",
      variant: "destructive",
    }),
  });

  const stageCounts: Record<string, number> = {};
  (submissions as any[]).forEach(s => {
    const stage = s.pipelineStage || "new_request";
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });

  const activeProposals = (proposals as any[]).filter(p => !p.isArchived);
  const propCounts: Record<string, number> = {};
  activeProposals.forEach(p => { propCounts[p.status] = (propCounts[p.status] || 0) + 1; });

  const activeLeads = (submissions as any[]).filter(s => !["won", "lost"].includes(s.pipelineStage || "new_request")).length;
  const activeWalks = (walks as any[]).filter(w => w.status !== "completed").length;
  const acceptedProposals = propCounts["accepted"] || 0;
  const sentProposals = (propCounts["sent"] || 0) + (propCounts["viewed"] || 0);

  const recentLeads = [...(submissions as any[])].sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()).slice(0, 5);
  const recentProposals = [...activeProposals].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 5);
  const recentWalks = [...(walks as any[])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 5);

  const isLoading = subLoading || propLoading || walkLoading;

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-background flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Sales Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your full pipeline — from first request to active client</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild data-testid="button-go-to-leads">
              <Link href="/admin/sales/leads">
                <Inbox className="w-3.5 h-3.5 mr-1.5" /> Lead Inbox
              </Link>
            </Button>
            <Button size="sm" onClick={() => setProposalOpen(true)} data-testid="button-new-proposal-hub">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Proposal
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8 max-w-6xl mx-auto w-full">

        {/* Pipeline overview */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Active Leads", value: activeLeads, icon: Inbox, color: "text-blue-600 bg-blue-50", href: "/admin/sales/leads" },
              { label: "Site Walks", value: activeWalks, icon: MapPin, color: "text-violet-600 bg-violet-50", href: "/admin/sales/site-walks" },
              { label: "Proposals Sent", value: sentProposals, icon: Send, color: "text-sky-600 bg-sky-50", href: "/admin/proposals" },
              { label: "Accepted", value: acceptedProposals, icon: CheckCircle2, color: "text-green-600 bg-green-50", href: "/admin/proposals" },
            ].map(card => (
              <Link key={card.label} href={card.href}>
                <div className="border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors cursor-pointer" data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                    <card.icon className="w-4.5 h-4.5" />
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold tabular-nums">{card.value}</p>}
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Lead stage breakdown */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lead Stages</h2>
            <Link href="/admin/sales/leads">
              <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="button-view-all-leads">
                View all <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(STAGE_LABELS).map(([stageId, label]) => {
              const count = stageCounts[stageId] || 0;
              return (
                <Link key={stageId} href={`/admin/sales/leads?stage=${stageId}`}>
                  <div className="border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors cursor-pointer" data-testid={`stage-${stageId}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground truncate">{label}</span>
                      {isLoading ? <Skeleton className="h-4 w-6" /> : <span className="text-sm font-semibold tabular-nums">{count}</span>}
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${count > 0 ? "bg-primary" : ""}`}
                        style={{ width: `${Math.min(100, (count / Math.max(1, (submissions as any[]).length)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Three columns */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* Recent leads */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Leads</h2>
              <Link href="/admin/sales/leads">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {isLoading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : recentLeads.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <Inbox className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No leads yet</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" asChild>
                  <Link href="/admin/sales/leads">Open Lead Inbox</Link>
                </Button>
              </div>
            ) : recentLeads.map(sub => (
              <div
                key={sub.id}
                className="border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/sales/leads/${sub.id}`)}
                data-testid={`lead-card-${sub.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium truncate">{sub.clientName || "Unknown"}</span>
                  <Badge className={`text-[10px] h-4 px-1.5 flex-shrink-0 ${STAGE_COLORS[sub.pipelineStage || "new_request"] || "bg-gray-100 text-gray-600"}`}>
                    {STAGE_LABELS[sub.pipelineStage || "new_request"] || sub.pipelineStage}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub.serviceType || sub.serviceAddress || "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(sub.submittedAt)}</p>
              </div>
            ))}
          </div>

          {/* Recent walks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Walks</h2>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setWalkOpen(true)} data-testid="button-new-walk-hub">
                <Plus className="w-3 h-3" /> New
              </Button>
            </div>
            {isLoading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : recentWalks.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <MapPin className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No site walks yet. Start a walkthrough from a lead or create one manually.</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setWalkOpen(true)} data-testid="button-start-walk-empty">
                  Start Site Walk
                </Button>
              </div>
            ) : recentWalks.map(walk => (
              <div key={walk.id} className="border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/admin/field-notes/jobsite-walks/${walk.id}`)} data-testid={`walk-card-${walk.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium truncate">{walk.title || "Untitled Walk"}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex-shrink-0 capitalize">{walk.status}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{(walk.siteType || "").replace(/_/g, " ")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(walk.createdAt)}</p>
              </div>
            ))}
          </div>

          {/* Recent proposals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Proposals</h2>
              <Link href="/admin/proposals">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {isLoading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : recentProposals.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <FileText className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No proposals yet. Create a draft from a lead, site walk, or existing client.</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setProposalOpen(true)} data-testid="button-create-proposal-empty">
                  Create Proposal
                </Button>
              </div>
            ) : recentProposals.map(p => (
              <div key={p.id} className="border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/admin/proposals/${p.id}`)} data-testid={`proposal-card-${p.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium truncate">{p.title}</span>
                  <Badge className={`text-[10px] h-4 px-1.5 flex-shrink-0 ${PROPOSAL_STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>{p.status}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.clientName || "No client"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(p.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <section className="border rounded-xl p-5 bg-card">
          <h2 className="text-sm font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/admin/sales/leads">
              <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2" data-testid="quick-action-lead-inbox">
                <Inbox className="w-5 h-5 text-blue-500" />
                <span className="text-xs">Lead Inbox</span>
              </Button>
            </Link>
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2" onClick={() => setWalkOpen(true)} data-testid="quick-action-new-walk">
              <MapPin className="w-5 h-5 text-violet-500" />
              <span className="text-xs">New Site Walk</span>
            </Button>
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2" onClick={() => setProposalOpen(true)} data-testid="quick-action-new-proposal">
              <FileText className="w-5 h-5 text-sky-500" />
              <span className="text-xs">New Proposal</span>
            </Button>
            <Link href="/admin/clients">
              <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2" data-testid="quick-action-clients">
                <Users className="w-5 h-5 text-green-500" />
                <span className="text-xs">Clients</span>
              </Button>
            </Link>
          </div>
        </section>
      </div>

      {/* New Site Walk Dialog */}
      <Dialog open={walkOpen} onOpenChange={o => { if (!o) { setWalkOpen(false); setWalkTitle(""); setWalkSiteType("commercial"); setWalkAddress(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-500" /> New Site Walk
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Walk Title</Label>
              <Input
                placeholder="e.g. Office Walkthrough — Acme Corp"
                value={walkTitle}
                onChange={e => setWalkTitle(e.target.value)}
                data-testid="input-walk-title-modal"
                onKeyDown={e => e.key === "Enter" && !createWalkMutation.isPending && createWalkMutation.mutate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Site Type</Label>
              <Select value={walkSiteType} onValueChange={setWalkSiteType}>
                <SelectTrigger data-testid="select-walk-sitetype-modal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Service Address <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="e.g. 123 Main St, Winnipeg"
                value={walkAddress}
                onChange={e => setWalkAddress(e.target.value)}
                data-testid="input-walk-address-modal"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createWalkMutation.mutate()}
              disabled={createWalkMutation.isPending}
              data-testid="button-start-walk-modal"
            >
              {createWalkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
              Start Walk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Proposal Dialog */}
      <Dialog open={proposalOpen} onOpenChange={o => { if (!o) { setProposalOpen(false); setProposalTitle(""); setProposalClientName(""); setProposalEmail(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-500" /> New Proposal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Proposal Title</Label>
              <Input
                placeholder="e.g. Commercial Cleaning Proposal — Acme Corp"
                value={proposalTitle}
                onChange={e => setProposalTitle(e.target.value)}
                data-testid="input-proposal-title-modal"
                onKeyDown={e => e.key === "Enter" && !createProposalMutation.isPending && createProposalMutation.mutate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Client Name <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="e.g. John Smith"
                value={proposalClientName}
                onChange={e => setProposalClientName(e.target.value)}
                data-testid="input-proposal-client-modal"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Client Email <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="email"
                placeholder="e.g. john@company.com"
                value={proposalEmail}
                onChange={e => setProposalEmail(e.target.value)}
                data-testid="input-proposal-email-modal"
              />
            </div>
            <p className="text-xs text-muted-foreground">The proposal will be saved as a draft. You can fill in the full scope, pricing, and send it from the proposal editor.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createProposalMutation.mutate()}
              disabled={createProposalMutation.isPending || !proposalTitle.trim()}
              data-testid="button-create-proposal-modal"
            >
              {createProposalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
