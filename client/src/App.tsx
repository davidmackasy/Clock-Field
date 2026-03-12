import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminMobileNav } from "@/components/admin-mobile-nav";
import { MobileNav, employeeNavItems, employeeCenterAction, clientNavItems } from "@/components/mobile-nav";
import { Skeleton } from "@/components/ui/skeleton";

import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminEmployees from "@/pages/admin/employees";
import AdminSchedule from "@/pages/admin/schedule";
import AdminAttendance from "@/pages/admin/attendance";
import AdminPayroll from "@/pages/admin/payroll";
import AdminClients from "@/pages/admin/clients";
import AdminRequests from "@/pages/admin/requests";
import AdminSettings from "@/pages/admin/settings";
import AdminAdmins from "@/pages/admin/admins";
import AdminWorkLog from "@/pages/admin/work-log";
import EmployeeHome from "@/pages/employee/home";
import EmployeeSchedule from "@/pages/employee/schedule";
import EmployeeHours from "@/pages/employee/hours";
import EmployeeProfile from "@/pages/employee/profile";
import EmployeeRequests from "@/pages/employee/requests";
import EmployeeWorkLog from "@/pages/employee/work-log";
import SetPasswordPage from "@/pages/employee/set-password";
import ClientDashboard from "@/pages/client/dashboard";
import ClientRequestsPage from "@/pages/client/requests";
import ClientProfile from "@/pages/client/profile";
import PublicWorkReport from "@/pages/public/work-report";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="space-y-3 w-64">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function AdminLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          {/* Sidebar trigger visible only on md screens where sidebar may collapse */}
          <header className="hidden md:flex lg:hidden items-center p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          {/* pt-14 pb-16 on mobile for top header + bottom nav; reset on md+ */}
          <main className="flex-1 overflow-y-auto pt-14 pb-16 md:pt-0 md:pb-0">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/employees" component={AdminEmployees} />
              <Route path="/admin/schedule" component={AdminSchedule} />
              <Route path="/admin/attendance" component={AdminAttendance} />
              <Route path="/admin/payroll" component={AdminPayroll} />
              <Route path="/admin/clients" component={AdminClients} />
              <Route path="/admin/admins" component={AdminAdmins} />
              <Route path="/admin/requests" component={AdminRequests} />
              <Route path="/admin/work-log" component={AdminWorkLog} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
      {/* Mobile-only navigation shell (hidden on md+) */}
      <AdminMobileNav />
    </SidebarProvider>
  );
}

function EmployeeLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        <Switch>
          <Route path="/employee" component={EmployeeHome} />
          <Route path="/employee/schedule" component={EmployeeSchedule} />
          <Route path="/employee/hours" component={EmployeeHours} />
          <Route path="/employee/requests" component={EmployeeRequests} />
          <Route path="/employee/work-log" component={EmployeeWorkLog} />
          <Route path="/employee/profile" component={EmployeeProfile} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <MobileNav items={employeeNavItems} centerAction={employeeCenterAction} />
    </div>
  );
}

function ClientLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        <Switch>
          <Route path="/client" component={ClientDashboard} />
          <Route path="/client/requests" component={ClientRequestsPage} />
          <Route path="/client/profile" component={ClientProfile} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <MobileNav items={clientNavItems} />
    </div>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Public routes — no auth required
  if (location.startsWith("/public/work-report/")) {
    return (
      <Switch>
        <Route path="/public/work-report/:token" component={PublicWorkReport} />
      </Switch>
    );
  }

  if (isLoading) return <LoadingScreen />;

  if (!user) {
    if (location !== "/") return <Redirect to="/" />;
    return <AuthPage />;
  }

  if ((user as any).mustChangePassword) {
    return <SetPasswordPage />;
  }

  if (location === "/") {
    if (user.role === "admin") return <Redirect to="/admin" />;
    if (user.role === "client") return <Redirect to="/client" />;
    return <Redirect to="/employee" />;
  }

  if (location.startsWith("/admin") && user.role === "admin") return <AdminLayout />;
  if (location.startsWith("/employee") && user.role === "employee") return <EmployeeLayout />;
  if (location.startsWith("/client") && user.role === "client") return <ClientLayout />;

  if (user.role === "admin") return <Redirect to="/admin" />;
  if (user.role === "client") return <Redirect to="/client" />;
  return <Redirect to="/employee" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
