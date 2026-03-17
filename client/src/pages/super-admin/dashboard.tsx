import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, DollarSign, TrendingUp, AlertTriangle, Clock,
  Eye, Ban, CheckCircle, ShieldAlert, MessageSquare, ChevronRight,
  ArrowLeft, Send, Globe, RefreshCw
} from "lucide-react";

type Business = {
  id: string;
  name: string;
  planCode: string;
  planName: string;
  billingCycle: string;
  subscriptionStatus: string;
  accountStatus: string;
  employeeCount: number;
  clientCount: number;
  adminName: string;
  adminEmail: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
};

type Stats = {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  pendingBusinesses: number;
  mrr: number;
  arr: number;
};

const accountStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  suspended: "bg-yellow-100 text-yellow-800",
  disabled: "bg-red-100 text-red-800",
  banned: "bg-red-200 text-red-900",
  pending_activation: "bg-blue-100 text-blue-800",
};

const subStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-purple-100 text-purple-800",
  past_due: "bg-orange-100 text-orange-800",
  canceled: "bg-gray-100 text-gray-700",
  unpaid: "bg-red-100 text-red-800",
};

const planColors: Record<string, string> = {
  legacy: "bg-gray-100 text-gray-700",
  starter: "bg-sky-100 text-sky-800",
  growth: "bg-indigo-100 text-indigo-800",
  pro: "bg-emerald-100 text-emerald-800",
};

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color || ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboard() {
  const { user, isSuperAdmin } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [msgTarget, setMsgTarget] = useState<Business | null>(null);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgType, setMsgType] = useState("announcement");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newBillingCycle, setNewBillingCycle] = useState("monthly");
  const [search, setSearch] = useState("");

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center space-y-2">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">Super Admin access required</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")} data-testid="button-back-admin">
            Go to Admin Panel
          </Button>
        </div>
      </div>
    );
  }

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/super-admin/stats"],
  });

  const { data: businesses = [], isLoading: bizLoading } = useQuery<Business[]>({
    queryKey: ["/api/super-admin/businesses"],
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/super-admin/businesses", selectedBusiness?.id],
    enabled: detailOpen && !!selectedBusiness?.id,
  });

  const patchBiz = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/super-admin/businesses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      toast({ title: "Updated successfully" });
    },
    onError: (e: any) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ businessId, ...data }: any) => {
      const url = isBroadcast
        ? "/api/super-admin/messages/broadcast"
        : `/api/super-admin/businesses/${businessId}/message`;
      const res = await apiRequest("POST", url, { ...data, isBroadcast });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Message sent" });
      setMessageOpen(false);
      setMsgSubject("");
      setMsgBody("");
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const filteredBusinesses = businesses.filter(b =>
    !search ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
    b.adminName.toLowerCase().includes(search.toLowerCase())
  );

  const handleStatusChange = (business: Business, status: string) => {
    patchBiz.mutate({ id: business.id, accountStatus: status });
  };

  const handlePlanChange = () => {
    if (!selectedBusiness || !newPlanCode) return;
    patchBiz.mutate({
      id: selectedBusiness.id,
      planCode: newPlanCode,
      billingCycle: newBillingCycle,
    });
    setChangePlanOpen(false);
  };

  const openDetail = (b: Business) => {
    setSelectedBusiness(b);
    setDetailOpen(true);
  };

  const openMessage = (b: Business, broadcast = false) => {
    setMsgTarget(b);
    setIsBroadcast(broadcast);
    setMessageOpen(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-purple-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold">Platform Admin</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all businesses and subscriptions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openMessage({} as Business, true)}
            data-testid="button-broadcast-message"
          >
            <Globe className="w-4 h-4 mr-1.5" />
            Broadcast Message
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")} data-testid="button-back-business">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Business Admin
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard icon={Building2} label="Total Businesses" value={stats?.totalBusinesses ?? 0} />
            <StatCard icon={CheckCircle} label="Active" value={stats?.activeBusinesses ?? 0} color="text-green-600" />
            <StatCard icon={AlertTriangle} label="Suspended" value={stats?.suspendedBusinesses ?? 0} color="text-yellow-600" />
            <StatCard icon={Clock} label="Pending" value={stats?.pendingBusinesses ?? 0} color="text-blue-600" />
            <StatCard icon={DollarSign} label="MRR" value={`$${(stats?.mrr ?? 0).toLocaleString()}`} sub="Monthly recurring" />
            <StatCard icon={TrendingUp} label="ARR" value={`$${(stats?.arr ?? 0).toLocaleString()}`} sub="Annual estimate" />
          </>
        )}
      </div>

      {/* Business Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">All Businesses</CardTitle>
            <Input
              placeholder="Search by name, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64 h-8 text-sm"
              data-testid="input-search-businesses"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {bizLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No businesses found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Business</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Admin</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Plan</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Usage</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBusinesses.map(b => (
                    <tr key={b.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-business-${b.id}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.billingCycle}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.adminName}</p>
                        <p className="text-xs text-muted-foreground">{b.adminEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${planColors[b.planCode] || "bg-gray-100 text-gray-700"} border-0 font-medium text-xs`}>
                          {b.planName}
                        </Badge>
                        <div className="mt-1">
                          <Badge className={`${subStatusColors[b.subscriptionStatus] || "bg-gray-100"} border-0 text-[10px]`}>
                            {b.subscriptionStatus}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs">{b.employeeCount} emp / {b.clientCount} clients</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${accountStatusColors[b.accountStatus] || "bg-gray-100"} border-0 text-xs`}>
                          {b.accountStatus.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => openDetail(b)}
                            data-testid={`button-view-business-${b.id}`}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => openMessage(b)}
                            data-testid={`button-message-business-${b.id}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1" />
                            Msg
                          </Button>
                          {b.accountStatus === "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-yellow-700 hover:bg-yellow-50"
                              onClick={() => handleStatusChange(b, "suspended")}
                              data-testid={`button-suspend-business-${b.id}`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-green-700 hover:bg-green-50"
                              onClick={() => handleStatusChange(b, "active")}
                              data-testid={`button-activate-business-${b.id}`}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {selectedBusiness?.name}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
            </div>
          ) : detailData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Admin</p>
                  <p className="font-medium">{detailData.adminName}</p>
                  <p className="text-xs text-muted-foreground">{detailData.adminEmail}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Account Status</p>
                  <Badge className={`${accountStatusColors[detailData.accountStatus] || "bg-gray-100"} border-0 mt-1`}>
                    {detailData.accountStatus?.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Plan</p>
                  <Badge className={`${planColors[detailData.planCode] || "bg-gray-100"} border-0 mt-1`}>
                    {detailData.planName} · {detailData.billingCycle}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Subscription</p>
                  <Badge className={`${subStatusColors[detailData.subscriptionStatus] || "bg-gray-100"} border-0 mt-1`}>
                    {detailData.subscriptionStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Employees</p>
                  <p className="font-medium">{detailData.usage?.employees} / {detailData.usage?.maxEmployees}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Clients</p>
                  <p className="font-medium">{detailData.usage?.clients} / {detailData.usage?.maxClients}</p>
                </div>
                {detailData.currentPeriodEnd && (
                  <div>
                    <p className="text-muted-foreground text-xs">Period End</p>
                    <p className="font-medium">{new Date(detailData.currentPeriodEnd).toLocaleDateString()}</p>
                  </div>
                )}
                {detailData.stripeCustomerId && (
                  <div>
                    <p className="text-muted-foreground text-xs">Stripe Customer</p>
                    <p className="font-mono text-xs">{detailData.stripeCustomerId}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                {detailData.accountStatus !== "active" && (
                  <Button size="sm" variant="outline" className="text-green-700"
                    onClick={() => { patchBiz.mutate({ id: detailData.id, accountStatus: "active" }); setDetailOpen(false); }}
                    data-testid="button-detail-activate">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Activate
                  </Button>
                )}
                {detailData.accountStatus !== "suspended" && (
                  <Button size="sm" variant="outline" className="text-yellow-700"
                    onClick={() => { patchBiz.mutate({ id: detailData.id, accountStatus: "suspended" }); setDetailOpen(false); }}
                    data-testid="button-detail-suspend">
                    <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend
                  </Button>
                )}
                {detailData.accountStatus !== "disabled" && (
                  <Button size="sm" variant="outline" className="text-red-700"
                    onClick={() => { patchBiz.mutate({ id: detailData.id, accountStatus: "disabled" }); setDetailOpen(false); }}
                    data-testid="button-detail-disable">
                    <Ban className="w-3.5 h-3.5 mr-1.5" /> Disable
                  </Button>
                )}
                <Button size="sm" variant="outline"
                  onClick={() => { setChangePlanOpen(true); setNewPlanCode(detailData.planCode); setNewBillingCycle(detailData.billingCycle); }}
                  data-testid="button-detail-change-plan">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Change Plan
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => { openMessage(detailData); setDetailOpen(false); }}
                  data-testid="button-detail-message">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Send Message
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={newPlanCode} onValueChange={setNewPlanCode}>
                <SelectTrigger data-testid="select-new-plan">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legacy">Legacy (Unlimited)</SelectItem>
                  <SelectItem value="starter">Starter — $29/mo</SelectItem>
                  <SelectItem value="growth">Growth — $79/mo</SelectItem>
                  <SelectItem value="pro">Pro — $129/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing Cycle</Label>
              <Select value={newBillingCycle} onValueChange={setNewBillingCycle}>
                <SelectTrigger data-testid="select-billing-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly (10% off)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)}>Cancel</Button>
            <Button onClick={handlePlanChange} disabled={!newPlanCode} data-testid="button-confirm-plan-change">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              {isBroadcast ? "Broadcast to All Businesses" : `Message to ${msgTarget?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={msgType} onValueChange={setMsgType}>
                <SelectTrigger data-testid="select-message-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={msgSubject}
                onChange={e => setMsgSubject(e.target.value)}
                placeholder="Message subject"
                data-testid="input-message-subject"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
                rows={5}
                placeholder="Write your message..."
                data-testid="textarea-message-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendMessage.mutate({ businessId: msgTarget?.id, subject: msgSubject, body: msgBody, messageType: msgType })}
              disabled={!msgSubject.trim() || !msgBody.trim() || sendMessage.isPending}
              data-testid="button-send-message"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sendMessage.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
