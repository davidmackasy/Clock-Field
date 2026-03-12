import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, X } from "lucide-react";

const OPEN_STATUSES = new Set(["new", "open", "in_review", "scheduled"]);

export default function AdminRequests() {
  const { toast } = useToast();
  const search_ = useSearch();
  const initParams = new URLSearchParams(search_);
  const initStatus = initParams.get("status") === "open" ? "open" : "all";

  const [statusFilter, setStatusFilter] = useState<string>(initStatus);

  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/client-requests"] });
  const { data: clientsList } = useQuery<any[]>({ queryKey: ["/api/clients"] });

  const updateMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/client-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      toast({ title: "Status updated" });
    },
  });

  const clientMap = new Map((clientsList || []).map(c => [c.id, c]));

  const filtered = [...(requests || [])]
    .filter(r => {
      if (statusFilter === "open") return OPEN_STATUSES.has(r.status);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const statusColors: Record<string, string> = {
    new: "default",
    open: "default",
    in_review: "secondary",
    scheduled: "secondary",
    resolved: "secondary",
    closed: "secondary",
  };

  const priorityColors: Record<string, string> = {
    low: "secondary",
    normal: "secondary",
    high: "destructive",
    urgent: "destructive",
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-requests-title">Client Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} of {requests?.length || 0} requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="select-requests-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open / Pending</SelectItem>
            </SelectContent>
          </Select>
          {statusFilter !== "all" && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setStatusFilter("all")} data-testid="button-clear-requests-filter">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">
              {statusFilter === "open" ? "No open requests" : "No requests yet"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter === "open" ? "All requests have been resolved" : "Requests from clients will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const client = clientMap.get(req.clientId);
            return (
              <Card key={req.id} data-testid={`card-request-${req.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-sm">{req.title}</p>
                        <Badge variant={(statusColors[req.status] as any) || "secondary"} className="text-xs">{req.status}</Badge>
                        <Badge variant={(priorityColors[req.priority] as any) || "secondary"} className="text-xs">{req.priority}</Badge>
                      </div>
                      {req.description && <p className="text-sm text-muted-foreground line-clamp-2">{req.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>{client?.name || "Unknown client"}</span>
                        <span>{req.requestType.replace(/_/g, " ")}</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Select value={req.status} onValueChange={v => updateMut.mutate({ id: req.id, status: v })}>
                      <SelectTrigger className="w-32" data-testid={`select-status-${req.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["new", "open", "in_review", "scheduled", "resolved", "closed"].map(s => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
