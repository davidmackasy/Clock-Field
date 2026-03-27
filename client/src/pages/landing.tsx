import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Clock, Users, FileText, Star, ChevronDown, ChevronUp,
  Menu, X, Camera, BarChart3, Shield, ClipboardList,
  ArrowRight, Check, MapPin, Bell, CreditCard, MessageSquare,
  CheckCircle2, Circle
} from "lucide-react";

const cleanPhoto1 = "/cleaning-photos/cleaning_work_1_1.jpg";
const cleanPhoto2 = "/cleaning-photos/cleaning_work_1_2.jpg";
const cleanPhoto3 = "/cleaning-photos/cleaning_work_1_3.jpg";
const cleanPhoto4 = "/cleaning-photos/cleaning_work_1_4.jpg";
const cleanPhoto5 = "/cleaning-photos/cleaning_work_1_5.jpg";
const cleanPhoto6 = "/cleaning-photos/cleaning_work_1_6.jpg";

// ─── Utility: scroll to anchor ────────────────────────────────────────────────
const scrollTo = (href: string) => {
  if (!href.startsWith("#")) return;
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: "smooth" });
};

// ─── Announcement Bar ─────────────────────────────────────────────────────────
function AnnouncementBar({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-[hsl(210,85%,38%)] text-white text-xs sm:text-sm py-2 px-4 flex items-center justify-center gap-2 relative">
      <span className="font-medium">New:</span>
      <span className="opacity-90">Clients can now leave reviews directly on your public report.</span>
      <Link
        href="/login?tab=register"
        className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity ml-1 whitespace-nowrap"
      >
        Try it free →
      </Link>
      <button
        onClick={onDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
        data-testid="button-dismiss-announcement"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-all duration-150 ${scrolled ? "border-b border-[#e5e7eb] shadow-[0_1px_4px_rgba(0,0,0,0.06)]" : "border-b border-transparent"}`}
      data-testid="header-marketing"
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-[60px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" data-testid="link-logo">
            <div className="w-8 h-8 rounded-[6px] bg-primary flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[#111827]">ClockField</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7">
            {links.map(l => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="text-[13.5px] font-medium text-[#4b5563] hover:text-[#111827] transition-colors"
                data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {l.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" data-testid="link-header-login">
              <button className="text-[13.5px] font-medium text-[#374151] hover:text-[#111827] px-3.5 py-2 rounded-[6px] hover:bg-[#f3f4f6] transition-colors">
                Log In
              </button>
            </Link>
            <Link href="/login?tab=register" data-testid="link-header-get-started">
              <button className="text-[13.5px] font-semibold bg-primary text-white px-4 py-2 rounded-[6px] hover:bg-[hsl(210,85%,38%)] transition-colors">
                Get Started
              </button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 -mr-1 rounded-md text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#e5e7eb] bg-white shadow-lg" data-testid="mobile-nav-drawer">
          <div className="max-w-[1280px] mx-auto px-6 py-4 space-y-1">
            {links.map(l => (
              <button
                key={l.href}
                onClick={() => { scrollTo(l.href); setMobileOpen(false); }}
                className="block w-full text-left text-[14px] font-medium text-[#374151] py-2.5 border-b border-[#f3f4f6] last:border-0"
              >
                {l.label}
              </button>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link href="/login?tab=register" onClick={() => setMobileOpen(false)} data-testid="link-mobile-get-started">
                <button className="w-full text-[14px] font-semibold bg-primary text-white py-2.5 rounded-[6px] hover:bg-[hsl(210,85%,38%)] transition-colors">
                  Get Started Free
                </button>
              </Link>
              <Link href="/login" onClick={() => setMobileOpen(false)} data-testid="link-mobile-login">
                <button className="w-full text-[14px] font-medium text-[#374151] py-2.5 rounded-[6px] border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors">
                  Log In
                </button>
              </Link>
              <Link href="/login" onClick={() => setMobileOpen(false)} data-testid="link-mobile-employee">
                <button className="w-full text-[13px] text-[#6b7280] py-2 text-center hover:text-[#374151] transition-colors">
                  Employee Access
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero Dashboard Mockup ────────────────────────────────────────────────────
function HeroDashboard() {
  return (
    <div className="relative w-full select-none">
      {/* Main browser frame */}
      <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden bg-white">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-[#f5f5f5] border-b border-[#e5e7eb]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#fc6058]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#fec02f]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#2aca3e]" />
          <div className="flex-1 mx-3 bg-white border border-[#e5e7eb] rounded-[4px] px-2.5 py-[3px] text-[10px] text-[#9ca3af] font-mono">
            app.clockfield.com/admin
          </div>
        </div>

        {/* Dashboard body */}
        <div className="flex" style={{ height: 340 }}>
          {/* Sidebar */}
          <div className="w-[170px] bg-[#f8fafc] border-r border-[#e5e7eb] flex-shrink-0 p-3 flex flex-col gap-0.5">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                <Clock className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-[#111827]">ClockField</span>
            </div>
            {[
              { label: "Dashboard", active: true, icon: BarChart3 },
              { label: "Employees", active: false, icon: Users },
              { label: "Schedule", active: false, icon: Clock },
              { label: "Attendance", active: false, icon: CheckCircle2 },
              { label: "Work Log", active: false, icon: ClipboardList },
              { label: "Clients", active: false, icon: MapPin },
              { label: "Payroll", active: false, icon: CreditCard },
            ].map(item => (
              <div
                key={item.label}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-[4px] ${item.active ? "bg-primary/10 text-primary" : "text-[#6b7280]"}`}
              >
                <item.icon className="w-3 h-3 flex-shrink-0" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Main */}
          <div className="flex-1 p-4 overflow-hidden bg-white space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[12px] font-semibold text-[#111827]">Good morning, David</h3>
                <p className="text-[9.5px] text-[#9ca3af]">Thursday, March 27 · 4 active shifts</p>
              </div>
              <div className="flex gap-1.5">
                <div className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[8.5px] font-semibold text-emerald-700">● 3 On-site</div>
                <div className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[8.5px] font-semibold text-amber-700">1 Late</div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: "3", label: "Working Now", color: "text-primary" },
                { val: "1", label: "Late", color: "text-amber-600" },
                { val: "5", label: "Open Jobs", color: "text-[#111827]" },
                { val: "$2,140", label: "Est. Payroll", color: "text-[#111827]" },
              ].map(s => (
                <div key={s.label} className="bg-[#f8fafc] border border-[#e5e7eb] rounded-[6px] p-2">
                  <div className={`text-[14px] font-bold ${s.color}`}>{s.val}</div>
                  <div className="text-[8.5px] text-[#9ca3af] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Employee list */}
            <div>
              <div className="text-[9px] font-semibold text-[#9ca3af] uppercase tracking-widest mb-1.5">Today's Shifts</div>
              <div className="space-y-1">
                {[
                  { name: "Sarah Mitchell", job: "Downtown Office — Floor 3", status: "On-site", dot: "bg-emerald-500", time: "8:02 AM" },
                  { name: "James Kowalski", job: "Riverside Plaza", status: "Late", dot: "bg-amber-500", time: "9:15 AM" },
                  { name: "Ana Carvalho", job: "Westside Mall", status: "Scheduled", dot: "bg-[#d1d5db]", time: "2:00 PM" },
                ].map(e => (
                  <div key={e.name} className="flex items-center gap-2 px-2 py-1.5 rounded-[5px] bg-[#f8fafc] border border-[#f0f0f0]">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-semibold text-primary flex-shrink-0">
                      {e.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-[#111827] truncate">{e.name}</div>
                      <div className="text-[8.5px] text-[#9ca3af] truncate">{e.job}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
                      <span className="text-[8.5px] text-[#6b7280]">{e.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating: Report Shared card */}
      <div className="absolute -bottom-6 -right-5 w-[185px] bg-white rounded-[8px] border border-[#e5e7eb] shadow-[0_8px_30px_rgba(0,0,0,0.10)] p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <FileText className="w-3 h-3 text-primary flex-shrink-0" />
          <span className="text-[9.5px] font-semibold text-[#111827]">Report Shared</span>
        </div>
        <div className="text-[8.5px] text-[#6b7280] mb-1.5 leading-tight">Downtown Office · March 2026</div>
        <div className="flex items-center gap-0.5 mb-1">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />)}
          <span className="text-[8.5px] text-[#6b7280] ml-1">5.0</span>
        </div>
        <div className="text-[8px] text-[#9ca3af]">Client reviewed · 4 min ago</div>
      </div>

      {/* Floating: Clock In card */}
      <div className="absolute -top-4 -left-5 bg-white rounded-[8px] border border-[#e5e7eb] shadow-[0_8px_30px_rgba(0,0,0,0.10)] px-3 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-[#111827]">Clocked In</div>
          <div className="text-[8.5px] text-[#9ca3af]">Sarah M. · 8:02 AM</div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="bg-white pt-16 pb-20 px-6 lg:px-10" data-testid="section-hero">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-14 items-center">
          {/* Left copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-[12px] font-semibold px-3 py-1 rounded-full mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Built for cleaning businesses
            </div>
            <h1 className="text-[40px] sm:text-[48px] font-bold text-[#111827] leading-[1.12] tracking-[-0.03em] mb-5">
              Manage your team,<br />
              <span className="text-primary">jobs, and clients</span><br />
              in one place.
            </h1>
            <p className="text-[17px] text-[#4b5563] leading-[1.6] mb-7 max-w-[470px]">
              Clockfield gives cleaning businesses a single platform to schedule staff,
              document work, share client reports, track hours, and collect reviews.
            </p>

            {/* Bullets */}
            <div className="space-y-2 mb-8">
              {[
                "Employee clock-in/out with real-time oversight",
                "Shareable public reports clients actually read",
                "Built-in review collection — no extra tools",
              ].map(p => (
                <div key={p} className="flex items-center gap-2.5 text-[14px] text-[#374151]">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 stroke-[2.5]" />
                  {p}
                </div>
              ))}
            </div>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <Link href="/login?tab=register" data-testid="link-hero-get-started">
                <button className="flex items-center gap-2 bg-primary text-white text-[14px] font-semibold px-5 py-2.5 rounded-[7px] hover:bg-[hsl(210,85%,38%)] transition-colors">
                  Get Started Free <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
            <p className="text-[12px] text-[#9ca3af] mt-3">No credit card required</p>
          </div>

          {/* Right: dashboard mockup */}
          <div className="hidden lg:flex justify-end items-center pt-6">
            <div className="w-full max-w-[530px]">
              <HeroDashboard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Trust Bar ────────────────────────────────────────────────────────────────
function TrustBar() {
  return (
    <div className="border-y border-[#e5e7eb] bg-[#f8fafc] py-4 px-6 lg:px-10" data-testid="section-trust">
      <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-4">
        {[
          { icon: Users, text: "Team & location management" },
          { icon: FileText, text: "One-click client reports" },
          { icon: Camera, text: "Before/after photo uploads" },
          { icon: Star, text: "Built-in review collection" },
          { icon: CreditCard, text: "Payroll hour tracking" },
          { icon: Shield, text: "Role-based access control" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-[12.5px] text-[#6b7280]">
            <Icon className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature Story Blocks ─────────────────────────────────────────────────────
function ReportMockup() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#fc6058]" />
        <div className="w-2 h-2 rounded-full bg-[#fec02f]" />
        <div className="w-2 h-2 rounded-full bg-[#2aca3e]" />
        <div className="flex-1 mx-3 bg-white border border-[#e5e7eb] rounded px-2 py-0.5 text-[9px] text-[#9ca3af] font-mono truncate">
          clockfield.com/r/abc123
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Service Report</div>
            <div className="text-[15px] font-bold text-[#111827]">Downtown Office</div>
            <div className="text-[11px] text-[#9ca3af]">March 27, 2026 · Sarah Mitchell</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-0.5 justify-end">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
            </div>
            <div className="text-[10px] text-[#6b7280] mt-0.5">Client Reviewed</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Before", src: cleanPhoto4 },
            { label: "During", src: cleanPhoto5 },
            { label: "After", src: cleanPhoto6 },
          ].map(({ label, src }) => (
            <div key={label} className="aspect-square rounded-[6px] overflow-hidden relative bg-[#e5e7eb]">
              <img src={src} alt={label} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-1.5 py-1">
                <span className="text-[8px] font-semibold text-white">{label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#f8fafc] rounded-[6px] p-3 border border-[#e5e7eb]">
          <div className="text-[9.5px] font-semibold text-[#374151] mb-1">Summary</div>
          <div className="text-[9px] text-[#6b7280] leading-relaxed">Full clean completed. All surfaces sanitized, windows cleaned, lobby mopped and dried. Client noted extra attention on conference room...</div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-[28px] rounded-[5px] bg-primary flex items-center justify-center">
            <span className="text-[9.5px] font-semibold text-white">Leave a Review</span>
          </div>
          <div className="flex-1 h-[28px] rounded-[5px] bg-[#f8fafc] border border-[#e5e7eb] flex items-center justify-center">
            <span className="text-[9.5px] font-medium text-[#374151]">Google Review ↗</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceMockup() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#374151]">Attendance — March 27</span>
        <span className="text-[9px] text-[#9ca3af]">3 / 4 active</span>
      </div>
      <div className="p-4 space-y-2.5">
        {[
          { name: "Sarah Mitchell", status: "On-site", in: "8:02 AM", out: "—", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { name: "James Kowalski", status: "Late", in: "9:20 AM", out: "—", badge: "bg-amber-50 text-amber-700 border-amber-200" },
          { name: "Ana Carvalho", status: "Scheduled", in: "2:00 PM", out: "—", badge: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]" },
          { name: "Marcus Lee", status: "Clocked Out", in: "7:00 AM", out: "3:12 PM", badge: "bg-blue-50 text-blue-700 border-blue-200" },
        ].map(e => (
          <div key={e.name} className="flex items-center gap-3 py-1.5 border-b border-[#f3f4f6] last:border-0">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
              {e.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-[#111827] truncate">{e.name}</div>
              <div className="text-[8.5px] text-[#9ca3af]">In: {e.in} · Out: {e.out}</div>
            </div>
            <div className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border ${e.badge}`}>{e.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkLogMockup() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#374151]">Work Log — Downtown Office</span>
        <div className="text-[8.5px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-1.5 py-0.5 rounded">Complete</div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="text-[9px] font-semibold text-[#9ca3af] uppercase tracking-widest mb-1.5">Service Summary</div>
          <div className="text-[10px] text-[#374151] leading-relaxed bg-[#f8fafc] rounded-[5px] p-2 border border-[#f0f0f0]">
            Full deep clean completed. All meeting rooms, restrooms, and lobby sanitized. Windows and glass surfaces cleaned. Kitchen area fully wiped and organized.
          </div>
        </div>
        <div>
          <div className="text-[9px] font-semibold text-[#9ca3af] uppercase tracking-widest mb-1.5">Photos (6)</div>
          <div className="grid grid-cols-3 gap-1.5">
            {[cleanPhoto1, cleanPhoto2, cleanPhoto3].map((src, i) => (
              <div key={i} className="aspect-[4/3] rounded-[4px] overflow-hidden bg-[#e5e7eb]">
                <img src={src} alt="Job photo" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="text-[9px] text-[#9ca3af]">Submitted: 3:45 PM · Sarah Mitchell</div>
          <div className="flex gap-1.5">
            <div className="text-[8.5px] font-medium text-primary border border-primary/30 rounded px-1.5 py-0.5">Share Report</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const featureBlocks = [
  {
    eyebrow: "Team & Attendance",
    heading: "Know exactly who's on-site, who's late, and who's missing.",
    body: "Clockfield gives you a real-time attendance overview across all your locations. Employees clock in and out from any device using their Employee ID and PIN.",
    bullets: ["Real-time clock-in/out with timestamps", "Late and missed shift alerts", "Admin manual clock-out with reason notes"],
    visual: <AttendanceMockup />,
    flip: false,
  },
  {
    eyebrow: "Work Documentation",
    heading: "Create jobs, collect before/after photos, and document every visit.",
    body: "Assign work to employees, add notes and service summaries, and let your team upload photos directly from the job site. Everything stays organized by client and date.",
    bullets: ["Per-job photo uploads from mobile", "Editable service summaries and notes", "Searchable work log history"],
    visual: <WorkLogMockup />,
    flip: true,
  },
  {
    eyebrow: "Client Reports & Reviews",
    heading: "Share a professional report with your client in one click.",
    body: "Generate a unique shareable link after every job. Clients view a polished report with photos, notes, and a service summary — and can leave a star rating right there.",
    bullets: ["Short shareable URLs, no login for clients", "Star ratings and written reviews", "Google Review link integration"],
    visual: <ReportMockup />,
    flip: false,
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6 lg:px-10 bg-white" data-testid="section-features">
      <div className="max-w-[1280px] mx-auto space-y-24">
        {featureBlocks.map((block, i) => (
          <div
            key={i}
            className={`grid lg:grid-cols-2 gap-14 items-center ${block.flip ? "lg:grid-flow-col-dense" : ""}`}
            data-testid={`feature-block-${i}`}
          >
            {/* Copy */}
            <div className={block.flip ? "lg:col-start-2" : ""}>
              <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">{block.eyebrow}</div>
              <h2 className="text-[30px] font-bold text-[#111827] leading-[1.2] tracking-[-0.02em] mb-4">{block.heading}</h2>
              <p className="text-[15px] text-[#4b5563] leading-[1.65] mb-6">{block.body}</p>
              <ul className="space-y-2.5">
                {block.bullets.map(b => (
                  <li key={b} className="flex items-start gap-2.5 text-[14px] text-[#374151]">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5 stroke-[2.5]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual */}
            <div className={block.flip ? "lg:col-start-1 lg:row-start-1" : ""}>
              {block.visual}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const steps = [
  { n: "01", title: "Set up your company", desc: "Add locations, configure timezone, upload your logo and brand color." },
  { n: "02", title: "Add employees and clients", desc: "Invite cleaners with a PIN login and set up client accounts per location." },
  { n: "03", title: "Schedule and assign shifts", desc: "Create recurring or one-time shifts and assign them to employees and locations." },
  { n: "04", title: "Document and complete work", desc: "Employees clock in, upload photos, add notes, and submit job reports from mobile." },
  { n: "05", title: "Share reports and collect reviews", desc: "Send a shareable link to clients. They view the report and can leave a review." },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-6 lg:px-10 bg-[#f8fafc]" data-testid="section-how-it-works">
      <div className="max-w-[1280px] mx-auto">
        <div className="max-w-[540px] mb-14">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">Simple to Start</div>
          <h2 className="text-[34px] font-bold text-[#111827] leading-[1.2] tracking-[-0.02em] mb-4">
            Up and running in minutes.
          </h2>
          <p className="text-[16px] text-[#4b5563] leading-[1.6]">
            No IT team required. Clockfield is built to get cleaning businesses operational fast.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative" data-testid={`step-${i}`}>
              {/* Connector (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-[18px] left-[calc(50%+20px)] right-[-50%] h-px bg-[#e5e7eb] z-0" />
              )}
              <div className="relative z-10">
                <div className="w-9 h-9 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-4">
                  <span className="text-[11px] font-bold text-primary">{s.n}</span>
                </div>
                <h3 className="text-[13px] font-semibold text-[#111827] mb-1.5">{s.title}</h3>
                <p className="text-[12px] text-[#6b7280] leading-[1.6]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-10 border-t border-[#e5e7eb]">
          <Link href="/login?tab=register" data-testid="link-how-it-works-cta">
            <button className="flex items-center gap-2 bg-primary text-white text-[14px] font-semibold px-5 py-2.5 rounded-[7px] hover:bg-[hsl(210,85%,38%)] transition-colors">
              Start your free account <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Roles Section ────────────────────────────────────────────────────────────
function RolesSection() {
  const roles = [
    {
      icon: Shield,
      title: "Business Owner / Admin",
      desc: "Run your entire operation from a single dashboard.",
      items: [
        "Real-time team attendance overview",
        "Client and location management",
        "Work log with photo review",
        "Payroll hour estimates",
        "Company branding and settings",
      ],
    },
    {
      icon: Users,
      title: "Employee / Cleaner",
      desc: "Log in on any device using your Employee ID and PIN.",
      items: [
        "Clock in and out from mobile",
        "View your personal schedule",
        "Upload before/after photos",
        "Submit work completion reports",
        "View pay stubs and worked hours",
      ],
    },
    {
      icon: Star,
      title: "Client",
      desc: "View your service report and leave a review — no account needed.",
      items: [
        "Open shareable report link",
        "See photos and job summary",
        "Leave a star rating and review",
        "Submit new service requests",
        "Track request status in portal",
      ],
    },
  ];

  return (
    <section className="py-24 px-6 lg:px-10 bg-white" data-testid="section-roles">
      <div className="max-w-[1280px] mx-auto">
        <div className="max-w-[540px] mb-12">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">Every Role Covered</div>
          <h2 className="text-[34px] font-bold text-[#111827] leading-[1.2] tracking-[-0.02em] mb-4">
            Built for everyone in your business.
          </h2>
          <p className="text-[16px] text-[#4b5563] leading-[1.6]">
            From the owner to the cleaner to the client — each role has a purpose-built view.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {roles.map((role, i) => (
            <div
              key={role.title}
              className="border border-[#e5e7eb] rounded-[10px] p-6 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow"
              data-testid={`card-role-${i}`}
            >
              <div className="w-9 h-9 rounded-[7px] bg-primary/8 flex items-center justify-center mb-4">
                <role.icon className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
              </div>
              <h3 className="text-[15px] font-semibold text-[#111827] mb-1">{role.title}</h3>
              <p className="text-[13px] text-[#6b7280] mb-4 leading-[1.5]">{role.desc}</p>
              <ul className="space-y-2">
                {role.items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-[#374151]">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5 stroke-[2.5]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
const plans = [
  {
    name: "Starter",
    monthly: 29,
    yearlyPerMonth: 26,
    yearlyTotal: Math.round(29 * 12 * 0.9),
    limits: "Up to 2 employees, 5 clients",
    desc: "Solo cleaners and very small operations.",
    features: ["Attendance & clock-in/out", "Employee login (ID + PIN)", "Client portal", "Basic scheduling", "Email support"],
    popular: false,
  },
  {
    name: "Growth",
    monthly: 79,
    yearlyPerMonth: 71,
    yearlyTotal: Math.round(79 * 12 * 0.9),
    limits: "Up to 5 employees, 10 clients",
    desc: "Growing cleaning businesses with multiple crews.",
    features: ["Everything in Starter", "Client requests & tracking", "Timesheet exports", "Work reports & sharing", "Review collection"],
    popular: true,
  },
  {
    name: "Pro",
    monthly: 129,
    yearlyPerMonth: 116,
    yearlyTotal: Math.round(129 * 12 * 0.9),
    limits: "Up to 10 employees, 15 clients",
    desc: "Full platform access for established teams.",
    features: ["Everything in Growth", "Work log & photo uploads", "Payroll estimates", "Pay stub generation", "Priority support"],
    popular: false,
  },
];

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 px-6 lg:px-10 bg-[#f8fafc]" data-testid="section-pricing">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div className="max-w-[480px]">
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">Pricing</div>
            <h2 className="text-[34px] font-bold text-[#111827] leading-[1.2] tracking-[-0.02em] mb-3">
              Simple, predictable plans.
            </h2>
            <p className="text-[15px] text-[#4b5563]">No hidden fees. Cancel anytime.</p>
          </div>
          {/* Toggle */}
          <div className="flex items-center gap-1 bg-[#e5e7eb] rounded-[7px] p-1 self-start sm:self-auto" data-testid="pricing-toggle">
            <button
              onClick={() => setAnnual(false)}
              className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[5px] transition-colors ${!annual ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280]"}`}
              data-testid="button-pricing-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[5px] transition-colors flex items-center gap-1.5 ${annual ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280]"}`}
              data-testid="button-pricing-annual"
            >
              Annual
              <span className="text-[9px] bg-emerald-500 text-white rounded-full px-1.5 py-0.5 font-bold">–10%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`rounded-[10px] p-7 flex flex-col relative ${plan.popular ? "bg-primary text-white shadow-[0_10px_40px_rgba(30,100,200,0.25)]" : "bg-white border border-[#e5e7eb]"}`}
              data-testid={`card-plan-${plan.name.toLowerCase()}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-6">
                  <span className="text-[10px] font-bold bg-[#111827] text-white px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}
              <div className="mb-5">
                <div className={`text-[13px] font-bold mb-1 ${plan.popular ? "text-white/80" : "text-[#374151]"}`}>{plan.name}</div>
                <div className={`text-[11px] mb-4 ${plan.popular ? "text-white/60" : "text-[#9ca3af]"}`}>{plan.limits}</div>
                <div className="flex items-end gap-1">
                  <span className="text-[38px] font-bold leading-none">
                    ${annual ? plan.yearlyPerMonth : plan.monthly}
                  </span>
                  <span className={`text-[13px] mb-1.5 ${plan.popular ? "text-white/70" : "text-[#9ca3af]"}`}>/mo</span>
                </div>
                {annual && <p className={`text-[11px] mt-1 ${plan.popular ? "text-white/60" : "text-[#9ca3af]"}`}>Billed ${plan.yearlyTotal}/year</p>}
              </div>

              <ul className="space-y-2.5 mb-7 flex-1">
                {plan.features.map(f => (
                  <li key={f} className={`flex items-start gap-2 text-[13px] ${plan.popular ? "text-white/90" : "text-[#374151]"}`}>
                    <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 stroke-[2.5] ${plan.popular ? "text-white" : "text-primary"}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href="/login?tab=register" data-testid={`link-plan-${plan.name.toLowerCase()}`}>
                <button
                  className={`w-full py-2.5 rounded-[7px] text-[13.5px] font-semibold transition-colors ${
                    plan.popular
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-[#111827] text-white hover:bg-[#1f2937]"
                  }`}
                >
                  Get started
                </button>
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-[13px] text-[#9ca3af] mt-8">
          Need more capacity?{" "}
          <a href="mailto:support@clockfield.com" className="text-primary hover:underline underline-offset-2" data-testid="link-contact-sales">Contact us</a>{" "}
          for a custom plan.
        </p>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const faqs = [
  { q: "What is Clockfield?", a: "Clockfield is a workforce operations platform for cleaning and field service businesses. It covers team scheduling, employee clock-in/out, work documentation with photos, shareable client reports, review collection, and payroll hour tracking." },
  { q: "Is it only for cleaning companies?", a: "Clockfield is optimized for cleaning businesses, but it works for any service operation that needs staff scheduling, job documentation, and client reporting." },
  { q: "How do employees log in?", a: "Employees use a separate Employee tab on the login page, signing in with their Employee ID (like EMP-1001) and a PIN set by their manager. No email required." },
  { q: "Can I share reports with clients without them creating an account?", a: "Yes. After a job is completed, you generate a unique shareable link and send it to your client. They open a professional report page — no account, no download required." },
  { q: "Can clients leave reviews?", a: "Yes. The client report page has a built-in star rating and review form. You can also add a direct Google Review link so clients can post there too." },
  { q: "Does Clockfield work on mobile?", a: "Yes, fully. Employees use it on mobile to clock in/out and submit job photos. Admins manage everything from desktop or mobile. Client reports are optimized for phone viewing." },
  { q: "Can I manage multiple locations?", a: "Yes. You can set up multiple locations, assign employees per location, and schedule shifts accordingly. Each client can have their own location." },
  { q: "What happens after I sign up?", a: "You create your company, add employees and clients, and start assigning shifts. The full platform is available immediately — no complex onboarding process." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-6 lg:px-10 bg-white" data-testid="section-faq">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid lg:grid-cols-[320px_1fr] gap-16">
          {/* Left label */}
          <div>
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">FAQ</div>
            <h2 className="text-[34px] font-bold text-[#111827] leading-[1.2] tracking-[-0.02em] mb-4">
              Common questions
            </h2>
            <p className="text-[15px] text-[#4b5563] leading-[1.6]">
              Still have questions?{" "}
              <a href="mailto:support@clockfield.com" className="text-primary hover:underline underline-offset-2">
                Email us
              </a>.
            </p>
          </div>

          {/* Accordion */}
          <div className="space-y-px" role="list">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="border-b border-[#f0f0f0] first:border-t"
                data-testid={`faq-item-${i}`}
                role="listitem"
              >
                <button
                  className="w-full flex items-center justify-between py-4 text-left gap-8"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                >
                  <span className={`text-[14px] font-medium transition-colors ${open === i ? "text-primary" : "text-[#111827]"}`}>
                    {faq.q}
                  </span>
                  {open === i
                    ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />}
                </button>
                {open === i && (
                  <div className="pb-4 text-[14px] text-[#4b5563] leading-[1.7] pr-10">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-20 px-6 lg:px-10 bg-[#111827]" data-testid="section-final-cta">
      <div className="max-w-[1280px] mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        <div className="max-w-[560px]">
          <h2 className="text-[36px] font-bold text-white leading-[1.15] tracking-[-0.02em] mb-3">
            Ready to get your operation organized?
          </h2>
          <p className="text-[16px] text-white/60 leading-[1.6]">
            Takes under 5 minutes to set up. No credit card required.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/login?tab=register" data-testid="link-final-cta-register">
            <button className="flex items-center gap-2 bg-white text-[#111827] text-[14px] font-semibold px-5 py-2.5 rounded-[7px] hover:bg-white/90 transition-colors">
              Create free account <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
          <Link href="/login" data-testid="link-final-cta-login">
            <button className="text-[14px] font-medium text-white/80 border border-white/20 px-5 py-2.5 rounded-[7px] hover:bg-white/8 transition-colors">
              Log In
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function MarketingFooter() {
  return (
    <footer className="bg-[#0f172a] text-white/50 py-12 px-6 lg:px-10" data-testid="footer-marketing">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[5px] bg-primary flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-white text-[14px] font-semibold">ClockField</span>
            </div>
            <p className="text-[12.5px] leading-relaxed">
              Workforce management for cleaning and field service businesses.
            </p>
          </div>
          <div>
            <h4 className="text-white text-[12px] font-semibold mb-3 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-[12.5px]">
              {[
                { label: "Features", href: "#features", scroll: true },
                { label: "How It Works", href: "#how-it-works", scroll: true },
                { label: "Pricing", href: "#pricing", scroll: true },
                { label: "FAQ", href: "#faq", scroll: true },
              ].map(l => (
                <li key={l.label}>
                  <button
                    onClick={() => scrollTo(l.href)}
                    className="hover:text-white transition-colors"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white text-[12px] font-semibold mb-3 uppercase tracking-wider">Access</h4>
            <ul className="space-y-2 text-[12.5px]">
              <li><Link href="/login?tab=register" className="hover:text-white transition-colors" data-testid="footer-link-register">Get Started</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors" data-testid="footer-link-login">Log In</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors" data-testid="footer-link-employee">Employee Access</Link></li>
              <li><Link href="/forgot-password" className="hover:text-white transition-colors" data-testid="footer-link-forgot">Forgot Password</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-[12px] font-semibold mb-3 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-[12.5px]">
              <li><a href="mailto:support@clockfield.com" className="hover:text-white transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11.5px]">
          <span>© {new Date().getFullYear()} ClockField. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <span className="opacity-40">Privacy Policy</span>
            <span className="opacity-40">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  useEffect(() => {
    document.title = "ClockField — Workforce Management for Cleaning Businesses";
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {announcementVisible && <AnnouncementBar onDismiss={() => setAnnouncementVisible(false)} />}
      <MarketingHeader />
      <main>
        <HeroSection />
        <TrustBar />
        <FeaturesSection />
        <HowItWorksSection />
        <RolesSection />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
