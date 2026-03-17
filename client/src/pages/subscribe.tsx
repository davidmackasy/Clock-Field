import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, Clock, Users, Building2, Calendar, ClipboardList,
  DollarSign, ScrollText, BookOpen, FileText, BarChart2, LogOut,
  Zap, ArrowRight, Star
} from "lucide-react";

const PLANS = [
  {
    code: "starter",
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: Math.round(29 * 12 * 0.9),
    highlight: false,
    tagline: "Perfect for small teams getting started",
    limits: "Up to 2 employees · Up to 5 clients",
    included: [
      "Employee clock-in / clock-out",
      "Attendance tracking",
      "Shift scheduling (unlimited)",
      "Employee mobile access",
      "Client portal access",
      "Hour tracking",
    ],
    locked: ["Timesheets", "Work Log", "Payroll Estimator", "Exports & Reports", "Client Requests"],
  },
  {
    code: "growth",
    name: "Growth",
    monthlyPrice: 79,
    yearlyPrice: Math.round(79 * 12 * 0.9),
    highlight: true,
    tagline: "For growing teams with more complex needs",
    limits: "Up to 5 employees · Up to 10 clients",
    included: [
      "Everything in Starter",
      "Timesheets",
      "Client Requests",
      "Spreadsheet Exports",
      "Reports",
      "Priority support",
    ],
    locked: ["Work Log", "Payroll Estimator"],
  },
  {
    code: "pro",
    name: "Pro",
    monthlyPrice: 129,
    yearlyPrice: Math.round(129 * 12 * 0.9),
    highlight: false,
    tagline: "Full power for established businesses",
    limits: "Up to 10 employees · Up to 15 clients",
    included: [
      "Everything in Growth",
      "Work Log",
      "Payroll Estimator",
      "Advanced Reports",
      "All features unlocked",
    ],
    locked: [],
  },
];

const bullets = [
  { icon: ClipboardList, text: "Manage cleaners, schedules, and attendance in one dashboard" },
  { icon: ScrollText, text: "Track hours and timesheets accurately" },
  { icon: FileText, text: "Organize client requests and work proof" },
  { icon: Zap, text: "Upgrade anytime as your team grows" },
];

export default function SubscribePage() {
  const { user, logout, companyStatus } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async ({ planCode, cycle }: { planCode: string; cycle: string }) => {
      const res = await apiRequest("POST", "/api/billing/checkout", {
        planCode,
        billingCycle: cycle,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (data.message) {
        // Stripe not configured — for dev/testing, show message
        toast({ title: "Stripe not configured", description: "Set STRIPE_SECRET_KEY to enable billing", variant: "destructive" });
        setLoadingPlan(null);
      }
    },
    onError: (e: any) => {
      toast({ title: "Failed to start checkout", description: e.message, variant: "destructive" });
      setLoadingPlan(null);
    },
  });

  const handleSubscribe = (planCode: string) => {
    setLoadingPlan(planCode);
    checkoutMutation.mutate({ planCode, cycle: billingCycle });
  };

  const isStripeConfigured = true; // We always try; Stripe returns 503 if not configured

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Top bar */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">ClockField</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:block">
                Signed in as {user.firstName} {user.lastName}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={logout} data-testid="button-subscribe-logout">
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <Badge className="bg-primary/10 text-primary border-0 text-xs font-medium px-3 py-1">
            Get started today — no free trial
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Choose a plan to start managing<br className="hidden md:block" /> your cleaning business
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Track employee hours, schedules, attendance, requests, timesheets, work logs,
            and client activity in one place. Pick the plan that fits your team.
          </p>
          <ul className="flex flex-col sm:flex-row flex-wrap justify-center gap-x-6 gap-y-2 mt-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1 shadow-inner">
            <button
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBillingCycle("monthly")}
              data-testid="toggle-monthly"
            >
              Monthly
            </button>
            <button
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${billingCycle === "yearly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBillingCycle("yearly")}
              data-testid="toggle-yearly"
            >
              Yearly
              <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                Save 10%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const monthlyEquiv = billingCycle === "yearly"
              ? Math.round(plan.yearlyPrice / 12)
              : plan.monthlyPrice;
            const annualTotal = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice * 12;

            return (
              <Card
                key={plan.code}
                className={`relative flex flex-col transition-all duration-200 ${
                  plan.highlight
                    ? "ring-2 ring-primary shadow-xl scale-[1.02]"
                    : "hover:shadow-lg"
                }`}
                data-testid={`plan-card-${plan.code}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <CardContent className="pt-7 pb-6 flex flex-col h-full gap-5">
                  {/* Plan header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      {plan.highlight && <Badge className="bg-primary/10 text-primary border-0 text-xs">Recommended</Badge>}
                    </div>
                    <p className="text-muted-foreground text-sm mt-0.5">{plan.tagline}</p>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold">${monthlyEquiv}</span>
                      <span className="text-muted-foreground text-sm">/month</span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ${annualTotal}/year · billed annually
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{plan.limits}</p>
                  </div>

                  {/* Features */}
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included</p>
                    <ul className="space-y-1.5">
                      {plan.included.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.locked.length > 0 && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3">Not included</p>
                        <ul className="space-y-1.5">
                          {plan.locked.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="w-3.5 h-3.5 mt-0.5 shrink-0 flex items-center justify-center text-muted-foreground/50 text-base leading-none">×</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  {/* CTA */}
                  <Button
                    className={`w-full mt-2 ${plan.highlight ? "" : ""}`}
                    variant={plan.highlight ? "default" : "outline"}
                    size="lg"
                    disabled={loadingPlan === plan.code && checkoutMutation.isPending}
                    onClick={() => handleSubscribe(plan.code)}
                    data-testid={`button-subscribe-${plan.code}`}
                  >
                    {loadingPlan === plan.code && checkoutMutation.isPending ? (
                      "Redirecting to checkout..."
                    ) : (
                      <>
                        Get started with {plan.name}
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trust / FAQ footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t">
          <div className="text-center space-y-1">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <p className="font-semibold text-sm">Secure payments</p>
            <p className="text-xs text-muted-foreground">Powered by Stripe — your payment info is never stored on our servers</p>
          </div>
          <div className="text-center space-y-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <p className="font-semibold text-sm">Instant access</p>
            <p className="text-xs text-muted-foreground">Your account unlocks immediately after successful payment</p>
          </div>
          <div className="text-center space-y-1">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mx-auto">
              <ArrowRight className="w-4 h-4 text-purple-600" />
            </div>
            <p className="font-semibold text-sm">Upgrade anytime</p>
            <p className="text-xs text-muted-foreground">Switch plans through your billing portal at any time</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Questions? Contact support. By subscribing you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
