import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, Lock, CreditCard, ArrowUpRight, Users, Building2,
  Calendar, Zap, FileText, ClipboardList, BookOpen, DollarSign,
  BarChart2, TrendingUp
} from "lucide-react";

type PlanData = {
  plan: {
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxClients: number;
    maxEmployees: number;
    features: Record<string, boolean>;
  };
  company: {
    planCode: string;
    billingCycle: string;
    subscriptionStatus: string;
    accountStatus: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
  };
  usage: {
    employees: number;
    clients: number;
  };
};

const PLANS = [
  {
    code: "starter",
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: Math.round(29 * 12 * 0.9),
    maxClients: 5,
    maxEmployees: 2,
    highlight: false,
    features: ["Attendance tracking", "Employee login", "Client portal", "Up to 2 employees", "Up to 5 clients"],
    locked: ["Timesheets", "Work Log", "Payroll", "Reports & Exports", "Requests"],
  },
  {
    code: "growth",
    name: "Growth",
    monthlyPrice: 79,
    yearlyPrice: Math.round(79 * 12 * 0.9),
    maxClients: 10,
    maxEmployees: 5,
    highlight: true,
    features: ["Attendance tracking", "Employee login", "Client portal", "Timesheets", "Requests", "Reports & Exports", "Up to 5 employees", "Up to 10 clients"],
    locked: ["Work Log", "Payroll Estimator"],
  },
  {
    code: "pro",
    name: "Pro",
    monthlyPrice: 129,
    yearlyPrice: Math.round(129 * 12 * 0.9),
    maxClients: 15,
    maxEmployees: 10,
    highlight: false,
    features: ["Everything in Growth", "Work Log", "Payroll Estimator", "Up to 10 employees", "Up to 15 clients", "All features unlocked"],
    locked: [],
  },
];

const featureIcons: Record<string, any> = {
  attendance: ClipboardList,
  employeeLogin: Users,
  clientPortal: Building2,
  requests: FileText,
  timesheets: Calendar,
  worklog: BookOpen,
  payroll: DollarSign,
  exports: BarChart2,
  reports: TrendingUp,
};

const featureLabels: Record<string, string> = {
  attendance: "Attendance Tracking",
  employeeLogin: "Employee Login",
  clientPortal: "Client Portal",
  requests: "Client Requests",
  timesheets: "Timesheets",
  worklog: "Work Log",
  payroll: "Payroll Estimator",
  exports: "Spreadsheet Exports",
  reports: "Reports",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-purple-100 text-purple-800",
  past_due: "bg-orange-100 text-orange-800",
  canceled: "bg-gray-100 text-gray-600",
  unpaid: "bg-red-100 text-red-800",
};

