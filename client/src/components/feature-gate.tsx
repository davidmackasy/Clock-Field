import type { ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowUpRight, Zap } from "lucide-react";
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
  jobs: "Jobs & Bookings",
};

const featureUpgradeMap: Record<string, string> = {
  timesheets: "Growth",
  requests: "Growth",
  exports: "Growth",
  reports: "Growth",
  worklog: "Pro",
  payroll: "Pro",
};

const upgradeMessages: Record<string, string> = {
  timesheets: "Timesheets are available on Growth and Pro plans. Upgrade to track employee hours accurately across pay periods.",
  requests: "Client Requests are available on Growth and Pro plans. Upgrade to let clients submit and track service requests.",
  exports: "Spreadsheet Exports are available on Growth and Pro plans. Upgrade to download reports as Excel files.",
  reports: "Reports are available on Growth and Pro plans. Upgrade to access detailed business analytics.",
  worklog: "Work Log is available on the Pro plan. Upgrade to keep detailed proof-of-work records for every job.",
  payroll: "Payroll Estimator is available on the Pro plan. Upgrade to calculate payroll estimates from your attendance data.",
};

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
}

export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { companyStatus } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: planData } = useQuery<any>({
    queryKey: ["/api/admin/plan"],
    staleTime: 60_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planCode: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout", {
        planCode,
        billingCycle: "monthly",
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast({ title: "Checkout failed", description: e.message, variant: "destructive" }),
  });

  // Legacy plan or internal bypass → always grant
  if (companyStatus?.planCode === "legacy" || companyStatus?.internalBypass) {
    return <>{children}</>;
  }

  // Check feature access from plan data
  const featureEnabled = planData?.plan?.features?.[feature];

  if (featureEnabled !== false) {
    // Feature is enabled or plan data not loaded yet
    return <>{children}</>;
  }

  const label = featureLabels[feature] || feature;
  const upgradeTarget = featureUpgradeMap[feature] || "Growth";
  const upgradeCode = upgradeTarget === "Pro" ? "pro" : "growth";
  const message = upgradeMessages[feature] || `${label} is not available on your current plan.`;

  return (
    <div className="flex items-center justify-center h-full min-h-[60vh] p-6">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{label}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        </div>
        <Card className="text-left">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Required: {upgradeTarget} plan</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {upgradeTarget === "Growth" ? "Starting at $79/month" : "Starting at $129/month"} ·{" "}
              10% off with yearly billing
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => checkoutMutation.mutate(upgradeCode)}
            disabled={checkoutMutation.isPending}
            data-testid={`button-upgrade-${feature}`}
          >
            <ArrowUpRight className="w-4 h-4 mr-1.5" />
            Upgrade to {upgradeTarget}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/subscription")}
            data-testid="button-view-plans"
          >
            View all plans
          </Button>
        </div>
      </div>
    </div>
  );
}
