import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, AlertCircle, Building2, IdCard, ArrowRight,
  Eye, EyeOff, ChevronLeft, Calendar, FileText,
  DollarSign, BookOpen, Users, ClipboardList, Check
} from "lucide-react";

type AuthView = "selector" | "business-login" | "business-register" | "employee-login";

function getInitialView(): AuthView {
  if (typeof window === "undefined") return "selector";
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (path === "/business/login" || tab === "login") return "business-login";
  if (path === "/business/register" || tab === "register") return "business-register";
  if (path === "/employee/login" || tab === "employee") return "employee-login";
  return "selector";
}

// ─── Logo ──────────────────────────────────────────────────────────────────────
function CFLogo({ white = false }: { white?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity w-fit" data-testid="link-auth-logo">
      <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center ${white ? "bg-white/20" : "bg-primary"}`}>
        <Clock className="w-[18px] h-[18px] text-white" />
      </div>
      <span className={`text-[16px] font-bold ${white ? "text-white" : "text-[#111827]"}`}>ClockField</span>
    </Link>
  );
}

// ─── Error box ─────────────────────────────────────────────────────────────────
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[8px] border border-red-100 bg-red-50 px-3 py-2.5" data-testid="error-auth">
      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
      <p className="text-[13px] text-[#374151] leading-[1.5]">{message}</p>
    </div>
  );
}

// ─── Right branding panel (desktop) ───────────────────────────────────────────
function RightPanel() {
  return (
    <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-col flex-shrink-0 bg-[hsl(210,85%,38%)] text-white p-10 xl:p-14 justify-between min-h-screen">
      <div>
        <CFLogo white />
        <div className="mt-12 mb-8">
          <h2 className="text-[26px] font-bold leading-[1.25] text-white mb-3">
            Everything you need to run a cleaning business
          </h2>
          <p className="text-[14px] text-white/65 leading-[1.7]">
            Clockfield brings your team, clients, and operations into one connected platform built specifically for cleaning and service businesses.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { icon: Calendar, text: "Schedule shifts and assign cleaners to jobs" },
            { icon: Users, text: "Track attendance, clock-ins, and hours worked" },
            { icon: FileText, text: "Share professional client reports with one link" },
            { icon: BookOpen, text: "Assign training courses and track completion" },
            { icon: DollarSign, text: "Prepare payroll estimates from attendance records" },
            { icon: ClipboardList, text: "Document work with before/after photo logs" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3 h-3 text-white" />
              </div>
              <span className="text-[13.5px] text-white/80">{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/10 rounded-[12px] p-5 mt-10">
        <div className="flex items-center gap-0.5 mb-3">
          {[1,2,3,4,5].map(i => (
            <svg key={i} className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="#fbbf24">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <p className="text-[13px] text-white/80 leading-[1.65] italic mb-2.5">
          "Clockfield keeps our cleaners organized and our clients happy. The before-and-after reports alone are worth it."
        </p>
        <span className="text-[12px] text-white/50">Cleaning Business Owner</span>
      </div>
    </div>
  );
}

// ─── Employee right panel ──────────────────────────────────────────────────────
function EmployeeRightPanel() {
  return (
    <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-col flex-shrink-0 bg-[#111827] text-white p-10 xl:p-14 justify-between min-h-screen">
      <div>
        <CFLogo white />
        <div className="mt-12">
          <h2 className="text-[24px] font-bold leading-[1.3] text-white mb-3">
            Your work, organized in one place
          </h2>
          <p className="text-[14px] text-white/60 leading-[1.7] mb-10">
            As a Clockfield employee, you have access to your schedule, clock-in tools, training, and work reports from any device.
          </p>
          <div className="space-y-4">
            {[
              "View your assigned schedule and shifts",
              "Clock in and out from any mobile device",
              "Upload before/after photos from job sites",
              "Complete assigned training courses",
              "Access your pay stubs and worked hours",
            ].map(text => (
              <div key={text} className="flex items-start gap-3 text-[13.5px] text-white/70">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5 stroke-[2.5]" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-[12px] text-white/30 mt-8">
        Your employee account is created and managed by your employer.
      </div>
    </div>
  );
}

// ─── Back button ───────────────────────────────────────────────────────────────
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors mb-8" data-testid="button-auth-back">
      <ChevronLeft className="w-4 h-4" />
      Back
    </button>
  );
}

// ─── Password input with toggle ────────────────────────────────────────────────
function PasswordInput({ id, testId, value, onChange, placeholder, show, onToggleShow }: {
  id: string; testId: string; value: string; onChange: (v: string) => void;
  placeholder?: string; show: boolean; onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        data-testid={testId}
        type={show ? "text" : "password"}
        placeholder={placeholder || "Enter your password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        autoComplete="current-password"
        className="pr-10"
      />
      <button type="button" onClick={onToggleShow} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors" tabIndex={-1}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Main Auth Page ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const { login, employeeLogin, register, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [view, setView] = useState<AuthView>(getInitialView);

  // Business login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Business register state
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [regError, setRegError] = useState("");

  // Employee login state
  const [empId, setEmpId] = useState("");
  const [empPin, setEmpPin] = useState("");
  const [showEmpPin, setShowEmpPin] = useState(false);
  const [empError, setEmpError] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    if (user.role === "admin") { setLocation("/admin"); return null; }
    if (user.role === "client") { setLocation("/client"); return null; }
    setLocation("/employee");
    return null;
  }

  const normalizeLoginError = (err: any): string => {
    const msg: string = err?.message || "";
    if (msg.includes("401") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials") || msg.toLowerCase().includes("incorrect"))
      return "Incorrect email or password. Please check and try again.";
    if (msg.includes("403") || msg.toLowerCase().includes("inactive") || msg.toLowerCase().includes("disabled"))
      return "Your account is not active. Please contact your administrator.";
    if (msg.includes("fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to fetch"))
      return "Unable to sign in right now. Please try again in a moment.";
    return "Something went wrong. Please try again.";
  };

  const normalizeRegError = (err: any): string => {
    const msg: string = err?.message || "";
    if (msg.toLowerCase().includes("email already exists") || msg.toLowerCase().includes("already in use") || msg.toLowerCase().includes("duplicate"))
      return "This email is already in use. Please sign in or use a different email.";
    if (msg.toLowerCase().includes("required") || msg.toLowerCase().includes("invalid") || msg.includes("400"))
      return "Please check your information and try again.";
    if (msg.includes("fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to fetch"))
      return "We couldn't create your account right now. Please try again in a moment.";
    return "Something went wrong. Please try again.";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast({ title: "Welcome back!" });
    } catch (err: any) {
      setLoginError(normalizeLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setIsLoading(true);
    try {
      await register({ email: regEmail, password: regPassword, firstName: regFirstName, lastName: regLastName, companyName: regCompany });
      localStorage.setItem("cf_onboarding_needed", "1");
      toast({ title: "Account created! Welcome to ClockField." });
    } catch (err: any) {
      setRegError(normalizeRegError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError("");
    setIsLoading(true);
    try {
      await employeeLogin(empId.trim().toUpperCase(), empPin.trim());
      toast({ title: "Welcome!" });
    } catch (err: any) {
      setEmpError(normalizeLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ── SELECTOR VIEW ──────────────────────────────────────────────────────────────
  if (view === "selector") {
    return (
      <div className="min-h-screen bg-[#f4f6f8] flex flex-col items-center justify-center p-5 sm:p-8" data-testid="auth-selector">
        <div className="w-full max-w-[460px]">
          <div className="flex justify-center mb-8">
            <CFLogo />
          </div>

          <div className="text-center mb-7">
            <h1 className="text-[26px] font-bold text-[#111827] mb-2">Welcome to ClockField</h1>
            <p className="text-[15px] text-[#6b7280]">How are you signing in today?</p>
          </div>

          <div className="space-y-3">
            {/* Business card */}
            <button
              onClick={() => setView("business-login")}
              className="w-full bg-white rounded-[14px] border border-[#e5e7eb] p-5 text-left hover:border-primary/30 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-all group"
              data-testid="button-selector-business"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-[10px] bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[15px] font-semibold text-[#111827]">Business Owner / Admin</span>
                    <ArrowRight className="w-4 h-4 text-[#9ca3af] group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-[13px] text-[#6b7280] leading-[1.55]">
                    Manage your cleaning business, schedules, employees, reports, payroll, training, and client work from your dashboard.
                  </p>
                </div>
              </div>
            </button>

            {/* Employee card */}
            <button
              onClick={() => setView("employee-login")}
              className="w-full bg-white rounded-[14px] border border-[#e5e7eb] p-5 text-left hover:border-emerald-300 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-all group"
              data-testid="button-selector-employee"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-[10px] bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <IdCard className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[15px] font-semibold text-[#111827]">Employee / Staff</span>
                    <ArrowRight className="w-4 h-4 text-[#9ca3af] group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-[13px] text-[#6b7280] leading-[1.55]">
                    View your schedule, clock in and out, complete training, upload worklogs, and submit field updates.
                  </p>
                </div>
              </div>
            </button>
          </div>

          <p className="text-center text-[13px] text-[#9ca3af] mt-6">
            New to ClockField?{" "}
            <button onClick={() => setView("business-register")} className="text-primary hover:underline underline-offset-2 font-medium" data-testid="link-selector-register">
              Create a business account
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── SPLIT LAYOUT for business/employee forms ──────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row" data-testid="auth-form-layout">
      {/* Left: form */}
      <div className="flex-1 bg-white flex items-start lg:items-center justify-center px-6 py-10 lg:px-12 lg:py-16">
        <div className="w-full max-w-[400px]">

          {/* ── BUSINESS LOGIN ─────────────────────────────────────────── */}
          {view === "business-login" && (
            <div>
              <BackBtn onClick={() => setView("selector")} />
              <CFLogo />
              <div className="mt-7 mb-7">
                <h1 className="text-[24px] font-bold text-[#111827] mb-1.5">Sign in to your business</h1>
                <p className="text-[14px] text-[#6b7280]">Admin and manager accounts use email and password.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-[13px] font-medium text-[#374151]">Email address</Label>
                  <Input
                    id="login-email"
                    data-testid="input-login-email"
                    type="email"
                    placeholder="name@company.com"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-[13px] font-medium text-[#374151]">Password</Label>
                    <Link href="/forgot-password" className="text-[12.5px] text-primary hover:underline underline-offset-2" data-testid="link-forgot-password">
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="login-password"
                    testId="input-login-password"
                    value={loginPassword}
                    onChange={v => { setLoginPassword(v); setLoginError(""); }}
                    show={showLoginPw}
                    onToggleShow={() => setShowLoginPw(v => !v)}
                  />
                </div>

                {loginError && <ErrorBox message={loginError} />}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 bg-primary text-white text-[14px] font-semibold rounded-[8px] hover:bg-[hsl(210,85%,36%)] disabled:opacity-60 transition-colors"
                  data-testid="button-login"
                >
                  {isLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#f3f4f6] text-center text-[13px] text-[#6b7280]">
                New to ClockField?{" "}
                <button onClick={() => setView("business-register")} className="text-primary hover:underline underline-offset-2 font-medium" data-testid="link-go-register">
                  Create a business account
                </button>
              </div>
            </div>
          )}

          {/* ── BUSINESS REGISTER ──────────────────────────────────────────── */}
          {view === "business-register" && (
            <div>
              <BackBtn onClick={() => setView("selector")} />
              <CFLogo />
              <div className="mt-7 mb-7">
                <h1 className="text-[24px] font-bold text-[#111827] mb-1.5">Create your Clockfield account</h1>
                <p className="text-[14px] text-[#6b7280]">Set up your cleaning business workspace in minutes.</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-first" className="text-[13px] font-medium text-[#374151]">First name</Label>
                    <Input
                      id="reg-first"
                      data-testid="input-reg-first"
                      placeholder="Jane"
                      value={regFirstName}
                      onChange={e => setRegFirstName(e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-last" className="text-[13px] font-medium text-[#374151]">Last name</Label>
                    <Input
                      id="reg-last"
                      data-testid="input-reg-last"
                      placeholder="Smith"
                      value={regLastName}
                      onChange={e => setRegLastName(e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-company" className="text-[13px] font-medium text-[#374151]">Company name</Label>
                  <Input
                    id="reg-company"
                    data-testid="input-reg-company"
                    placeholder="Acme Cleaning Co."
                    value={regCompany}
                    onChange={e => setRegCompany(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-[13px] font-medium text-[#374151]">Email address</Label>
                  <Input
                    id="reg-email"
                    data-testid="input-reg-email"
                    type="email"
                    placeholder="name@company.com"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-[13px] font-medium text-[#374151]">Password</Label>
                  <PasswordInput
                    id="reg-password"
                    testId="input-reg-password"
                    value={regPassword}
                    onChange={v => { setRegPassword(v); setRegError(""); }}
                    placeholder="Min. 6 characters"
                    show={showRegPw}
                    onToggleShow={() => setShowRegPw(v => !v)}
                  />
                </div>

                {regError && <ErrorBox message={regError} />}

                <button
                  type="submit"
                  disabled={isLoading || regPassword.length < 6}
                  className="w-full h-10 bg-primary text-white text-[14px] font-semibold rounded-[8px] hover:bg-[hsl(210,85%,36%)] disabled:opacity-60 transition-colors mt-1"
                  data-testid="button-register"
                >
                  {isLoading ? "Creating account…" : "Create Account"}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#f3f4f6] text-center text-[13px] text-[#6b7280]">
                Already have an account?{" "}
                <button onClick={() => setView("business-login")} className="text-primary hover:underline underline-offset-2 font-medium" data-testid="link-go-login">
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* ── EMPLOYEE LOGIN ──────────────────────────────────────────────── */}
          {view === "employee-login" && (
            <div>
              <BackBtn onClick={() => setView("selector")} />
              <CFLogo />
              <div className="mt-7 mb-7">
                <h1 className="text-[24px] font-bold text-[#111827] mb-1.5">Employee Sign In</h1>
                <p className="text-[14px] text-[#6b7280]">For cleaners and staff members. Use your Employee ID and PIN.</p>
              </div>

              <form onSubmit={handleEmployeeLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-id" className="text-[13px] font-medium text-[#374151]">Employee ID</Label>
                  <Input
                    id="emp-id"
                    data-testid="input-employee-id"
                    placeholder="EMP-1001"
                    value={empId}
                    onChange={e => setEmpId(e.target.value)}
                    required
                    autoComplete="username"
                    className="h-10 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-pin" className="text-[13px] font-medium text-[#374151]">PIN / Password</Label>
                  <PasswordInput
                    id="emp-pin"
                    testId="input-employee-pin"
                    value={empPin}
                    onChange={v => { setEmpPin(v); setEmpError(""); }}
                    placeholder="Enter your PIN"
                    show={showEmpPin}
                    onToggleShow={() => setShowEmpPin(v => !v)}
                  />
                </div>

                {empError && <ErrorBox message={empError} />}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 bg-emerald-600 text-white text-[14px] font-semibold rounded-[8px] hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                  data-testid="button-employee-login"
                >
                  {isLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div className="mt-5 bg-[#f8fafc] rounded-[8px] border border-[#e5e7eb] px-4 py-3.5">
                <p className="text-[12.5px] text-[#6b7280] leading-[1.6]">
                  Your <strong className="text-[#374151]">Employee ID</strong> and <strong className="text-[#374151]">PIN</strong> are created and provided by your employer. If you don't have one yet, ask your manager to set up your account in Clockfield.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-[#f3f4f6] text-center">
                <p className="text-[12.5px] text-[#9ca3af]">Are you a business owner?{" "}
                  <button onClick={() => setView("business-login")} className="text-primary hover:underline underline-offset-2 font-medium text-[13px]" data-testid="link-emp-to-business">
                    Sign in here
                  </button>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Right: Branding panel */}
      {view === "employee-login" ? <EmployeeRightPanel /> : <RightPanel />}
    </div>
  );
}
