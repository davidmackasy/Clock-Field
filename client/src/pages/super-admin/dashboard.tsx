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
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";
import {
  Building2, Users, DollarSign, TrendingUp, AlertTriangle, Clock,
  Eye, Ban, CheckCircle, ShieldAlert, MessageSquare, ChevronRight,
  ArrowLeft, Send, Globe, RefreshCw, ShieldCheck, ShieldOff, CalendarClock,
  X, Timer, Activity, UserCheck, Bell, Inbox, UserPlus, BarChart2
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
  internalBypass: boolean;
  manualAccessEnabled: boolean;
  manualAccessExpiresAt: string | null;
  manualAccessGrantedBy: string | null;
  manualAccessReason: string | null;
  createdAt?: string | null;
  activatedAt?: string | null;
};

type Stats = {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  pendingBusinesses: number;
  mrr: number;
  arr: number;
};

type ActivityOverview = {
  newSignupsToday: number;
  pendingPayment: number;
  unreadBusinessMessages: number;
  totalActive: number;
  totalSuspended: number;
};

type ActivityChart = {
  days: { date: string; signups: number; active: number }[];
  funnel: { signedUp: number; pendingPayment: number; activated: number; suspended: number };
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

function isManualAccessActive(b: { manualAccessEnabled: boolean; manualAccessExpiresAt: string | null }) {
  return b.manualAccessEnabled && b.manualAccessExpiresAt && new Date() < new Date(b.manualAccessExpiresAt);
}

function daysRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  } catch { return "—"; }
}

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

function ActivityCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${bg}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SuperAdminDashboard() {
  const { user, isSuperAdmin } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [grantAccessOpen, setGrantAccessOpen] = useState(false);
  const [msgTarget, setMsgTarget] = useState<Business | null>(null);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgType, setMsgType] = useState("announcement");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newBillingCycle, setNewBillingCycle] = useState("monthly");
  const [search, setSearch] = useState("");
  const [accessDays, setAccessDays] = useState("5");
  const [accessReason, setAccessReason] = useState("");
  const [recentSort, setRecentSort] = useState<"created" | "activated">("created");

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

  const { data: recentBusinesses = [], isLoading: recentLoading } = useQuery<Business[]>({
    queryKey: ["/api/super-admin/recent-businesses", recentSort],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/recent-businesses?sort=${recentSort}&limit=15`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: activityOverview } = useQuery<ActivityOverview>({
    queryKey: ["/api/super-admin/activity-overview"],
  });

  const { data: chartData } = useQuery<ActivityChart>({
    queryKey: ["/api/super-admin/activity-chart"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/recent-businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/activity-overview"] });
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

  const handleGrantAccess = () => {
    if (!detailData) return;
    const days = parseInt(accessDays, 10);
    if (isNaN(days) || days < 1) {
      toast({ title: "Enter a valid number of days", variant: "destructive" });
      return;
    }
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    patchBiz.mutate({
      id: detailData.id,
      manualAccessEnabled: true,
      manualAccessExpiresAt: expiresAt,
      manualAccessGrantedBy: (user as any)?.id ?? "super_admin",
      manualAccessReason: accessReason.trim() || null,
    });
    setGrantAccessOpen(false);
    setAccessDays("5");
    setAccessReason("");
  };

  const handleRemoveAccess = (bizId: string) => {
    patchBiz.mutate({
      id: bizId,
      manualAccessEnabled: false,
      manualAccessExpiresAt: null,
      manualAccessGrantedBy: null,
      manualAccessReason: null,
    });
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

  const funnelData = chartData ? [
    { name: "Signed Up", value: chartData.funnel.signedUp, fill: "#6366f1" },
    { name: "Pending Payment", value: chartData.funnel.pendingPayment, fill: "#f59e0b" },
    { name: "Activated", value: chartData.funnel.activated, fill: "#10b981" },
    { name: "Suspended", value: chartData.funnel.suspended, fill: "#ef4444" },
  ] : [];

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

      {/* Business Activity Overview */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Business Activity Overview</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ActivityCard
            icon={UserPlus}
            label="New Signups Today"
            value={activityOverview?.newSignupsToday ?? 0}
            color="bg-purple-100 text-purple-700"
            bg="bg-purple-50/50 border-purple-100"
          />
          <ActivityCard
            icon={Bell}
            label="Pending Payment"
            value={activityOverview?.pendingPayment ?? 0}
            color="bg-amber-100 text-amber-700"
            bg="bg-amber-50/50 border-amber-100"
          />
          <ActivityCard
            icon={Inbox}
            label="Unread Messages"
            value={activityOverview?.unreadBusinessMessages ?? 0}
            color="bg-blue-100 text-blue-700"
            bg="bg-blue-50/50 border-blue-100"
          />
          <ActivityCard
            icon={CheckCircle}
            label="Active Businesses"
            value={activityOverview?.totalActive ?? 0}
            color="bg-green-100 text-green-700"
            bg="bg-green-50/50 border-green-100"
          />
        </div>
      </div>

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                Signups — Last 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData.days} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={v => new Date(v).toLocaleDateString()} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="signups" stroke="#7c3aed" strokeWidth={2} dot={false} name="New Signups" />
                  <Line type="monotone" dataKey="active" stroke="#10b981" strokeWidth={2} dot={false} name="Active" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                Signup & Activation Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={funnelData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Count" radius={[3, 3, 0, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main content: All Businesses (left) + Recent Businesses (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* All Businesses Table */}
        <div className="xl:col-span-2">
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
                            {b.internalBypass && (
                              <div className="mt-1">
                                <Badge className="bg-purple-100 text-purple-800 border-0 text-[10px] flex items-center gap-0.5 w-fit">
                                  <ShieldCheck className="w-2.5 h-2.5" />
                                  bypass
                                </Badge>
                              </div>
                            )}
                            {isManualAccessActive(b) && (
                              <div className="mt-1">
                                <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px] flex items-center gap-0.5 w-fit" data-testid={`badge-temp-access-${b.id}`}>
                                  <Timer className="w-2.5 h-2.5" />
                                  temp access · {daysRemaining(b.manualAccessExpiresAt!)}d left
                                </Badge>
                              </div>
                            )}
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
        </div>

        {/* Recent Businesses Panel */}
        <div className="xl:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-600" />
                  Recent Businesses
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={recentSort === "created" ? "default" : "ghost"}
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setRecentSort("created")}
                    data-testid="button-sort-newest"
                  >
                    Newest
                  </Button>
                  <Button
                    size="sm"
                    variant={recentSort === "activated" ? "default" : "ghost"}
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setRecentSort("activated")}
                    data-testid="button-sort-activated"
                  >
                    Activated
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}
                </div>
              ) : recentBusinesses.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No businesses yet</div>
              ) : (
                <div className="divide-y">
                  {recentBusinesses.map(b => (
                    <button
                      key={b.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors group"
                      onClick={() => openDetail(b)}
                      data-testid={`button-recent-business-${b.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{b.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{b.adminName}</p>
                          <p className="text-xs text-muted-foreground truncate">{b.adminEmail}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge className={`${planColors[b.planCode] || "bg-gray-100 text-gray-700"} border-0 text-[10px] mb-1`}>
                            {b.planName}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground">{formatDateShort(recentSort === "activated" ? b.activatedAt : b.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge className={`${accountStatusColors[b.accountStatus] || "bg-gray-100"} border-0 text-[10px]`}>
                          {b.accountStatus.replace("_", " ")}
                        </Badge>
                        {b.internalBypass && (
                          <Badge className="bg-purple-100 text-purple-800 border-0 text-[10px]">bypass</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                {detailData.createdAt && (
                  <div>
                    <p className="text-muted-foreground text-xs">Signed Up</p>
                    <p className="font-medium">{new Date(detailData.createdAt).toLocaleDateString()}</p>
                  </div>
                )}
                {detailData.activatedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs">Activated</p>
                    <p className="font-medium">{new Date(detailData.activatedAt).toLocaleDateString()}</p>
                  </div>
                )}
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

              {/* Standard actions */}
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
                <Button
                  size="sm"
                  variant="outline"
                  className={detailData.internalBypass ? "text-purple-700 border-purple-300 bg-purple-50" : "text-muted-foreground"}
                  onClick={() => patchBiz.mutate({ id: detailData.id, internalBypass: !detailData.internalBypass })}
                  data-testid="button-detail-bypass-toggle"
                >
                  {detailData.internalBypass
                    ? <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Remove Bypass</>
                    : <><ShieldOff className="w-3.5 h-3.5 mr-1.5" /> Grant Bypass</>
                  }
                </Button>
              </div>

              {detailData.internalBypass && (
                <div className="p-2.5 bg-purple-50 rounded-lg text-xs text-purple-700 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  Internal bypass is active — this business has full platform access regardless of subscription status.
                </div>
              )}

              <Separator />

              {/* Temporary Access Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold">Temporary Access Override</p>
                </div>

                {isManualAccessActive(detailData) ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">Temporary Access Active</span>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 border-0 text-xs" data-testid="badge-detail-temp-access-active">
                        Active
                      </Badge>
                    </div>
                    <div className="text-xs text-amber-700 space-y-0.5">
                      <p>Expires: <span className="font-medium">{new Date(detailData.manualAccessExpiresAt).toLocaleString()}</span></p>
                      <p>Days remaining: <span className="font-medium">{daysRemaining(detailData.manualAccessExpiresAt)}</span></p>
                      {detailData.manualAccessReason && (
                        <p>Reason: <span className="font-medium">{detailData.manualAccessReason}</span></p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-700 border-amber-300 hover:bg-amber-100 h-7 text-xs"
                        onClick={() => setGrantAccessOpen(true)}
                        data-testid="button-extend-temp-access"
                      >
                        <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                        Extend Access
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-50 h-7 text-xs"
                        onClick={() => handleRemoveAccess(detailData.id)}
                        disabled={patchBiz.isPending}
                        data-testid="button-remove-temp-access"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Remove Access
                      </Button>
                    </div>
                  </div>
                ) : detailData.manualAccessEnabled && detailData.manualAccessExpiresAt ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">Temporary Access Expired</span>
                      <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Expired</Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      Expired: {new Date(detailData.manualAccessExpiresAt).toLocaleString()}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                      onClick={() => setGrantAccessOpen(true)}
                      data-testid="button-regrant-temp-access"
                    >
                      <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                      Grant Access Again
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Grant this business temporary platform access without requiring subscription payment.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                      onClick={() => setGrantAccessOpen(true)}
                      data-testid="button-grant-temp-access"
                    >
                      <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                      Grant Temporary Access
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Grant Temporary Access Dialog */}
      <Dialog open={grantAccessOpen} onOpenChange={setGrantAccessOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-600" />
              Grant Temporary Access
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              The business will be able to log in and use the platform during the selected period without a paid subscription.
            </p>
            <div className="space-y-2">
              <Label className="text-sm">Duration</Label>
              <div className="flex gap-2 flex-wrap">
                {["5", "10", "30"].map(d => (
                  <Button
                    key={d}
                    size="sm"
                    variant={accessDays === d ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setAccessDays(d)}
                    data-testid={`button-days-${d}`}
                  >
                    {d} Days
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={accessDays}
                  onChange={e => setAccessDays(e.target.value)}
                  className="h-8 text-sm w-24"
                  placeholder="Days"
                  data-testid="input-access-days"
                />
                <span className="text-sm text-muted-foreground">
                  custom days
                </span>
              </div>
              {accessDays && parseInt(accessDays) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Access until: <span className="font-medium text-amber-700">
                    {new Date(Date.now() + parseInt(accessDays) * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
                      weekday: "short", month: "short", day: "numeric", year: "numeric"
                    })}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={accessReason}
                onChange={e => setAccessReason(e.target.value)}
                placeholder="e.g. Onboarding trial, support case..."
                className="h-8 text-sm"
                data-testid="input-access-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGrantAccessOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleGrantAccess}
              disabled={patchBiz.isPending || !accessDays || parseInt(accessDays) < 1}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-confirm-grant-access"
            >
              <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
              {patchBiz.isPending ? "Granting..." : `Grant ${accessDays || "?"} Days`}
            </Button>
          </DialogFooter>
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
            {!isBroadcast && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 shrink-0" />
                An email notification will also be sent to the business admin.
              </div>
            )}
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
