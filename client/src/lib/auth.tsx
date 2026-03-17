import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "./queryClient";
import type { User } from "@shared/schema";

type AuthUser = Omit<User, "password">;

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
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

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const employeeLoginMutation = useMutation({
    mutationFn: async ({ employeeId, pin }: { employeeId: string; pin: string }) => {
      const res = await apiRequest("POST", "/api/auth/employee-login", { employeeId, pin });
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName: string; lastName: string; companyName: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const isSuperAdmin = !!(user && (user as any).isSuperAdmin === true && user.role === "admin");

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isSuperAdmin,
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
