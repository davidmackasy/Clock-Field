export type PlanCode = "starter" | "growth" | "pro" | "legacy";

export interface PlanConfig {
  code: PlanCode;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxClients: number;
  maxEmployees: number;
  features: {
    attendance: boolean;
    employeeLogin: boolean;
    clientPortal: boolean;
    requests: boolean;
    timesheets: boolean;
    worklog: boolean;
    payroll: boolean;
    exports: boolean;
    reports: boolean;
  };
}

export const PLANS: Record<PlanCode, PlanConfig> = {
  starter: {
    code: "starter",
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: Math.round(29 * 12 * 0.9),
    maxClients: 5,
    maxEmployees: 2,
    features: {
      attendance: true,
      employeeLogin: true,
      clientPortal: true,
      requests: false,
      timesheets: false,
      worklog: false,
      payroll: false,
      exports: false,
      reports: false,
    },
  },
  growth: {
    code: "growth",
    name: "Growth",
    monthlyPrice: 79,
    yearlyPrice: Math.round(79 * 12 * 0.9),
    maxClients: 10,
    maxEmployees: 5,
    features: {
      attendance: true,
      employeeLogin: true,
      clientPortal: true,
      requests: true,
      timesheets: true,
      worklog: false,
      payroll: false,
      exports: true,
      reports: true,
    },
  },
  pro: {
    code: "pro",
    name: "Pro",
    monthlyPrice: 129,
    yearlyPrice: Math.round(129 * 12 * 0.9),
    maxClients: 15,
    maxEmployees: 10,
    features: {
      attendance: true,
      employeeLogin: true,
      clientPortal: true,
      requests: true,
      timesheets: true,
      worklog: true,
      payroll: true,
      exports: true,
      reports: true,
    },
  },
  legacy: {
    code: "legacy",
    name: "Legacy (Unlimited)",
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxClients: 9999,
    maxEmployees: 9999,
    features: {
      attendance: true,
      employeeLogin: true,
      clientPortal: true,
      requests: true,
      timesheets: true,
      worklog: true,
      payroll: true,
      exports: true,
      reports: true,
    },
  },
};

export function getPlan(code: string): PlanConfig {
  return PLANS[(code as PlanCode)] ?? PLANS.legacy;
}

export function isFeatureEnabled(planCode: string, feature: keyof PlanConfig["features"]): boolean {
  return getPlan(planCode).features[feature];
}
