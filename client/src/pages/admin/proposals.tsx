import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, MoreHorizontal, Copy, Mail, Eye, Pencil, Archive, Copy as CopyIcon,
  FileText, Clock, CheckCircle2, XCircle, HelpCircle, Send, AlertCircle,
} from "lucide-react";
import type { Proposal } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Viewed", accepted: "Accepted",
  rejected: "Rejected", thinking: "Thinking", expired: "Expired",
  converted: "Converted", cancelled: "Cancelled", archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  thinking: "bg-amber-100 text-amber-700",
  expired: "bg-orange-100 text-orange-700",
  converted: "bg-teal-100 text-teal-700",
  cancelled: "bg-gray-100 text-gray-500",
  archived: "bg-gray-100 text-gray-400",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function calcTotal(pricingConfig: string): string {
  try {
    const pc = JSON.parse(pricingConfig);
    const items = pc.lineItems ?? [];
    const sub = pc.subtotalOverride != null
      ? Number(pc.subtotalOverride)
      : items.reduce((s: number, i: any) => s + (Number(i.quantity) * Number(i.unitPrice)), 0);
    const taxRate = Number(pc.taxConfig?.rate ?? 0);
    const taxableSubtotal = pc.subtotalOverride != null
      ? sub
      : items.filter((i: any) => i.taxable).reduce((s: number, i: any) => s + (Number(i.quantity) * Number(i.unitPrice)), 0);
    const tax = taxableSubtotal * (taxRate / 100);
    return `$${(sub + tax).toFixed(2)}`;
  } catch {
    return "—";
  }
}

export default function AdminProposals() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ["/api/proposals"],
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => apiRequest("POST", "/api/proposals", { title }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setNewDialogOpen(false);
      setNewTitle("");
      navigate(`/admin/proposals/${data.id}`);
    },
    onError: () => toast({ title: "Error", description: "Could not create proposal.", variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/proposals/${id}/duplicate`),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Duplicated", description: "A copy of the proposal has been created." });
      navigate(`/admin/proposals/${data.id}`);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/proposals/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Updated", description: "Proposal archive status changed." });
    },
  });

  function copyLink(p: Proposal) {
    const url = `${window.location.origin}/public/proposals/${p.publicToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Share this link with your client." });
  }

  const filtered = proposals.filter((p) => {
    if (activeTab === "all") return !p.isArchived;
    if (activeTab === "archived") return p.isArchived;
    return p.status === activeTab && !p.isArchived;
  });

  const tabCounts = {
    all: proposals.filter(p => !p.isArchived).length,
    draft: proposals.filter(p => p.status === "draft" && !p.isArchived).length,
    sent: proposals.filter(p => p.status === "sent" && !p.isArchived).length,
    viewed: proposals.filter(p => p.status === "viewed" && !p.isArchived).length,
    accepted: proposals.filter(p => p.status === "accepted" && !p.isArchived).length,
    rejected: proposals.filter(p => p.status === "rejected" && !p.isArchived).length,
    thinking: proposals.filter(p => p.status === "thinking" && !p.isArchived).length,
    archived: proposals.filter(p => p.isArchived).length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-xl font-semibold">Proposals & Quotes</h1>
          <p className="text-sm text-muted-foreground">Create and manage professional proposals for your clients</p>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} data-testid="button-new-proposal">
          <Plus className="w-4 h-4 mr-2" />
          New Proposal
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap gap-1 h-auto bg-muted/40 p-1">
            {([
              ["all", "All"],
              ["draft", "Drafts"],
              ["sent", "Sent"],
              ["viewed", "Viewed"],
              ["accepted", "Accepted"],
              ["rejected", "Rejected"],
              ["thinking", "Thinking"],
              ["archived", "Archived"],
            ] as [string, string][]).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="text-xs" data-testid={`tab-proposals-${key}`}>
                {label}
                {tabCounts[key as keyof typeof tabCounts] > 0 && (
                  <span className="ml-1.5 bg-background rounded-full px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {tabCounts[key as keyof typeof tabCounts]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No proposals yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first professional proposal to share with a client.</p>
                {activeTab === "all" && (
                  <Button onClick={() => setNewDialogOpen(true)} variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Proposal
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    data-testid={`card-proposal-${p.id}`}
                    className="flex items-center gap-4 bg-card border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors"
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {p.status === "accepted" ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : p.status === "rejected" ? <XCircle className="w-5 h-5 text-red-500" />
                        : p.status === "thinking" ? <HelpCircle className="w-5 h-5 text-amber-500" />
                        : p.status === "sent" || p.status === "viewed" ? <Send className="w-5 h-5 text-blue-500" />
                        : p.status === "expired" ? <AlertCircle className="w-5 h-5 text-orange-500" />
                        : <FileText className="w-5 h-5 text-muted-foreground" />}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-sm truncate">{p.title}</span>
                        <span className="text-xs text-muted-foreground font-mono">{p.proposalNumber}</span>
                        <Badge className={`text-[10px] h-5 px-2 ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                        {p.isArchived && <Badge variant="outline" className="text-[10px] h-5 px-2">Archived</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {p.clientName && <span>{p.clientName}{p.clientCompany ? ` · ${p.clientCompany}` : ""}</span>}
                        {p.serviceAddress && <span className="hidden sm:inline">{p.serviceAddress}</span>}
                        <span>Created {formatDate(p.createdAt)}</span>
                        {p.expiryDate && <span>Expires {formatDate(p.expiryDate)}</span>}
                        <span className="font-medium text-foreground/70">{calcTotal(p.pricingConfig)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => navigate(`/admin/proposals/${p.id}`)}
                        data-testid={`button-edit-proposal-${p.id}`}
                        className="hidden sm:flex"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => copyLink(p)}
                        data-testid={`button-copy-link-${p.id}`}
                        title="Copy link"
                        className="w-8 h-8"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8" data-testid={`button-more-${p.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/proposals/${p.id}`)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`/public/proposals/${p.publicToken}`, "_blank")}>
                            <Eye className="w-4 h-4 mr-2" /> Preview Public Page
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyLink(p)}>
                            <CopyIcon className="w-4 h-4 mr-2" /> Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(p.id)}>
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archiveMutation.mutate(p.id)}>
                            <Archive className="w-4 h-4 mr-2" />
                            {p.isArchived ? "Unarchive" : "Archive"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Proposal Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-title">Proposal Title</Label>
              <Input
                id="proposal-title"
                placeholder="e.g. Office Cleaning Proposal — ABC Company"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMutation.mutate(newTitle.trim())}
                data-testid="input-new-proposal-title"
              />
              <p className="text-xs text-muted-foreground">This will appear as the document title on the proposal.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(newTitle.trim() || "New Proposal")}
              disabled={createMutation.isPending}
              data-testid="button-create-proposal-confirm"
            >
              {createMutation.isPending ? "Creating…" : "Create & Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
