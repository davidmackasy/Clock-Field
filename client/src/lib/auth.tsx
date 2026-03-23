import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "./queryClient";
import type { User } from "@shared/schema";

type AuthUser = Omit<User, "password">;

export type CompanyStatus = {
  id: string;
  name: string;
  planCode: string;
  billingCycle: string;
  subscriptionStatus: string;
  accountStatus: string;
  internalBypass: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  manualAccessEnabled: boolean;
  manualAccessExpiresAt: string | null;
  manualAccessGrantedBy: string | null;
  manualAccessReason: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  companyStatus: CompanyStatus | null;
  companyStatusLoading: boolean;
  canAccessPlatform: boolean;
  login: (email: string, password: string) => Promise<void>;
  employeeLogin: (employeeId: string, pin: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; companyName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: Infinity,
  });

  const { data: companyStatus, isLoading: companyStatusLoading } = useQuery<CompanyStatus>({
    queryKey: ["/api/auth/company"],
    enabled: !!user && user.role === "admin",
    staleTime: 30_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => { queryClient.clear(); },
  });

  const employeeLoginMutation = useMutation({
    mutationFn: async ({ employeeId, pin }: { employeeId: string; pin: string }) => {
      const res = await apiRequest("POST", "/api/auth/employee-login", { employeeId, pin });
      return res.json();
    },
    onSuccess: () => { queryClient.clear(); },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName: string; lastName: string; companyName: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => { queryClient.clear(); },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/auth/logout"); },
    onSuccess: () => { queryClient.clear(); },
  });

  const isSuperAdmin = !!(user && (user as any).isSuperAdmin === true && user.role === "admin");

  // A company can access the platform if:
  // 1. They have internal_bypass (super-admin-granted permanent bypass) OR
  // 2. They have the legacy plan (existing grandfathered accounts) OR
  // 3. They have active account_status AND a valid paid subscription status
  //    (active, trialing, or past_due — past_due gets a grace period, not immediate lockout) OR
  // 4. They have an active Super Admin timed temporary access override that has not expired
  const canAccessPlatform = (() => {
    if (!companyStatus) return true; // loading state — don't block yet
    if (companyStatus.internalBypass) return true;
    if (companyStatus.planCode === "legacy") return true;
    const validSubStatuses = ["active", "trialing", "past_due"];
    if (companyStatus.accountStatus === "active" && validSubStatuses.includes(companyStatus.subscriptionStatus)) return true;
    // Timed temporary access override
    if (
      companyStatus.manualAccessEnabled &&
      companyStatus.manualAccessExpiresAt &&
      new Date() < new Date(companyStatus.manualAccessExpiresAt)
    ) return true;
    return false;
  })();

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isSuperAdmin,
        companyStatus: companyStatus ?? null,
        companyStatusLoading,
        canAccessPlatform,
        login: async (email, password) => { await loginMutation.mutateAsync({ email, password }); },
        employeeLogin: async (employeeId, pin) => { await employeeLoginMutation.mutateAsync({ employeeId, pin }); },
        register: async (data) => { await registerMutation.mutateAsync(data); },
        logout: async () => { await logoutMutation.mutateAsync(); },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
