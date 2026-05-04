import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  X, ArrowRight, ChevronLeft, Check,
  Users, Calendar, FileText, BarChart3,
  Building2, Home, Wrench, Package, Globe, Award,
  Clock, BookOpen, DollarSign, AlertTriangle
} from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

interface OnboardingData {
  phone: string;
  businessType: string;
  teamSize: string;
  topPriority: string;
  hearAbout: string;
  setupPath: string;
}

const SETUP_PATHS = [
  { key: "team", icon: Users, title: "Set up my team", desc: "Add employees and roles.", href: "/admin/employees" },
  { key: "schedule", icon: Calendar, title: "Create my first schedule", desc: "Start assigning shifts and jobs.", href: "/admin/schedule" },
  { key: "report", icon: FileText, title: "Create a client report", desc: "Try before-and-after reporting.", href: "/admin/work-log?tab=reports" },
  { key: "dashboard", icon: BarChart3, title: "Explore dashboard", desc: "Go directly to my dashboard.", href: "/admin" },
];

// ─── Pill selector component ───────────────────────────────────────────────────
function Pills({ options, value, onChange }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? "" : opt)}
          className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
            value === opt
              ? "bg-primary text-white border-primary shadow-[0_1px_4px_rgba(30,100,200,0.25)]"
              : "bg-white text-[#374151] border-[#e5e7eb] hover:border-primary/40 hover:text-primary"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total = 5 }: { step: number; total?: number }) {
  return (
    <div className="flex gap-1 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i < step ? "bg-primary" : "bg-[#e5e7eb]"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────
export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<OnboardingData>({
    phone: "",
    businessType: "",
    teamSize: "",
    topPriority: "",
    hearAbout: "",
    setupPath: "dashboard",
  });

  const firstName = (user as any)?.firstName || "there";

  const set = (key: keyof OnboardingData) => (val: string) =>
    setData(prev => ({ ...prev, [key]: val }));

  const handleFinish = () => {
    localStorage.removeItem("cf_onboarding_needed");
    const path = SETUP_PATHS.find(p => p.key === data.setupPath)?.href || "/admin";
    onClose();
    setLocation(path);
  };

  const handleSkip = () => {
    localStorage.removeItem("cf_onboarding_needed");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="onboarding-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />

      {/* Card */}
      <div className="relative bg-white rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  onClick={() => setStep(s => (s - 1) as Step)}
                  className="flex items-center gap-1 text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors mr-1"
                  data-testid="button-onboarding-back"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[#9ca3af] font-medium">Step {step} of 5</span>
              <button onClick={handleSkip} className="w-7 h-7 rounded-full bg-[#f3f4f6] flex items-center justify-center hover:bg-[#e5e7eb] transition-colors" data-testid="button-onboarding-close">
                <X className="w-3.5 h-3.5 text-[#6b7280]" />
              </button>
            </div>
          </div>
          <ProgressBar step={step} />
        </div>

        <div className="px-6 pb-6">
          {/* ── Step 1: Welcome ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5" data-testid="onboarding-step-1">
              <div className="w-14 h-14 rounded-[14px] bg-primary/10 flex items-center justify-center mb-2">
                <Clock className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-[#111827] mb-2">Welcome to ClockField, {firstName}!</h2>
                <p className="text-[14.5px] text-[#6b7280] leading-[1.65]">
                  Let's set up your cleaning business workspace. This takes about 2 minutes and helps us personalize your dashboard for your business type.
                </p>
              </div>
              <div className="bg-[#f8fafc] rounded-[10px] border border-[#e5e7eb] p-4 space-y-2.5">
                {[
                  { icon: Users, text: "Manage your team and schedules" },
                  { icon: FileText, text: "Document work and share client reports" },
                  { icon: BookOpen, text: "Assign training and track completion" },
                  { icon: DollarSign, text: "Prepare payroll from attendance records" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-[13px] text-[#374151]">
                    <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    {text}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full h-11 bg-primary text-white text-[14px] font-semibold rounded-[10px] hover:bg-[hsl(210,85%,36%)] transition-colors flex items-center justify-center gap-2"
                data-testid="button-onboarding-start"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={handleSkip} className="w-full text-[13px] text-[#9ca3af] hover:text-[#6b7280] transition-colors text-center py-1">
                Skip for now
              </button>
            </div>
          )}

          {/* ── Step 2: Account Setup ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5" data-testid="onboarding-step-2">
              <div>
                <h2 className="text-[22px] font-bold text-[#111827] mb-2">Set up your account</h2>
                <p className="text-[14px] text-[#6b7280] leading-[1.6]">
                  We'll use this to personalize your experience and business profile.
                </p>
              </div>

              <div className="bg-[#f8fafc] rounded-[8px] border border-[#e5e7eb] px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[13px] font-bold text-primary">{firstName[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#111827]">{(user as any)?.firstName} {(user as any)?.lastName}</div>
                  <div className="text-[12px] text-[#9ca3af]">{(user as any)?.email}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#374151] block">Phone number <span className="text-[#9ca3af] font-normal">(optional)</span></label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={data.phone}
                  onChange={e => set("phone")(e.target.value)}
                  data-testid="input-onboarding-phone"
                  className="w-full h-10 px-3 rounded-[8px] border border-[#d1d5db] text-[14px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
                <p className="text-[12px] text-[#9ca3af]">Used for your business profile and account setup.</p>
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full h-11 bg-primary text-white text-[14px] font-semibold rounded-[10px] hover:bg-[hsl(210,85%,36%)] transition-colors flex items-center justify-center gap-2"
                data-testid="button-onboarding-next-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 3: About Your Business ───────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5" data-testid="onboarding-step-3">
              <div>
                <h2 className="text-[22px] font-bold text-[#111827] mb-2">About your business</h2>
                <p className="text-[14px] text-[#6b7280] leading-[1.6]">Tell us about the type of work you do.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#374151] block">What type of business do you run?</label>
                <Pills
                  options={["Commercial Cleaning", "Residential Cleaning", "Janitorial Services", "Post-Construction Cleaning", "Office Cleaning", "Property Maintenance", "Facility Services", "Other"]}
                  value={data.businessType}
                  onChange={set("businessType")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#374151] block">How many people work in your business?</label>
                <Pills
                  options={["Just me", "2–3 people", "4–10 people", "11–25 people", "26–50 people", "50+ people"]}
                  value={data.teamSize}
                  onChange={set("teamSize")}
                />
              </div>

              <button
                onClick={() => setStep(4)}
                className="w-full h-11 bg-primary text-white text-[14px] font-semibold rounded-[10px] hover:bg-[hsl(210,85%,36%)] transition-colors flex items-center justify-center gap-2"
                data-testid="button-onboarding-next-3"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 4: Goals ─────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5" data-testid="onboarding-step-4">
              <div>
                <h2 className="text-[22px] font-bold text-[#111827] mb-2">Your business goals</h2>
                <p className="text-[14px] text-[#6b7280] leading-[1.6]">This helps us highlight the most relevant features for you.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#374151] block">What is your top priority right now?</label>
                <Pills
                  options={["Manage my team", "Track attendance", "Schedule jobs", "Create client reports", "Improve payroll", "Assign training", "Send quotes", "Track incidents", "Organize everything"]}
                  value={data.topPriority}
                  onChange={set("topPriority")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#374151] block">How did you hear about Clockfield?</label>
                <Pills
                  options={["Friend / Referral", "Google", "Facebook", "Instagram", "YouTube", "TikTok", "AI Agent", "Other"]}
                  value={data.hearAbout}
                  onChange={set("hearAbout")}
                />
              </div>

              <button
                onClick={() => setStep(5)}
                className="w-full h-11 bg-primary text-white text-[14px] font-semibold rounded-[10px] hover:bg-[hsl(210,85%,36%)] transition-colors flex items-center justify-center gap-2"
                data-testid="button-onboarding-next-4"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 5: Setup Path ────────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5" data-testid="onboarding-step-5">
              <div>
                <h2 className="text-[22px] font-bold text-[#111827] mb-2">How do you want to start?</h2>
                <p className="text-[14px] text-[#6b7280] leading-[1.6]">Pick where you'd like to go first. You can always come back to other areas.</p>
              </div>

              <div className="space-y-2.5">
                {SETUP_PATHS.map(path => (
                  <button
                    key={path.key}
                    type="button"
                    onClick={() => set("setupPath")(path.key)}
                    data-testid={`button-path-${path.key}`}
                    className={`w-full flex items-start gap-3.5 p-4 rounded-[12px] border text-left transition-all ${
                      data.setupPath === path.key
                        ? "border-primary bg-primary/6 shadow-[0_1px_6px_rgba(30,100,200,0.12)]"
                        : "border-[#e5e7eb] bg-white hover:border-primary/30 hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0 ${
                      data.setupPath === path.key ? "bg-primary text-white" : "bg-[#f3f4f6] text-[#6b7280]"
                    }`}>
                      <path.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[14px] font-semibold ${data.setupPath === path.key ? "text-primary" : "text-[#111827]"}`}>
                        {path.title}
                      </div>
                      <div className="text-[12.5px] text-[#6b7280]">{path.desc}</div>
                    </div>
                    {data.setupPath === path.key && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-white stroke-[2.5]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleFinish}
                className="w-full h-11 bg-primary text-white text-[14px] font-semibold rounded-[10px] hover:bg-[hsl(210,85%,36%)] transition-colors flex items-center justify-center gap-2"
                data-testid="button-onboarding-finish"
              >
                Finish Setup <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-[12.5px] text-[#9ca3af]">
                You can revisit these settings anytime from your dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
