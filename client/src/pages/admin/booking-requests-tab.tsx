import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Phone, Mail, MapPin, Calendar, Search, CheckCircle2, XCircle, ArrowRightCircle, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const REQUEST_STATUSES = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
  { value: "converted_to_job", label: "Converted" },
  { value: "rejected", label: "Rejected" },
];

const statusColor: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  reviewed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  converted_to_job: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  archived: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

export default function BookingRequestsTab() {
  const { toast } = useToast();
  const { companyStatus } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [detailReq, setDetailReq] = useState<any>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({
    scheduledDate: "", startTime: "", endTime: "",
    assignedEmployeeIds: [] as string[], clientId: "",
  });

  const { data: requests = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/booking-requests"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });

  const bookingFormUrl = `${window.location.origin}/public/booking/${companyStatus?.id || ""}`;

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/booking-requests/${id}`, data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      toast({ title: "Request updated" });
      setDetailReq(updated);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("POST", `/api/booking-requests/${id}/convert-to-job`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Booking converted to job!" });
      setConvertOpen(false);
      setDetailReq(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return requests
      .filter((r: any) => statusFilter === "all" || r.status === statusFilter)
      .filter((r: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q) ||
          r.serviceAddress?.toLowerCase().includes(q) || r.serviceType?.toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, statusFilter, search]);

  const copyLink = () => {
    navigator.clipboard.writeText(bookingFormUrl);
    toast({ title: "Booking form link copied!" });
  };

  return (
    <div className="space-y-4">
      {/* Booking form link banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border text-sm">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5 font-medium">Public Booking Form Link</p>
          <p className="text-xs text-muted-foreground truncate">{bookingFormUrl}</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs flex-shrink-0" onClick={copyLink} data-testid="button-copy-booking-link">
          <Copy className="w-3 h-3" /> Copy
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs flex-shrink-0" asChild>
          <a href={bookingFormUrl} target="_blank" rel="noopener noreferrer" data-testid="button-open-booking-form">
            <ExternalLink className="w-3 h-3" /> Open
          </a>
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {REQUEST_STATUSES.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            data-testid={`tab-booking-status-${s.value}`}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              statusFilter === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {s.label}
            {s.value !== "all" && (
              <span className="ml-1.5 opacity-60">
                {requests.filter((r: any) => r.status === s.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9"
          placeholder="Search requests..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-booking-search"
        />
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Inbox className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">
              {statusFilter === "all" ? "No booking requests yet." : `No requests with status "${statusFilter}".`}
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Share your booking form link above to start receiving requests from clients.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((req: any) => (
            <Card
              key={req.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setDetailReq(req)}
              data-testid={`card-booking-${req.id}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{req.name}</p>
                    {req.companyName && <p className="text-xs text-muted-foreground truncate">{req.companyName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap capitalize", statusColor[req.status] || statusColor.new)}>
                      {req.status.replace(/_/g, " ")}
                    </span>
                    {req.urgency !== "normal" && (
                      <Badge variant={req.urgency === "urgent" ? "destructive" : "default"} className="text-[10px] h-4 px-1.5 capitalize">
                        {req.urgency}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 flex-shrink-0" />{req.email}</p>
                  <p className="flex items-center gap-1.5 truncate"><Phone className="w-3 h-3 flex-shrink-0" />{req.phone}</p>
                  <p className="flex items-center gap-1.5 truncate"><MapPin className="w-3 h-3 flex-shrink-0" />{req.serviceAddress}</p>
                  <p className="flex items-center gap-1.5"><Calendar className="w-3 h-3 flex-shrink-0" />{req.preferredDate} at {req.preferredTime}</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground capitalize">{req.serviceType} · {req.frequency?.replace(/_/g, " ")}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      {detailReq && (
        <Dialog open={!!detailReq} onOpenChange={v => { if (!v) setDetailReq(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Booking Request — {detailReq.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium capitalize", statusColor[detailReq.status] || statusColor.new)}>
                  {detailReq.status.replace(/_/g, " ")}
                </span>
                {detailReq.urgency !== "normal" && (
                  <Badge variant={detailReq.urgency === "urgent" ? "destructive" : "default"} className="text-xs capitalize">
                    {detailReq.urgency}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Contact</p>
                  <p className="font-medium">{detailReq.name}</p>
                  {detailReq.companyName && <p className="text-muted-foreground text-xs">{detailReq.companyName}</p>}
                  <p className="text-muted-foreground text-xs mt-1">{detailReq.email}</p>
                  <p className="text-muted-foreground text-xs">{detailReq.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Service</p>
                  <p className="font-medium">{detailReq.serviceType}</p>
                  <p className="text-muted-foreground text-xs capitalize">{detailReq.customerType}</p>
                  <p className="text-muted-foreground text-xs capitalize">{detailReq.frequency?.replace(/_/g, " ")}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Service Address</p>
                <p className="text-sm">{detailReq.serviceAddress}{detailReq.unitOrSuite ? `, ${detailReq.unitOrSuite}` : ""}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Preferred</p>
                  <p>{detailReq.preferredDate} at {detailReq.preferredTime}</p>
                </div>
                {detailReq.alternateDate && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Alternate</p>
                    <p>{detailReq.alternateDate} at {detailReq.alternateTime}</p>
                  </div>
                )}
              </div>

              {detailReq.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Notes</p>
                  <p className="text-sm bg-muted/40 rounded-md p-3">{detailReq.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-3 flex flex-col gap-2">
                {detailReq.status === "new" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ id: detailReq.id, data: { status: "reviewed" } })}
                    data-testid="button-mark-reviewed"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark as Reviewed
                  </Button>
                )}
                {(detailReq.status === "new" || detailReq.status === "reviewed") && (
                  <Button
                    variant="outline"
                    className="w-full border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ id: detailReq.id, data: { status: "approved" } })}
                    data-testid="button-approve-booking"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                  </Button>
                )}
                {!["converted_to_job", "rejected"].includes(detailReq.status) && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setConvertForm({
                        scheduledDate: detailReq.preferredDate,
                        startTime: detailReq.preferredTime || "",
                        endTime: "",
                        assignedEmployeeIds: [],
                        clientId: detailReq.clientId || "",
                      });
                      setConvertOpen(true);
                    }}
                    data-testid="button-convert-to-job"
                  >
                    <ArrowRightCircle className="w-4 h-4 mr-1.5" /> Convert to Job
                  </Button>
                )}
                {!["rejected", "converted_to_job"].includes(detailReq.status) && (
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ id: detailReq.id, data: { status: "rejected" } })}
                    data-testid="button-reject-booking"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Reject
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Convert to Job Dialog */}
      {detailReq && (
        <Dialog open={convertOpen} onOpenChange={v => { if (!v) setConvertOpen(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Convert to Job</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                convertMutation.mutate({
                  id: detailReq.id,
                  data: { ...convertForm, title: `${detailReq.serviceType} — ${detailReq.name}` },
                });
              }}
              className="space-y-4 py-2"
            >
              <div className="space-y-2">
                <Label>Link to Existing Client (optional)</Label>
                <Select value={convertForm.clientId} onValueChange={v => setConvertForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger data-testid="select-convert-client"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" required value={convertForm.scheduledDate} onChange={e => setConvertForm(p => ({ ...p, scheduledDate: e.target.value }))} data-testid="input-convert-date" />
                </div>
                <div className="space-y-2">
                  <Label>Start *</Label>
                  <Input type="time" required value={convertForm.startTime} onChange={e => setConvertForm(p => ({ ...p, startTime: e.target.value }))} data-testid="input-convert-start" />
                </div>
                <div className="space-y-2">
                  <Label>End *</Label>
                  <Input type="time" required value={convertForm.endTime} onChange={e => setConvertForm(p => ({ ...p, endTime: e.target.value }))} data-testid="input-convert-end" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign Workers</Label>
                <div className="flex flex-wrap gap-2">
                  {employees.map((e: any) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setConvertForm(p => ({
                        ...p,
                        assignedEmployeeIds: p.assignedEmployeeIds.includes(e.id)
                          ? p.assignedEmployeeIds.filter(x => x !== e.id)
                          : [...p.assignedEmployeeIds, e.id],
                      }))}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        convertForm.assignedEmployeeIds.includes(e.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted"
                      )}
                      data-testid={`button-convert-assign-${e.id}`}
                    >
                      {e.firstName} {e.lastName}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={convertMutation.isPending} data-testid="button-confirm-convert">
                {convertMutation.isPending ? "Converting..." : "Create Job from Booking"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
