import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, ArrowUpRight } from "lucide-react";

export type UpgradeReason =
  | "PLAN_LIMIT_EMPLOYEES"
  | "PLAN_LIMIT_CLIENTS"
  | "FEATURE_LOCKED"
  | null;

interface UpgradeModalProps {
  reason: UpgradeReason;
  onClose: () => void;
}

const upgradeContent: Record<
  Exclude<UpgradeReason, null>,
  { title: string; body: string; upgradeTo: string; upgradeCode: string }
> = {
  PLAN_LIMIT_EMPLOYEES: {
    title: "Employee limit reached",
    body: "Your current plan has reached its employee limit. Upgrade to Growth or Pro to add more employees.",
    upgradeTo: "Growth",
    upgradeCode: "growth",
  },
  PLAN_LIMIT_CLIENTS: {
    title: "Client limit reached",
    body: "Your current plan has reached its client limit. Upgrade to Growth or Pro to add more clients.",
    upgradeTo: "Growth",
    upgradeCode: "growth",
  },
  FEATURE_LOCKED: {
    title: "Upgrade required",
    body: "This feature is not available on your current plan. Upgrade to unlock it.",
    upgradeTo: "Growth",
    upgradeCode: "growth",
  },
};

export function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  const { toast } = useToast();

  const content = reason ? upgradeContent[reason] : null;

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

  return (
    <Dialog open={!!reason} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm" data-testid="dialog-upgrade-modal">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>{content?.title}</DialogTitle>
          <DialogDescription>{content?.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => content && checkoutMutation.mutate(content.upgradeCode)}
            disabled={checkoutMutation.isPending}
            data-testid="button-upgrade-plan"
          >
            <ArrowUpRight className="w-4 h-4 mr-1.5" />
            {checkoutMutation.isPending ? "Redirecting…" : `Upgrade to ${content?.upgradeTo}`}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={onClose}
            data-testid="button-upgrade-cancel"
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Parse an API error message and return the plan limit reason if applicable.
 * Returns null if the error is not a plan limit error.
 */
export function parsePlanLimitError(err: any): UpgradeReason {
  const msg: string = err?.message || "";
  if (msg.includes("PLAN_LIMIT_EMPLOYEES")) return "PLAN_LIMIT_EMPLOYEES";
  if (msg.includes("PLAN_LIMIT_CLIENTS")) return "PLAN_LIMIT_CLIENTS";
  return null;
}
