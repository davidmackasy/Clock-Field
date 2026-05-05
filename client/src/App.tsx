import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminMobileNav } from "@/components/admin-mobile-nav";
import { SuperAdminSidebar } from "@/components/super-admin-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { employeeNavItems, employeeCenterAction, clientNavItems, clientCenterAction } from "@/lib/nav-config";
import { FeatureGate } from "@/components/feature-gate";
import { Skeleton } from "@/components/ui/skeleton";

import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import SubscribePage from "@/pages/subscribe";
import BillingBlockedPage from "@/pages/billing-blocked";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminEmployees from "@/pages/admin/employees";
import AdminSchedule from "@/pages/admin/schedule";
import AdminAttendance from "@/pages/admin/attendance";
import AdminPayroll from "@/pages/admin/payroll";
import AdminClients from "@/pages/admin/clients";
import AdminRequests from "@/pages/admin/requests";
import AdminSettings from "@/pages/admin/settings";
import AdminManagement from "@/pages/admin/management";
import AdminWorkLogHub from "@/pages/admin/work-log-hub";
import AcceptInvitePage from "@/pages/accept-invite";
import AdminFieldNotesCapture from "@/pages/admin/field-notes-capture";
import AdminFieldNotesSession from "@/pages/admin/field-notes-session";
import AdminFieldNotesPageEditor from "@/pages/admin/field-notes-page-editor";
import EmployeeFieldNotes from "@/pages/employee/field-notes";
import AdminTimesheets from "@/pages/admin/timesheets";
import AdminSubscription from "@/pages/admin/subscription";
import AdminPlatformMessages from "@/pages/admin/platform-messages";
import AdminMessages from "@/pages/admin/messages";
import AdminReports from "@/pages/admin/reports";
import EmployeeReports from "@/pages/employee/reports";
import ClientReports from "@/pages/client/reports";
import SuperAdminDashboard from "@/pages/super-admin/dashboard";
import SuperAdminMessages from "@/pages/super-admin/messages";
import EmployeeHome from "@/pages/employee/home";
import EmployeeSchedule from "@/pages/employee/schedule";
import EmployeeHours from "@/pages/employee/hours";
import EmployeeProfile from "@/pages/employee/profile";
import EmployeeRequests from "@/pages/employee/requests";
import EmployeeTimesheets from "@/pages/employee/timesheets";
import EmployeeWorkLog from "@/pages/employee/work-log";
import EmployeePayStubs from "@/pages/employee/pay-stubs";
import EmployeeSupplies from "@/pages/employee/supplies";
import SetPasswordPage from "@/pages/employee/set-password";
import AdminSupplies from "@/pages/admin/supplies";
import AdminPublications, { AdminAgreementsPage } from "@/pages/admin/publications";
import AdminPublicationEditor from "@/pages/admin/publication-editor";
import PublicPublication from "@/pages/public/publication";
import ClientDashboard from "@/pages/client/dashboard";
import ClientRequestsPage from "@/pages/client/requests";
import ClientProfile from "@/pages/client/profile";
import ClientMessages from "@/pages/client/messages";
import EmployeeMessages from "@/pages/employee/messages";
import PublicWorkReport from "@/pages/public/work-report";
import PublicReviewShare from "@/pages/public/review-share";
import PublicReportAccess from "@/pages/public/report-access";
import PublicFieldNote from "@/pages/public/field-note";
import PublicQuoteForm from "@/pages/public/quote-form";
import AdminQuoteForms from "@/pages/admin/quote-forms";
import AdminQuoteFormBuilder from "@/pages/admin/quote-form-builder";
import AdminProposals from "@/pages/admin/proposals";
import AdminProposalBuilder from "@/pages/admin/proposal-builder";
import PublicProposal from "@/pages/public/proposal";
import AdminAgreementBuilder from "@/pages/admin/agreement-builder";
import PublicAgreement from "@/pages/public/agreement";
import HiringPackagePage from "@/pages/public/HiringPackagePage";
import AdminTrainingHub from "@/pages/admin/training";
import EmployeeTraining from "@/pages/employee/training";
import PublicTrainingCourse from "@/pages/public/training-course";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import LandingPage from "@/pages/landing";
import EmployeeScheduledFieldNotesList from "@/pages/employee/scheduled-field-notes-list";
import EmployeeScheduledFieldNotesCapture from "@/pages/employee/scheduled-field-notes-capture";
import PublicScheduledFieldNoteReport from "@/pages/public/scheduled-field-note-report";

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
          <header className="hidden md:flex lg:hidden items-center p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 flex flex-col min-h-0 pt-14 pb-16 md:pt-0 md:pb-0">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/employees" component={AdminEmployees} />
              <Route path="/admin/schedule" component={AdminSchedule} />
              <Route path="/admin/attendance" component={AdminAttendance} />
              <Route path="/admin/payroll">
                <FeatureGate feature="payroll"><AdminPayroll /></FeatureGate>
              </Route>
              <Route path="/admin/clients" component={AdminClients} />
              <Route path="/admin/management" component={AdminManagement} />
              <Route path="/admin/admins"><Redirect to="/admin/management" /></Route>
              <Route path="/admin/timesheets">
                <FeatureGate feature="timesheets"><AdminTimesheets /></FeatureGate>
              </Route>
              <Route path="/admin/field-notes/capture" component={AdminFieldNotesCapture} />
              <Route path="/admin/field-notes/session/:id" component={AdminFieldNotesSession} />
              <Route path="/admin/field-notes/page/:id" component={AdminFieldNotesPageEditor} />
              <Route path="/admin/work-log" component={AdminWorkLogHub} />
              <Route path="/admin/reports"><Redirect to="/admin/work-log?tab=reports" /></Route>
              <Route path="/admin/field-notes"><Redirect to="/admin/work-log?tab=field-notes" /></Route>
              <Route path="/admin/requests"><Redirect to="/admin/messages" /></Route>
              <Route path="/admin/quote-forms/:id" component={AdminQuoteFormBuilder} />
              <Route path="/admin/quote-forms" component={AdminQuoteForms} />
              <Route path="/admin/proposals/:id" component={AdminProposalBuilder} />
              <Route path="/admin/proposals" component={AdminProposals} />
              <Route path="/admin/agreements/:id" component={AdminAgreementBuilder} />
              <Route path="/admin/agreements" component={AdminAgreementsPage} />
              <Route path="/admin/work-log/supplies" component={AdminWorkLogHub} />
              <Route path="/admin/supplies" component={AdminSupplies} />
              <Route path="/admin/publications/:id" component={AdminPublicationEditor} />
              <Route path="/admin/publications" component={AdminPublications} />
              <Route path="/admin/training" component={AdminTrainingHub} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route path="/admin/subscription" component={AdminSubscription} />
              <Route path="/admin/platform-messages" component={AdminPlatformMessages} />
              <Route path="/admin/messages" component={AdminMessages} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
      <AdminMobileNav />
    </SidebarProvider>
  );
}

function SuperAdminLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <SuperAdminSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="hidden md:flex lg:hidden items-center p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle-sa" />
          </header>
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/super-admin" component={SuperAdminDashboard} />
              <Route path="/super-admin/messages" component={SuperAdminMessages} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function EmployeeLayout() {
  const { user } = useAuth();
  const { data: empUnread } = useQuery<{ count: number }>({
    queryKey: ["/api/employee/messages/unread-count"],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const empUnreadCount = empUnread?.count ?? 0;

  const navItems = employeeNavItems;
  const badges = empUnreadCount > 0 ? { "/employee/messages": empUnreadCount } : {};

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        <Switch>
          <Route path="/employee" component={EmployeeHome} />
          <Route path="/employee/schedule" component={EmployeeSchedule} />
          <Route path="/employee/hours" component={EmployeeHours} />
          <Route path="/employee/messages" component={EmployeeMessages} />
          <Route path="/employee/requests" component={EmployeeRequests} />
          <Route path="/employee/reports" component={EmployeeReports} />
          <Route path="/employee/timesheets" component={EmployeeTimesheets} />
          <Route path="/employee/work-log" component={EmployeeWorkLog} />
          <Route path="/employee/pay-stubs" component={EmployeePayStubs} />
          <Route path="/employee/supplies" component={EmployeeSupplies} />
          <Route path="/employee/field-notes/capture" component={AdminFieldNotesCapture} />
          <Route path="/employee/field-notes/session/:id" component={AdminFieldNotesSession} />
          <Route path="/employee/field-notes" component={EmployeeFieldNotes} />
          <Route path="/employee/scheduled-field-notes/:id" component={EmployeeScheduledFieldNotesCapture} />
          <Route path="/employee/scheduled-field-notes" component={EmployeeScheduledFieldNotesList} />
          <Route path="/employee/training" component={EmployeeTraining} />
          <Route path="/employee/profile" component={EmployeeProfile} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <MobileNav items={navItems} centerAction={employeeCenterAction} badges={badges} />
    </div>
  );
}

function ClientLayout() {
  const { user } = useAuth();
  const { data: clientUnread } = useQuery<{ count: number }>({
    queryKey: ["/api/client/messages/unread-count"],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const clientBadges = clientUnread && clientUnread.count > 0 ? { "/client/messages": clientUnread.count } : {};

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        <Switch>
          <Route path="/client" component={ClientDashboard} />
          <Route path="/client/messages" component={ClientMessages} />
          <Route path="/client/requests" component={ClientRequestsPage} />
          <Route path="/client/reports" component={ClientReports} />
          <Route path="/client/profile" component={ClientProfile} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <MobileNav items={clientNavItems} centerAction={clientCenterAction} badges={clientBadges} />
    </div>
  );
}

function AppRouter() {
  const { user, isLoading, isSuperAdmin, companyStatus, companyStatusLoading, canAccessPlatform } = useAuth();
  const [location] = useLocation();

  // Public routes that bypass all guards
  if (location.startsWith("/public/reports/")) {
    return (
      <Switch>
        <Route path="/public/reports/:token" component={PublicReportAccess} />
      </Switch>
    );
  }

  if (location.startsWith("/public/work-report/")) {
    return (
      <Switch>
        <Route path="/public/work-report/:token" component={PublicWorkReport} />
      </Switch>
    );
  }

  if (location.startsWith("/public/reviews/")) {
    return (
      <Switch>
        <Route path="/public/reviews/:token" component={PublicReviewShare} />
      </Switch>
    );
  }

  if (location.startsWith("/public/field-notes/")) {
    return (
      <Switch>
        <Route path="/public/field-notes/:token" component={PublicFieldNote} />
      </Switch>
    );
  }

  if (location.startsWith("/public/scheduled-field-notes/")) {
    return (
      <Switch>
        <Route path="/public/scheduled-field-notes/:publicId" component={PublicScheduledFieldNoteReport} />
      </Switch>
    );
  }

  if (location.startsWith("/form/")) {
    return (
      <Switch>
        <Route path="/form/:companyId/:slug" component={PublicQuoteForm} />
      </Switch>
    );
  }

  if (location.startsWith("/public/proposals/")) {
    return (
      <Switch>
        <Route path="/public/proposals/:token" component={PublicProposal} />
      </Switch>
    );
  }

  if (location.startsWith("/public/agreements/")) {
    return (
      <Switch>
        <Route path="/public/agreements/:token" component={PublicAgreement} />
      </Switch>
    );
  }

  if (location.startsWith("/public/hiring-package/")) {
    return (
      <Switch>
        <Route path="/public/hiring-package/:token" component={HiringPackagePage} />
      </Switch>
    );
  }

  if (location.startsWith("/training/public/")) {
    return (
      <Switch>
        <Route path="/training/public/:publicId" component={PublicTrainingCourse} />
      </Switch>
    );
  }

  // Forgot / reset password pages (public, no auth needed)
  if (location === "/forgot-password") return <ForgotPasswordPage />;
  if (location.startsWith("/reset-password")) return <ResetPasswordPage />;
  if (location.startsWith("/accept-invite/")) {
    return (
      <Switch>
        <Route path="/accept-invite/:token" component={AcceptInvitePage} />
      </Switch>
    );
  }

  // Short public URLs
  if (location.startsWith("/r/")) {
    return (
      <Switch>
        <Route path="/r/:token" component={PublicWorkReport} />
      </Switch>
    );
  }

  if (location.startsWith("/p/")) {
    return (
      <Switch>
        <Route path="/p/:slug" component={PublicPublication} />
      </Switch>
    );
  }


  if (location.startsWith("/v/")) {
    return (
      <Switch>
        <Route path="/v/:token" component={PublicReviewShare} />
      </Switch>
    );
  }


  if (isLoading) return <LoadingScreen />;

  if (!user) {
    if (location === "/") return <LandingPage />;
    if (location === "/login" || location.startsWith("/login?")) return <AuthPage />;
    if (location === "/business/login" || location === "/business/register" || location === "/employee/login") return <AuthPage />;
    return <Redirect to="/login" />;
  }

  if ((user as any).mustChangePassword) {
    return <SetPasswordPage />;
  }

  // ── Admin subscription gating ─────────────────────────────────────────────
  if (user.role === "admin") {
    // Wait for company status before enforcing — prevents flash
    if (companyStatusLoading && !companyStatus) {
      return <LoadingScreen />;
    }

    // Super admin routes — always accessible for super admins
    if (location.startsWith("/super-admin")) {
      if (isSuperAdmin) return <SuperAdminLayout />;
      return <Redirect to="/admin" />;
    }

    // Subscription/billing pages — always accessible (needed to complete checkout)
    const bypassRoutes = ["/subscribe", "/billing-blocked", "/admin/subscription"];
    const isBypassRoute = bypassRoutes.some(r => location.startsWith(r));

    if (!isBypassRoute && !canAccessPlatform) {
      const acctStatus = companyStatus?.accountStatus;
      if (acctStatus === "pending_subscription") {
        return <Switch>
          <Route path="/subscribe" component={SubscribePage} />
          <Route><Redirect to="/subscribe" /></Route>
        </Switch>;
      }
      // Billing blocked (past_due, canceled, etc.)
      return <Switch>
        <Route path="/billing-blocked" component={BillingBlockedPage} />
        <Route><Redirect to="/billing-blocked" /></Route>
      </Switch>;
    }

    // Subscribe/billing-blocked routes for admin (accessible even if valid subscription)
    if (location === "/subscribe") return <SubscribePage />;
    if (location === "/billing-blocked") return <BillingBlockedPage />;

    // Admin app
    if (location === "/" || location === "/login" || location.startsWith("/login?")) return <Redirect to="/admin" />;
    return <AdminLayout />;
  }

  // ── Non-admin routing ─────────────────────────────────────────────────────
  if (location === "/" || location === "/login" || location.startsWith("/login?")) {
    if (user.role === "client") return <Redirect to="/client" />;
    return <Redirect to="/employee" />;
  }

  if (location.startsWith("/employee") && user.role === "employee") return <EmployeeLayout />;
  if (location.startsWith("/client") && user.role === "client") return <ClientLayout />;

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