export default function AdminSubscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data, isLoading } = useQuery<PlanData>({
    queryKey: ["/api/admin/plan"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ planCode, billingCycle: cycle }: { planCode: string; billingCycle: string }) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { planCode, billingCycle: cycle });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast({ title: "Checkout failed", description: e.message, variant: "destructive" }),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast({ title: "Failed to open billing portal", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const plan = data?.plan;
  const company = data?.company;
  const usage = data?.usage;
  const isLegacy = plan?.code === "legacy";

  const employeePct = plan && usage ? Math.min(100, (usage.employees / plan.maxEmployees) * 100) : 0;
  const clientPct = plan && usage ? Math.min(100, (usage.clients / plan.maxClients) * 100) : 0;
  const overEmployees = plan && usage ? usage.employees > plan.maxEmployees : false;
  const overClients = plan && usage ? usage.clients > plan.maxClients : false;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Subscription & Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your plan and billing</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Current Plan: {plan?.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {isLegacy
                  ? "Legacy account — unlimited access to all features"
                  : company?.billingCycle === "yearly"
                    ? `$${plan?.yearlyPrice}/year — billed annually (10% discount)`
                    : `$${plan?.monthlyPrice}/month — billed monthly`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {company?.subscriptionStatus && (
                <Badge className={`${statusColors[company.subscriptionStatus] || "bg-gray-100"} border-0`}>
                  {company.subscriptionStatus}
                </Badge>
              )}
              {!isLegacy && company?.stripeCustomerId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  data-testid="button-manage-billing"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Manage Billing
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {company?.currentPeriodEnd && !isLegacy && (
            <p className="text-sm text-muted-foreground">
              {company.cancelAtPeriodEnd
                ? `Cancels on ${new Date(company.currentPeriodEnd).toLocaleDateString()}`
                : `Renews on ${new Date(company.currentPeriodEnd).toLocaleDateString()}`}
            </p>
          )}

          <Separator />

          {/* Usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Employees</span>
                <span className={overEmployees ? "text-red-600 font-medium" : ""}>
                  {usage?.employees ?? 0} / {isLegacy ? "∞" : plan?.maxEmployees}
                </span>
              </div>
              {!isLegacy && (
                <Progress value={employeePct} className={`h-2 ${overEmployees ? "[&>div]:bg-red-500" : ""}`} />
              )}
              {overEmployees && <p className="text-xs text-red-600">Over limit — new employees cannot be added</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Clients</span>
                <span className={overClients ? "text-red-600 font-medium" : ""}>
                  {usage?.clients ?? 0} / {isLegacy ? "∞" : plan?.maxClients}
                </span>
              </div>
              {!isLegacy && (
                <Progress value={clientPct} className={`h-2 ${overClients ? "[&>div]:bg-red-500" : ""}`} />
              )}
              {overClients && <p className="text-xs text-red-600">Over limit — new clients cannot be added</p>}
            </div>
          </div>

          {/* Feature Access */}
          {plan?.features && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3">Feature Access</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(plan.features).map(([key, enabled]) => {
                    const Icon = featureIcons[key] || Zap;
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                          enabled ? "bg-green-50 text-green-800" : "bg-muted/50 text-muted-foreground"
                        }`}
                        data-testid={`feature-${key}`}
                      >
                        {enabled
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          : <Lock className="w-3.5 h-3.5 shrink-0" />
                        }
                        <span className="text-xs font-medium">{featureLabels[key] || key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Plans */}
      {!isLegacy && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold">Available Plans</h2>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${billingCycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setBillingCycle("monthly")}
                data-testid="toggle-billing-monthly"
              >
                Monthly
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${billingCycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setBillingCycle("yearly")}
                data-testid="toggle-billing-yearly"
              >
                Yearly
                <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">-10%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(p => {
              const isCurrent = p.code === plan?.code;
              const isHigher = p.monthlyPrice > (plan?.monthlyPrice ?? 0);
              const price = billingCycle === "yearly" ? p.yearlyPrice : p.monthlyPrice * 12;
              const monthlyEquiv = billingCycle === "yearly" ? Math.round(p.yearlyPrice / 12) : p.monthlyPrice;

              return (
                <Card key={p.code} className={`relative ${p.highlight ? "ring-2 ring-primary" : ""} ${isCurrent ? "bg-primary/5" : ""}`}>
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 right-3">
                      <span className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-full">Current</span>
                    </div>
                  )}
                  <CardContent className="pt-6 pb-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-base">{p.name}</h3>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold">${monthlyEquiv}</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                      {billingCycle === "yearly" && (
                        <p className="text-xs text-muted-foreground">${price}/year, billed annually</p>
                      )}
                    </div>

                    <ul className="space-y-1.5 text-sm">
                      {p.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-foreground">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          {f}
                        </li>
                      ))}
                      {p.locked.map(f => (
                        <li key={f} className="flex items-center gap-2 text-muted-foreground">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : p.highlight ? "default" : "outline"}
                      disabled={isCurrent || checkoutMutation.isPending}
                      onClick={() => checkoutMutation.mutate({ planCode: p.code, billingCycle })}
                      data-testid={`button-select-plan-${p.code}`}
                    >
                      {isCurrent ? "Current Plan" : isHigher ? (
                        <><ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />Upgrade</>
                      ) : "Switch Plan"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
