import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare } from "lucide-react";

export default function ClientRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", requestType: "service_request", priority: "normal" });

  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/client-requests"] });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/client-requests", {
        ...data,
        clientId: user?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      toast({ title: "Request submitted" });
      setOpen(false);
      setForm({ title: "", description: "", requestType: "service_request", priority: "normal" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sorted = [...(requests || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const statusColors: Record<string, string> = {
    new: "default", open: "default", in_review: "secondary",
    scheduled: "secondary", resolved: "secondary", closed: "secondary",
  };

  return (
    <div className="p-4 pb-24 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-requests-title">Requests</h1>
          <p className="text-sm text-muted-foreground">Submit and track service requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-request"><Plus className="w-4 h-4 mr-1" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Request</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input data-testid="input-req-title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.requestType} onValueChange={v => setForm(p => ({ ...p, requestType: v }))}>
                  <SelectTrigger data-testid="select-req-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service_request">Service Request</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="issue_report">Issue Report</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="special_task">Special Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea data-testid="input-req-description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} />
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending} data-testid="button-submit-request">
                {createMut.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">No requests yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((req: any) => (
            <Card key={req.id} data-testid={`request-card-${req.id}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium">{req.title}</p>
                  <Badge variant={(statusColors[req.status] as any) || "secondary"} className="text-xs flex-shrink-0">{req.status}</Badge>
                </div>
                {req.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{req.description}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{req.requestType.replace(/_/g, " ")}</span>
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
