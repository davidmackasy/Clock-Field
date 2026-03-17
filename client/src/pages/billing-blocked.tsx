import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CreditCard, RefreshCw, LogOut, Clock, ArrowRight, CheckCircle } from "lucide-react";

const statusMessages: Record<string, { title: string; body: string; severity: "warning" | "error" }> = {
  past_due: {
    title: "Payment past due",
    body: "Your last payment failed. Please update your payment method to restore access to your account.",
    severity: "warning",
  },
  canceled: {
    title: "Subscription canceled",
    body: "Your subscription has been canceled. Choose a plan below to reactivate your account.",
    severity: "error",
  },
  unpaid: {
    title: "Invoice unpaid",
    body: "An unpaid invoice is blocking your account. Please settle your balance to continue.",
    severity: "error",
  },
  suspended: {
    title: "Account suspended",
    body: "Your account has been suspended. Please contact support for assistance.",
    severity: "error",
  },
  disabled: {
    title: "Account disabled",
    body: "Your account has been disabled. Please contact support.",
    severity: "error",
  },
  pending_subscription: {
    title: "Subscription required",
    body: "A valid subscription is required to access ClockField. Choose a plan to get started.",
    severity: "warning",
  },
};

export default function BillingBlockedPage() {
  const { user, logout, companyStatus } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const status = companyStatus?.subscriptionStatus || companyStatus?.accountStatus || "unknown";
  const messageConfig = statusMessages[status] ||
    statusMessages[companyStatus?.accountStatus ?? ""] || {
    title: "Account access restricted",
    body: "Your account access is currently restricted. Please contact support or update your billing.",
    severity: "error" as const,
  };

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast({ title: "Could not open billing portal", description: e.message, variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/checkout", {
        planCode: "starter",
        billingCycle: "monthly",
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast({ title: "Checkout failed", description: e.message, variant: "destructive" }),
  });

  // Sync directly from Stripe — for users who paid but status didn't update
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/sync", {});
      return res.json();
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/company"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/plan"] });
      if (result.updated && result.subscriptionStatus === "active") {
        toast({ title: "Subscription confirmed!", description: "Your account is now active." });
        setTimeout(() => navigate("/admin"), 800);
      } else {
        toast({
          title: "Subscription status checked",
          description: result.message || "No active subscription found. Please subscribe to continue.",
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => toast({ title: "Could not check subscription", description: e.message, variant: "destructive" }),
  });

  const isResubscribeFlow = status === "canceled" || status === "pending_subscription";
  const hasBillingLink = !!companyStatus?.stripeCustomerId;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">ClockField</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} data-testid="button-blocked-logout">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-5">
          {/* Status card */}
          <Card className={`border-2 ${messageConfig.severity === "error" ? "border-destructive/30" : "border-yellow-300"}`}>
            <CardContent className="pt-6 pb-6 text-center space-y-3">
              <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${messageConfig.severity === "error" ? "bg-destructive/10" : "bg-yellow-100"}`}>
                <AlertTriangle className={`w-7 h-7 ${messageConfig.severity === "error" ? "text-destructive" : "text-yellow-600"}`} />
              </div>
              <div>
                <h1 className="font-bold text-xl">{messageConfig.title}</h1>
                <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{messageConfig.body}</p>
              </div>
              {companyStatus && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    Status: {companyStatus.subscriptionStatus || "—"}
                  </Badge>
                  {companyStatus.planCode && companyStatus.planCode !== "pending" && (
                    <Badge variant="outline" className="text-xs capitalize">
                      Plan: {companyStatus.planCode}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account info */}
          {user && (
            <p className="text-center text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{user.email}</span>
              {companyStatus?.name && <> · {companyStatus.name}</>}
            </p>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {isResubscribeFlow ? (
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate("/subscribe")}
                data-testid="button-choose-plan"
              >
                Choose a plan
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <>
                {hasBillingLink && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid="button-manage-billing"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {portalMutation.isPending ? "Opening billing portal..." : "Update payment method"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-resubscribe"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {checkoutMutation.isPending ? "Loading..." : "Resubscribe"}
                </Button>
              </>
            )}

            {/* Already paid? Check subscription status */}
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-check-subscription"
            >
              <CheckCircle className={`w-3.5 h-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Checking…" : "Already paid? Check my subscription"}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Need help? Contact support and we'll get your account sorted quickly.
          </p>
        </div>
      </div>
    </div>
  );
}
