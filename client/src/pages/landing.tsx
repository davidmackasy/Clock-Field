import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  Clock, Users, FileText, Star, ChevronDown, ChevronUp,
  Menu, X, Camera, BarChart3, Shield, ClipboardList,
  ArrowRight, Check, MapPin, Bell, CreditCard, MessageSquare,
  CheckCircle2, Calendar, BookOpen, AlertTriangle,
  DollarSign, Building2, Home, Wrench, Package, Award,
  ChevronRight, Zap, Globe, TrendingUp, PenLine, Layers,
  Quote
} from "lucide-react";

const cleanPhoto1 = "/cleaning-photos/desk_before.png";
const cleanPhoto2 = "/cleaning-photos/desk_during.png";
const cleanPhoto3 = "/cleaning-photos/desk_after.png";
const cleanPhoto4 = "/cleaning-photos/floor_before.png";
const cleanPhoto5 = "/cleaning-photos/floor_during.png";
const cleanPhoto6 = "/cleaning-photos/floor_after.png";

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
      <Link href="/login?tab=register" className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity ml-1 whitespace-nowrap">
        Try it free →
      </Link>
      <button onClick={onDismiss} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss" data-testid="button-dismiss-announcement">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Header with dropdowns ────────────────────────────────────────────────────
type DropdownKey = "product" | "solutions" | "resources" | null;

function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<DropdownKey>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const productLinks = [
    { icon: Calendar, label: "Scheduling", desc: "Plan shifts and assign cleaners" },
    { icon: CheckCircle2, label: "Attendance", desc: "Track clock-ins and hours" },
    { icon: ClipboardList, label: "Worklogs", desc: "Before/after photos and notes" },
    { icon: FileText, label: "Client Reports", desc: "Shareable public report links" },
    { icon: BookOpen, label: "Training", desc: "Courses and completion tracking" },
    { icon: DollarSign, label: "Payroll", desc: "Hour-based payroll estimates" },
    { icon: AlertTriangle, label: "Incident Reports", desc: "Signed incident report PDFs" },
    { icon: PenLine, label: "Quotes", desc: "Build and send cleaning quotes" },
  ];

  const solutionLinks = [
    { label: "Commercial Cleaning", href: "#industries" },
    { label: "Janitorial Companies", href: "#industries" },
    { label: "Residential Cleaning", href: "#industries" },
    { label: "Property Maintenance", href: "#industries" },
    { label: "Small Cleaning Teams", href: "#industries" },
    { label: "Growing Service Businesses", href: "#industries" },
  ];

  const resourceLinks = [
    { label: "Help Center", href: "mailto:support@clockfield.com" },
    { label: "Contact Us", href: "mailto:support@clockfield.com" },
    { label: "Book a Demo", href: "/login?tab=register" },
  ];

  return (
    <header ref={headerRef} className={`sticky top-0 z-50 bg-white transition-all duration-150 ${scrolled ? "border-b border-[#e5e7eb] shadow-[0_1px_6px_rgba(0,0,0,0.07)]" : "border-b border-transparent"}`} data-testid="header-marketing">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-[64px]">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" data-testid="link-logo">
            <div className="w-8 h-8 rounded-[7px] bg-primary flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-[#111827]">ClockField</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {(["product", "solutions", "resources"] as DropdownKey[]).map((key) => (
              <div key={key} className="relative">
                <button
                  onMouseEnter={() => setOpenMenu(key)}
                  onFocus={() => setOpenMenu(key)}
                  className={`flex items-center gap-1 text-[13.5px] font-medium px-3.5 py-2 rounded-[6px] transition-colors ${openMenu === key ? "text-primary bg-primary/6" : "text-[#4b5563] hover:text-[#111827] hover:bg-[#f3f4f6]"}`}
                >
                  {key === "product" ? "Product" : key === "solutions" ? "Solutions" : "Resources"}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openMenu === key ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openMenu === key && (
                  <div onMouseLeave={() => setOpenMenu(null)} className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 min-w-[480px]">
                    <div className="bg-white border border-[#e5e7eb] rounded-[12px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] p-3">
                      {key === "product" && (
                        <div className="grid grid-cols-2 gap-1">
                          {productLinks.map(({ icon: Icon, label, desc }) => (
                            <button key={label} onClick={() => { scrollTo("#features"); setOpenMenu(null); }} className="flex items-start gap-3 px-3 py-2.5 rounded-[8px] hover:bg-[#f8fafc] text-left transition-colors">
                              <div className="w-7 h-7 rounded-[6px] bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div>
                                <div className="text-[13px] font-semibold text-[#111827]">{label}</div>
                                <div className="text-[11.5px] text-[#9ca3af]">{desc}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {key === "solutions" && (
                        <div className="grid grid-cols-2 gap-1">
                          {solutionLinks.map(({ label, href }) => (
                            <button key={label} onClick={() => { scrollTo(href); setOpenMenu(null); }} className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] hover:bg-[#f8fafc] text-left transition-colors text-[13.5px] text-[#374151] font-medium hover:text-[#111827]">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                      {key === "resources" && (
                        <div>
                          {resourceLinks.map(({ label, href }) => (
                            href.startsWith("mailto:") || href.startsWith("/") ? (
                              <a key={label} href={href} className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] hover:bg-[#f8fafc] text-[13.5px] text-[#374151] font-medium hover:text-[#111827] transition-colors">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                                {label}
                              </a>
                            ) : null
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button onClick={() => scrollTo("#pricing")} className="text-[13.5px] font-medium px-3.5 py-2 rounded-[6px] text-[#4b5563] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors">
              Pricing
            </button>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2">
            <Link href="/login" data-testid="link-header-login">
              <button className="text-[13.5px] font-medium text-[#374151] hover:text-[#111827] px-4 py-2 rounded-[6px] hover:bg-[#f3f4f6] transition-colors">
                Log In
              </button>
            </Link>
            <Link href="/login?tab=register" data-testid="link-header-get-started">
              <button className="text-[13.5px] font-semibold bg-primary text-white px-4.5 py-2 rounded-[7px] hover:bg-[hsl(210,85%,38%)] transition-colors shadow-[0_1px_3px_rgba(30,100,200,0.25)]" style={{ paddingLeft: 18, paddingRight: 18 }}>
                Start Free Trial
              </button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="lg:hidden p-2 -mr-1 rounded-md text-[#374151] hover:bg-[#f3f4f6] transition-colors" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu" data-testid="button-mobile-menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#e5e7eb] bg-white shadow-lg" data-testid="mobile-nav-drawer">
          <div className="max-w-[1280px] mx-auto px-6 py-4 space-y-1">
            {(["product", "solutions", "resources"] as const).map((key) => (
              <div key={key}>
                <button
                  onClick={() => setMobileExpanded(mobileExpanded === key ? null : key)}
                  className="w-full flex items-center justify-between text-left text-[14px] font-medium text-[#374151] py-2.5 border-b border-[#f3f4f6]"
                >
                  {key === "product" ? "Product" : key === "solutions" ? "Solutions" : "Resources"}
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpanded === key ? "rotate-180" : ""}`} />
                </button>
                {mobileExpanded === key && (
                  <div className="py-2 pl-3 space-y-0.5">
                    {key === "product" && productLinks.map(({ label }) => (
                      <button key={label} onClick={() => { scrollTo("#features"); setMobileOpen(false); }} className="block w-full text-left text-[13px] text-[#6b7280] py-1.5 hover:text-primary transition-colors">{label}</button>
                    ))}
                    {key === "solutions" && solutionLinks.map(({ label, href }) => (
                      <button key={label} onClick={() => { scrollTo(href); setMobileOpen(false); }} className="block w-full text-left text-[13px] text-[#6b7280] py-1.5 hover:text-primary transition-colors">{label}</button>
                    ))}
                    {key === "resources" && resourceLinks.map(({ label, href }) => (
                      <a key={label} href={href} className="block text-[13px] text-[#6b7280] py-1.5 hover:text-primary transition-colors">{label}</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => { scrollTo("#pricing"); setMobileOpen(false); }} className="block w-full text-left text-[14px] font-medium text-[#374151] py-2.5 border-b border-[#f3f4f6]">
              Pricing
            </button>
            <div className="pt-3 flex flex-col gap-2">
              <Link href="/login?tab=register" onClick={() => setMobileOpen(false)} data-testid="link-mobile-get-started">
                <button className="w-full text-[14px] font-semibold bg-primary text-white py-2.5 rounded-[7px] hover:bg-[hsl(210,85%,38%)] transition-colors">
                  Start Free Trial
                </button>
              </Link>
              <Link href="/login" onClick={() => setMobileOpen(false)} data-testid="link-mobile-login">
                <button className="w-full text-[14px] font-medium text-[#374151] py-2.5 rounded-[7px] border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors">
                  Log In
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
      <div className="rounded-[12px] border border-[#e5e7eb] shadow-[0_24px_64px_rgba(0,0,0,0.13)] overflow-hidden bg-white">
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#f5f5f5] border-b border-[#e5e7eb]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#fc6058]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#fec02f]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#2aca3e]" />
          <div className="flex-1 mx-3 bg-white border border-[#e5e7eb] rounded-[4px] px-2.5 py-[3px] text-[10px] text-[#9ca3af] font-mono">
            app.clockfield.com/admin
          </div>
        </div>
        <div className="flex" style={{ height: 340 }}>
          <div className="w-[160px] bg-[#f8fafc] border-r border-[#e5e7eb] flex-shrink-0 p-3 flex flex-col gap-0.5">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                <Clock className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-[#111827]">ClockField</span>
            </div>
            {[
              { label: "Dashboard", active: true, icon: BarChart3 },
              { label: "Employees", active: false, icon: Users },
              { label: "Schedule", active: false, icon: Calendar },
              { label: "Attendance", active: false, icon: CheckCircle2 },
              { label: "Work Log", active: false, icon: ClipboardList },
              { label: "Clients", active: false, icon: MapPin },
              { label: "Payroll", active: false, icon: DollarSign },
              { label: "Training", active: false, icon: BookOpen },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-2 px-2 py-1.5 rounded-[4px] ${item.active ? "bg-primary/10 text-primary" : "text-[#6b7280]"}`}>
                <item.icon className="w-3 h-3 flex-shrink-0" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-hidden bg-white space-y-3">
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
            <div>
              <div className="text-[9px] font-semibold text-[#9ca3af] uppercase tracking-widest mb-1.5">Today's Shifts</div>
              <div className="space-y-1">
                {[
                  { name: "Sarah Mitchell", job: "Downtown Office — Floor 3", status: "On-site", dot: "bg-emerald-500", time: "8:02 AM" },
                  { name: "James Kowalski", job: "Riverside Plaza", status: "Late", dot: "bg-amber-500", time: "9:15 AM" },
                  { name: "Ana Carvalho", job: "Westside Mall", status: "Scheduled", dot: "bg-[#d1d5db]", time: "2:00 PM" },
                ].map(e => (
                  <div key={e.name} className="flex items-center gap-2 px-2 py-1.5 rounded-[5px] bg-[#f8fafc] border border-[#f0f0f0]">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-semibold text-primary flex-shrink-0">{e.name[0]}</div>
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

      {/* Floating cards */}
      <div className="absolute -bottom-5 -right-4 w-[185px] bg-white rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.10)] p-3">
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

      <div className="absolute -top-4 -left-4 bg-white rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.10)] px-3 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-[#111827]">Clocked In</div>
          <div className="text-[8.5px] text-[#9ca3af]">Sarah M. · 8:02 AM</div>
        </div>
      </div>

      <div className="absolute top-1/2 -right-6 -translate-y-1/2 bg-white rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.10)] px-3 py-2.5 hidden xl:flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-3 h-3 text-primary" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-[#111827]">Training Done</div>
          <div className="text-[8.5px] text-[#9ca3af]">Safety Course · 100%</div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-14 sm:pt-20 pb-16 sm:pb-24 px-6 lg:px-10 bg-gradient-to-br from-white via-[#f0f6ff] to-white" data-testid="section-hero">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/4 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl pointer-events-none" />

      <div className="max-w-[1280px] mx-auto relative">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-16 items-center">
          {/* Left copy */}
          <div className="max-w-[520px] sm:max-w-none">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-[12px] font-semibold px-3.5 py-1.5 rounded-full mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Built for cleaning &amp; service businesses
            </div>

            <h1 className="text-[36px] sm:text-[52px] font-bold text-[#111827] leading-[1.1] sm:leading-[1.08] tracking-[-0.03em] mb-5">
              Run your cleaning business from{" "}
              <span className="text-primary">one simple platform</span>
            </h1>

            <p className="text-[16px] sm:text-[18px] text-[#4b5563] leading-[1.65] mb-6 max-w-[460px]">
              Clockfield helps cleaning and service businesses manage schedules, employees, attendance, worklogs, client reports, payroll, training, quotes, and incident reports — in one connected system.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-start mb-5">
              <Link href="/login?tab=register" data-testid="link-hero-get-started">
                <button className="flex items-center gap-2 bg-primary text-white text-[15px] font-semibold px-6 py-3 rounded-[8px] hover:bg-[hsl(210,85%,36%)] transition-colors shadow-[0_2px_8px_rgba(30,100,200,0.30)]">
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <button onClick={() => scrollTo("#features")} data-testid="button-hero-demo" className="flex items-center gap-2 text-[15px] font-semibold text-[#374151] px-6 py-3 rounded-[8px] border border-[#d1d5db] hover:bg-white hover:border-[#9ca3af] transition-colors bg-white/70">
                See how it works
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[#9ca3af]">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                No credit card required
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                Free to start
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                Cancel anytime
              </div>
            </div>
          </div>

          {/* Right: dashboard mockup */}
          <div className="hidden lg:flex justify-end items-center pt-4">
            <div className="w-full max-w-[560px]">
              <HeroDashboard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Three Value Cards ────────────────────────────────────────────────────────
function ValueCardsSection() {
  const cards = [
    {
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      title: "Manage your team",
      desc: "Keep cleaners, supervisors, and admins synced with schedules, attendance, roles, and job updates.",
    },
    {
      icon: Camera,
      color: "bg-emerald-50 text-emerald-600",
      title: "Prove the work",
      desc: "Create before-and-after worklogs, field notes, client reports, and public links that show exactly what was completed.",
    },
    {
      icon: Zap,
      color: "bg-violet-50 text-violet-600",
      title: "Save admin time",
      desc: "Automate reminders, training assignments, payroll preparation, reports, and operational follow-ups.",
    },
  ];

  return (
    <section className="py-12 px-6 lg:px-10 bg-white border-b border-[#e5e7eb]" data-testid="section-value-cards">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <div key={i} className="flex items-start gap-4 p-5 rounded-[12px] border border-[#e5e7eb] hover:border-primary/20 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all" data-testid={`card-value-${i}`}>
              <div className={`w-10 h-10 rounded-[10px] ${card.color} flex items-center justify-center flex-shrink-0`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#111827] mb-1">{card.title}</h3>
                <p className="text-[13.5px] text-[#6b7280] leading-[1.55]">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Industry Strip ───────────────────────────────────────────────────────────
function IndustryStripSection() {
  const badges = [
    "Commercial Cleaning", "Janitorial Teams", "Residential Cleaning",
    "Property Maintenance", "Building Maintenance", "Facility Services", "Office Cleaning", "Post-Construction",
  ];

  return (
    <section className="bg-[#f8fafc] py-10 px-6 lg:px-10 border-b border-[#e5e7eb]" data-testid="section-industry-strip">
      <div className="max-w-[1280px] mx-auto">
        <p className="text-center text-[12.5px] font-semibold text-[#9ca3af] uppercase tracking-[0.08em] mb-5">
          Built for cleaning and service teams that need better operations
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {badges.map(b => (
            <span key={b} className="text-[12.5px] font-medium text-[#374151] bg-white border border-[#e5e7eb] px-3.5 py-1.5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Feature Tabs Section ─────────────────────────────────────────────────────
type FeatureTab = "scheduling" | "attendance" | "worklogs" | "reports" | "training" | "payroll" | "quotes" | "incidents";

function SchedulingPreview() {
  const shifts = [
    { name: "Sarah Mitchell", location: "Downtown Office — Floor 3", time: "8:00 AM – 4:00 PM", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { name: "James Kowalski", location: "Riverside Plaza", time: "9:00 AM – 5:00 PM", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    { name: "Ana Carvalho", location: "Westside Mall", time: "2:00 PM – 10:00 PM", color: "bg-violet-100 text-violet-700 border-violet-200" },
    { name: "Marcus Lee", location: "City Hall Lobby", time: "6:00 AM – 2:00 PM", color: "bg-amber-100 text-amber-700 border-amber-200" },
  ];
  return (
    <div className="bg-white rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">Schedule — Thursday, March 27</span>
        <div className="text-[9.5px] bg-primary text-white font-semibold px-2 py-0.5 rounded-full">4 shifts</div>
      </div>
      <div className="p-4 space-y-2">
        {shifts.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-[7px] border px-3 py-2.5 ${s.color}`}>
            <div className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-[9px] font-bold flex-shrink-0">{s.name[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-semibold truncate">{s.name}</div>
              <div className="text-[9px] opacity-80 truncate">{s.location}</div>
            </div>
            <div className="text-[8.5px] font-medium opacity-80 flex-shrink-0 whitespace-nowrap">{s.time}</div>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <div className="flex-1 h-8 rounded-[6px] bg-primary/8 border border-primary/20 flex items-center justify-center">
            <span className="text-[9.5px] font-semibold text-primary">+ Add Shift</span>
          </div>
          <div className="flex-1 h-8 rounded-[6px] bg-[#f8fafc] border border-[#e5e7eb] flex items-center justify-center">
            <span className="text-[9.5px] font-medium text-[#6b7280]">Weekly View</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendancePreview() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">Attendance — March 27</span>
        <span className="text-[9.5px] text-[#9ca3af]">3 / 4 active</span>
      </div>
      <div className="p-4 space-y-2">
        {[
          { name: "Sarah Mitchell", status: "On-site", in: "8:02 AM", out: "—", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { name: "James Kowalski", status: "Late", in: "9:20 AM", out: "—", badge: "bg-amber-50 text-amber-700 border-amber-200" },
          { name: "Ana Carvalho", status: "Scheduled", in: "2:00 PM", out: "—", badge: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]" },
          { name: "Marcus Lee", status: "Clocked Out", in: "7:00 AM", out: "3:12 PM", badge: "bg-blue-50 text-blue-700 border-blue-200" },
        ].map(e => (
          <div key={e.name} className="flex items-center gap-3 py-2 border-b border-[#f3f4f6] last:border-0">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">{e.name[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-semibold text-[#111827] truncate">{e.name}</div>
              <div className="text-[8.5px] text-[#9ca3af]">In: {e.in} · Out: {e.out}</div>
            </div>
            <div className={`text-[8.5px] font-semibold px-1.5 py-0.5 rounded border ${e.badge}`}>{e.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorklogPreview() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">Work Log — Downtown Office</span>
        <div className="text-[8.5px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-1.5 py-0.5 rounded">Complete</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-[10px] text-[#374151] leading-relaxed bg-[#f8fafc] rounded-[5px] p-2.5 border border-[#f0f0f0]">
          Full deep clean completed. All meeting rooms, restrooms, and lobby sanitized. Windows cleaned. Kitchen wiped and organized.
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[cleanPhoto1, cleanPhoto2, cleanPhoto3].map((src, i) => (
            <div key={i} className="aspect-[4/3] rounded-[4px] overflow-hidden bg-[#e5e7eb]">
              <img src={src} alt="Job photo" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <div className="text-[9px] text-[#9ca3af]">Sarah Mitchell · 3:45 PM</div>
          <div className="text-[8.5px] font-medium text-primary border border-primary/30 rounded px-2 py-0.5">Share Report</div>
        </div>
      </div>
    </div>
  );
}

function ReportPreview() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-2.5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#fc6058]" /><div className="w-2 h-2 rounded-full bg-[#fec02f]" /><div className="w-2 h-2 rounded-full bg-[#2aca3e]" />
        <div className="flex-1 mx-2 bg-white border border-[#e5e7eb] rounded px-2 py-0.5 text-[9px] text-[#9ca3af] font-mono truncate">clockfield.com/r/abc123</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-0.5">Service Report</div>
            <div className="text-[13px] font-bold text-[#111827]">Downtown Office</div>
            <div className="text-[9.5px] text-[#9ca3af]">March 27, 2026 · Sarah Mitchell</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-0.5 justify-end">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />)}
            </div>
            <div className="text-[9px] text-[#6b7280] mt-0.5">Client Reviewed</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[cleanPhoto4, cleanPhoto5, cleanPhoto6].map((src, i) => (
            <div key={i} className="aspect-square rounded-[5px] overflow-hidden bg-[#e5e7eb]">
              <img src={src} alt="photo" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-7 rounded-[5px] bg-primary flex items-center justify-center">
            <span className="text-[9px] font-semibold text-white">Leave a Review</span>
          </div>
          <div className="flex-1 h-7 rounded-[5px] bg-[#f8fafc] border border-[#e5e7eb] flex items-center justify-center">
            <span className="text-[9px] font-medium text-[#374151]">Google Review ↗</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainingPreview() {
  const courses = [
    { name: "Cleaning Safety Standards", pct: 100, badge: "bg-emerald-50 text-emerald-700 border-emerald-200", status: "Complete" },
    { name: "Chemical Handling & WHMIS", pct: 65, badge: "bg-amber-50 text-amber-700 border-amber-200", status: "In Progress" },
    { name: "Customer Interaction Guide", pct: 0, badge: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]", status: "Not Started" },
  ];
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">Training Hub — Assigned Courses</span>
        <span className="text-[9px] text-[#9ca3af]">3 courses</span>
      </div>
      <div className="p-4 space-y-3">
        {courses.map((c, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-medium text-[#111827]">{c.name}</span>
              <span className={`text-[8.5px] font-semibold border px-1.5 py-0.5 rounded ${c.badge}`}>{c.status}</span>
            </div>
            <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${c.pct}%` }} />
            </div>
            <div className="text-[9px] text-[#9ca3af]">{c.pct}% complete</div>
          </div>
        ))}
        <div className="pt-1">
          <div className="h-7 rounded-[6px] bg-primary/8 border border-primary/20 flex items-center justify-center">
            <span className="text-[9.5px] font-semibold text-primary">Issue Certificate</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayrollPreview() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">Payroll — Mar 16–31, 2026</span>
        <div className="text-[9px] bg-primary text-white font-semibold px-2 py-0.5 rounded-full">4 employees</div>
      </div>
      <div className="p-4 space-y-2.5">
        {[
          { name: "Sarah Mitchell", hrs: "78.5 hrs", rate: "$18/hr", gross: "$1,413" },
          { name: "James Kowalski", hrs: "72.0 hrs", rate: "$17/hr", gross: "$1,224" },
          { name: "Ana Carvalho", hrs: "80.0 hrs", rate: "$16/hr", gross: "$1,280" },
          { name: "Marcus Lee", hrs: "68.5 hrs", rate: "$19/hr", gross: "$1,301.50" },
        ].map(e => (
          <div key={e.name} className="flex items-center gap-2 py-1.5 border-b border-[#f3f4f6] last:border-0">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">{e.name[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-[#111827] truncate">{e.name}</div>
              <div className="text-[8.5px] text-[#9ca3af]">{e.hrs} · {e.rate}</div>
            </div>
            <div className="text-[10.5px] font-bold text-[#111827] flex-shrink-0">{e.gross}</div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1 bg-[#f8fafc] rounded-[6px] px-3 py-2 border border-[#e5e7eb]">
          <span className="text-[10px] font-semibold text-[#374151]">Total Gross Estimate</span>
          <span className="text-[12px] font-bold text-primary">$5,218.50</span>
        </div>
      </div>
    </div>
  );
}

function QuotesPreview() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">Quote #QT-0042 — Draft</span>
        <div className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-1.5 py-0.5 rounded">Draft</div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="text-[9px] text-[#9ca3af] uppercase tracking-widest mb-1">Client</div>
          <div className="text-[11px] font-semibold text-[#111827]">Riverside Office Park</div>
          <div className="text-[9px] text-[#9ca3af]">Commercial · 3 floors · Bi-weekly</div>
        </div>
        <div className="space-y-1.5">
          {[
            { item: "General Cleaning (bi-weekly)", price: "$320.00" },
            { item: "Window Cleaning (monthly)", price: "$140.00" },
            { item: "Deep Carpet Cleaning", price: "$180.00" },
          ].map((line, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#f3f4f6] last:border-0">
              <span className="text-[10px] text-[#374151]">{line.item}</span>
              <span className="text-[10px] font-semibold text-[#111827]">{line.price}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-[#f8fafc] rounded-[5px] px-3 py-2 border border-[#e5e7eb]">
          <span className="text-[10px] font-semibold text-[#374151]">Total Monthly</span>
          <span className="text-[12px] font-bold text-primary">$640.00</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-7 rounded-[5px] bg-primary flex items-center justify-center">
            <span className="text-[9px] font-semibold text-white">Send Quote</span>
          </div>
          <div className="flex-1 h-7 rounded-[5px] bg-[#f8fafc] border border-[#e5e7eb] flex items-center justify-center">
            <span className="text-[9px] font-medium text-[#374151]">Download PDF</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentsPreview() {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">Incident Report #IR-0018</span>
        <div className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-1.5 py-0.5 rounded">Signed</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[8.5px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Date</div>
            <div className="text-[10.5px] font-semibold text-[#111827]">March 27, 2026</div>
          </div>
          <div>
            <div className="text-[8.5px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Location</div>
            <div className="text-[10.5px] font-semibold text-[#111827]">Downtown Office</div>
          </div>
          <div>
            <div className="text-[8.5px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Reported By</div>
            <div className="text-[10.5px] font-semibold text-[#111827]">Sarah Mitchell</div>
          </div>
          <div>
            <div className="text-[8.5px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Severity</div>
            <div className="text-[10.5px] font-semibold text-amber-600">Minor</div>
          </div>
        </div>
        <div className="bg-[#f8fafc] rounded-[5px] p-2.5 border border-[#e5e7eb]">
          <div className="text-[9px] text-[#6b7280] leading-relaxed">Slip on wet floor near entrance. Area was clearly marked with wet floor signs. No injury reported. Client notified.</div>
        </div>
        <div className="flex items-center gap-2 py-1.5 border border-[#e5e7eb] rounded-[5px] px-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] text-[#374151]">Employee signature collected</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-7 rounded-[5px] bg-primary flex items-center justify-center">
            <span className="text-[9px] font-semibold text-white">Download PDF</span>
          </div>
          <div className="flex-1 h-7 rounded-[5px] bg-[#f8fafc] border border-[#e5e7eb] flex items-center justify-center">
            <span className="text-[9px] font-medium text-[#374151]">Send to Client</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const featureTabs: { key: FeatureTab; icon: any; label: string; headline: string; desc: string; bullets: string[]; preview: () => JSX.Element }[] = [
  {
    key: "scheduling",
    icon: Calendar,
    label: "Scheduling",
    headline: "Plan jobs, manage shifts, and keep every team member on track.",
    desc: "Build daily and recurring schedules, assign cleaners to locations, and give your team a clear view of their upcoming shifts.",
    bullets: ["Daily and recurring shift scheduling", "Assign cleaners to locations and jobs", "Admin and employee schedule views"],
    preview: () => <SchedulingPreview />,
  },
  {
    key: "attendance",
    icon: CheckCircle2,
    label: "Attendance",
    headline: "Track clock-ins, clock-outs, overtime, and missed shifts.",
    desc: "Employees clock in and out from any device. Admins get a real-time attendance overview with late alerts and full history.",
    bullets: ["Real-time clock-in/out with timestamps", "Late and missed shift alerts", "Admin manual adjustments with reason notes"],
    preview: () => <AttendancePreview />,
  },
  {
    key: "worklogs",
    icon: ClipboardList,
    label: "Worklogs",
    headline: "Document every job with photos, notes, and service summaries.",
    desc: "Let cleaners upload before-and-after photos, add service notes, and submit job progress directly from mobile.",
    bullets: ["Per-job before/after photo uploads", "Editable service summaries and notes", "Searchable work log history by client"],
    preview: () => <WorklogPreview />,
  },
  {
    key: "reports",
    icon: FileText,
    label: "Client Reports",
    headline: "Share a professional report with your client in one click.",
    desc: "Generate a unique shareable link after every job. Clients view a polished report with photos and can leave a star rating.",
    bullets: ["Short shareable URLs — no login for clients", "Star ratings and written reviews built in", "Google Review link integration"],
    preview: () => <ReportPreview />,
  },
  {
    key: "training",
    icon: BookOpen,
    label: "Training",
    headline: "Create courses, assign training, and track employee completion.",
    desc: "Build training modules, assign them to employees, track completion rates, and issue certificates when done.",
    bullets: ["Build custom training courses with content blocks", "Assign to employees and track progress", "Issue completion certificates"],
    preview: () => <TrainingPreview />,
  },
  {
    key: "payroll",
    icon: DollarSign,
    label: "Payroll",
    headline: "Prepare payroll estimates using hours, rates, and pay periods.",
    desc: "Pull attendance data for any pay period, apply hourly rates, and produce payroll summaries ready for processing.",
    bullets: ["Hour-based payroll estimates by employee", "Custom hourly rates and pay periods", "Export-ready pay period summaries"],
    preview: () => <PayrollPreview />,
  },
  {
    key: "quotes",
    icon: PenLine,
    label: "Quotes",
    headline: "Build cleaning quotes and send them to potential clients.",
    desc: "Create professional quotes for residential, commercial, and industrial jobs with line items, add-ons, and pricing.",
    bullets: ["Line item quote builder with totals", "PDF export and direct client delivery", "Track quote status (draft / sent / accepted)"],
    preview: () => <QuotesPreview />,
  },
  {
    key: "incidents",
    icon: AlertTriangle,
    label: "Incident Reports",
    headline: "Create incident reports, collect signatures, and export PDFs.",
    desc: "Document workplace incidents professionally. Collect employee signatures, notify clients, and export print-ready PDFs.",
    bullets: ["Professional incident report builder", "Employee digital signature collection", "PDF export and client notification"],
    preview: () => <IncidentsPreview />,
  },
];

function FeatureTabsSection() {
  const [activeTab, setActiveTab] = useState<FeatureTab>("scheduling");
  const tab = featureTabs.find(t => t.key === activeTab)!;

  return (
    <section id="features" className="py-20 sm:py-28 px-6 lg:px-10 bg-[#f8fafc]" data-testid="section-features">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center max-w-[620px] mx-auto mb-14">
          <div className="text-[11.5px] font-bold text-primary uppercase tracking-[0.08em] mb-3">Platform Features</div>
          <h2 className="text-[34px] sm:text-[42px] font-bold text-[#111827] leading-[1.15] tracking-[-0.025em] mb-4">
            Everything your cleaning business needs in one place
          </h2>
          <p className="text-[16px] text-[#4b5563] leading-[1.6]">
            From scheduling to reports, Clockfield keeps daily operations organized, visible, and easy to manage.
          </p>
        </div>

        {/* Tab navigation - scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-10 scrollbar-none -mx-1 px-1">
          {featureTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0 border ${activeTab === t.key ? "bg-primary text-white border-primary shadow-[0_2px_8px_rgba(30,100,200,0.25)]" : "bg-white text-[#6b7280] border-[#e5e7eb] hover:text-[#111827] hover:border-[#d1d5db]"}`}
            >
              <t.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="grid lg:grid-cols-[480px_1fr] gap-10 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-widest mb-3">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </div>
            <h3 className="text-[26px] sm:text-[30px] font-bold text-[#111827] leading-[1.2] tracking-[-0.02em] mb-4">{tab.headline}</h3>
            <p className="text-[15px] text-[#4b5563] leading-[1.65] mb-6">{tab.desc}</p>
            <ul className="space-y-2.5 mb-8">
              {tab.bullets.map(b => (
                <li key={b} className="flex items-start gap-2.5 text-[14px] text-[#374151]">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5 stroke-[2.5]" />
                  {b}
                </li>
              ))}
            </ul>
            <Link href="/login?tab=register" data-testid={`link-tab-cta-${activeTab}`}>
              <button className="flex items-center gap-2 text-[14px] font-semibold text-primary border border-primary/30 px-4.5 py-2.5 rounded-[7px] hover:bg-primary hover:text-white transition-colors" style={{ paddingLeft: 18, paddingRight: 18 }}>
                Try {tab.label} free <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>

          {/* Preview */}
          <div className="w-full max-w-[480px] mx-auto lg:mx-0">
            {tab.preview()}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Why Clockfield ───────────────────────────────────────────────────────────
function WhySection() {
  const reasons = [
    {
      icon: Zap,
      color: "bg-amber-50 text-amber-600",
      title: "Easy to onboard",
      desc: "Set up your team, schedules, clients, and job sites without complicated setup or IT support. Most businesses are running in under an hour.",
    },
    {
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      title: "Easy for cleaners to use",
      desc: "Mobile-friendly tools help employees clock in, view assigned work, complete training, upload photos, and submit reports with minimal friction.",
    },
    {
      icon: Shield,
      color: "bg-emerald-50 text-emerald-600",
      title: "Built for real cleaning workflows",
      desc: "Clockfield supports the real work cleaning businesses deal with every day: schedules, attendance, work proof, quotes, payroll, safety, and client reporting.",
    },
  ];

  const testimonials = [
    {
      quote: "Clockfield helps our team stay organized and gives clients a clear view of the work completed. Our reporting time dropped significantly.",
      name: "Maria T.",
      role: "Cleaning Business Owner",
    },
    {
      quote: "The before-and-after photos and client reports have been a game changer. Clients love being able to see everything we did on their job.",
      name: "David K.",
      role: "Operations Manager",
    },
    {
      quote: "Training our new cleaners used to take weeks. With Clockfield's training module, they complete everything digitally and we can track progress.",
      name: "Sandra R.",
      role: "Janitorial Supervisor",
    },
  ];

  return (
    <section id="why" className="py-20 sm:py-28 px-6 lg:px-10 bg-white" data-testid="section-why">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center max-w-[580px] mx-auto mb-14">
          <div className="text-[11.5px] font-bold text-primary uppercase tracking-[0.08em] mb-3">Why Clockfield</div>
          <h2 className="text-[34px] sm:text-[42px] font-bold text-[#111827] leading-[1.15] tracking-[-0.025em] mb-4">
            Why cleaning businesses choose Clockfield
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {reasons.map((r, i) => (
            <div key={i} className="p-6 rounded-[14px] border border-[#e5e7eb] hover:shadow-[0_6px_24px_rgba(0,0,0,0.07)] transition-shadow" data-testid={`card-why-${i}`}>
              <div className={`w-11 h-11 rounded-[10px] ${r.color} flex items-center justify-center mb-4`}>
                <r.icon className="w-5 h-5" />
              </div>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">{r.title}</h3>
              <p className="text-[14px] text-[#6b7280] leading-[1.6]">{r.desc}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-[#f8fafc] rounded-[12px] p-6 border border-[#e5e7eb]" data-testid={`card-testimonial-${i}`}>
              <div className="flex items-center gap-0.5 mb-3">
                {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-[14px] text-[#374151] leading-[1.65] mb-4 italic">"{t.quote}"</p>
              <div>
                <div className="text-[13px] font-semibold text-[#111827]">{t.name}</div>
                <div className="text-[12px] text-[#9ca3af]">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Industry Cards ───────────────────────────────────────────────────────────
function IndustryCardsSection() {
  const industries = [
    { icon: Building2, name: "Commercial Cleaning", desc: "Offices, malls, and commercial properties that need regular professional cleaning." },
    { icon: Wrench, name: "Janitorial Services", desc: "Daily and scheduled janitorial maintenance for facilities and institutions." },
    { icon: Home, name: "Residential Cleaning", desc: "Home cleaning services with job documentation and client report sharing." },
    { icon: MapPin, name: "Office Cleaning", desc: "Professional office cleaning with documented service history and client visibility." },
    { icon: Package, name: "Post-Construction Cleaning", desc: "Final clean-up and detailed documentation for construction and renovation sites." },
    { icon: Globe, name: "Property Maintenance", desc: "Multi-location maintenance teams coordinated through a single platform." },
    { icon: TrendingUp, name: "Move-In / Move-Out Cleaning", desc: "Documented before-and-after cleaning for rentals and property management." },
    { icon: Award, name: "Facility Services", desc: "Large facility cleaning operations with scheduling, training, and compliance tracking." },
  ];

  return (
    <section id="industries" className="py-20 sm:py-28 px-6 lg:px-10 bg-[#f8fafc]" data-testid="section-industries">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center max-w-[560px] mx-auto mb-12">
          <div className="text-[11.5px] font-bold text-primary uppercase tracking-[0.08em] mb-3">Who It's Built For</div>
          <h2 className="text-[34px] sm:text-[40px] font-bold text-[#111827] leading-[1.15] tracking-[-0.025em] mb-4">
            Made for cleaning and service businesses
          </h2>
          <p className="text-[16px] text-[#4b5563] leading-[1.6]">
            Whether you run a solo operation or manage a multi-location team, Clockfield fits your workflow.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {industries.map((ind, i) => (
            <div
              key={i}
              className="bg-white rounded-[12px] p-5 border border-[#e5e7eb] hover:border-primary/25 hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] transition-all group cursor-default"
              data-testid={`card-industry-${i}`}
            >
              <div className="w-10 h-10 rounded-[10px] bg-primary/8 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                <ind.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#111827] mb-1.5">{ind.name}</h3>
              <p className="text-[13px] text-[#6b7280] leading-[1.5]">{ind.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Product CTA Section ──────────────────────────────────────────────────────
function ProductCTASection() {
  return (
    <section className="py-20 sm:py-28 px-6 lg:px-10 bg-[#111827] overflow-hidden relative" data-testid="section-product-cta">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/15 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl pointer-events-none" />

      <div className="max-w-[1280px] mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-[11.5px] font-bold text-primary uppercase tracking-[0.08em] mb-4">Free to Start</div>
            <h2 className="text-[34px] sm:text-[44px] font-bold text-white leading-[1.15] tracking-[-0.03em] mb-5">
              Start running your cleaning business with Clockfield
            </h2>
            <p className="text-[16px] text-white/60 leading-[1.65] mb-8 max-w-[440px]">
              Manage your team, prove completed work, organize reports, and keep your business moving from one clean dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link href="/login?tab=register" data-testid="link-product-cta-register">
                <button className="flex items-center gap-2 bg-primary text-white text-[15px] font-semibold px-6 py-3 rounded-[8px] hover:bg-[hsl(210,85%,38%)] transition-colors shadow-[0_2px_12px_rgba(30,100,200,0.4)]">
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link href="/login" data-testid="link-product-cta-login">
                <button className="flex items-center gap-2 text-[15px] font-semibold text-white/80 border border-white/20 px-6 py-3 rounded-[8px] hover:bg-white/8 transition-colors">
                  Log In
                </button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Calendar, label: "Scheduling & Shifts" },
                { icon: CheckCircle2, label: "Attendance Tracking" },
                { icon: FileText, label: "Client Reports" },
                { icon: BookOpen, label: "Employee Training" },
                { icon: DollarSign, label: "Payroll Estimates" },
                { icon: AlertTriangle, label: "Incident Reports" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[13px] text-white/60">
                  <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: mini dashboard */}
          <div className="hidden lg:block">
            <div className="rounded-[12px] overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1f2937] border-b border-white/8">
                <div className="w-2.5 h-2.5 rounded-full bg-[#fc6058]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#fec02f]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#2aca3e]" />
                <div className="flex-1 mx-3 bg-[#374151] rounded-[4px] px-2.5 py-[3px] text-[10px] text-white/40 font-mono">app.clockfield.com/employee</div>
              </div>
              <div className="bg-[#1a2332] p-5 space-y-3.5" style={{ minHeight: 280 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-[14px] font-bold text-primary">S</div>
                  <div>
                    <div className="text-[12px] font-semibold text-white">Sarah Mitchell</div>
                    <div className="text-[10px] text-white/40">Downtown Office · Floor 3</div>
                  </div>
                </div>
                {[
                  { label: "Clocked In", time: "8:02 AM", icon: CheckCircle2, color: "text-emerald-400" },
                  { label: "Shift ends", time: "4:00 PM", icon: Clock, color: "text-white/40" },
                  { label: "Training due", time: "Today", icon: BookOpen, color: "text-amber-400" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/6 last:border-0">
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
                    <div className="flex-1">
                      <div className="text-[11px] font-medium text-white/80">{item.label}</div>
                    </div>
                    <div className="text-[10px] text-white/40">{item.time}</div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="h-9 rounded-[6px] bg-primary flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-white">Upload Photos</span>
                  </div>
                  <div className="h-9 rounded-[6px] bg-white/8 border border-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-white/60">Clock Out</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Feature Grid ─────────────────────────────────────────────────────────────
function FeatureGridSection() {
  const features = [
    { icon: Calendar, name: "Scheduling", desc: "Build daily and recurring shift schedules." },
    { icon: CheckCircle2, name: "Attendance", desc: "Track clock-ins, hours, and overtime." },
    { icon: ClipboardList, name: "Worklogs", desc: "Document jobs with photos and notes." },
    { icon: FileText, name: "Client Reports", desc: "Shareable public links for clients." },
    { icon: BookOpen, name: "Training & Certificates", desc: "Courses, completion tracking, and certificates." },
    { icon: DollarSign, name: "Payroll Estimator", desc: "Hour-based payroll estimates by pay period." },
    { icon: AlertTriangle, name: "Incident Reports", desc: "Signed incident reports with PDF export." },
    { icon: PenLine, name: "Quotations", desc: "Build and send professional cleaning quotes." },
    { icon: Users, name: "Employee Management", desc: "Roles, access control, and employee records." },
    { icon: Globe, name: "Public Report Links", desc: "Client-facing report pages — no login needed." },
    { icon: Camera, name: "Field Notes", desc: "On-site photo notes and field documentation." },
    { icon: Star, name: "Client Reviews", desc: "Collect star ratings on public report pages." },
    { icon: Package, name: "Supplies & Inventory", desc: "Track cleaning supplies and restocking." },
    { icon: Shield, name: "Role-Based Access", desc: "Admin, supervisor, and employee roles." },
    { icon: Award, name: "Company Branding", desc: "Logo and brand colors on reports and links." },
    { icon: TrendingUp, name: "PDF Exports", desc: "Export reports, quotes, and incident PDFs." },
  ];

  return (
    <section className="py-20 sm:py-28 px-6 lg:px-10 bg-white" data-testid="section-feature-grid">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center max-w-[560px] mx-auto mb-12">
          <div className="text-[11.5px] font-bold text-primary uppercase tracking-[0.08em] mb-3">For Your Business</div>
          <h2 className="text-[34px] sm:text-[40px] font-bold text-[#111827] leading-[1.15] tracking-[-0.025em]">
            Every tool your team needs, in one platform
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-[10px] border border-[#e5e7eb] hover:border-primary/20 hover:bg-[#f8fafc] transition-all" data-testid={`card-feature-${i}`}>
              <div className="w-8 h-8 rounded-[7px] bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-[13.5px] font-semibold text-[#111827] mb-0.5">{f.name}</div>
                <div className="text-[12px] text-[#6b7280] leading-[1.5]">{f.desc}</div>
              </div>
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
    monthly: 29, yearlyPerMonth: 26,
    yearlyTotal: Math.round(29 * 12 * 0.9),
    limits: "Up to 2 employees, 5 clients",
    desc: "Solo cleaners and very small operations.",
    features: ["Attendance & clock-in/out", "Employee login (ID + PIN)", "Client portal", "Basic scheduling", "Email support"],
    popular: false,
  },
  {
    name: "Growth",
    monthly: 79, yearlyPerMonth: 71,
    yearlyTotal: Math.round(79 * 12 * 0.9),
    limits: "Up to 5 employees, 10 clients",
    desc: "Growing cleaning businesses with multiple crews.",
    features: ["Everything in Starter", "Client requests & tracking", "Timesheet exports", "Work reports & sharing", "Review collection"],
    popular: true,
  },
  {
    name: "Pro",
    monthly: 129, yearlyPerMonth: 116,
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
    <section id="pricing" className="py-20 sm:py-28 px-6 lg:px-10 bg-[#f8fafc]" data-testid="section-pricing">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div className="max-w-[480px]">
            <div className="text-[11.5px] font-bold text-primary uppercase tracking-[0.08em] mb-3">Pricing</div>
            <h2 className="text-[34px] sm:text-[40px] font-bold text-[#111827] leading-[1.15] tracking-[-0.025em] mb-3">
              Simple, predictable plans.
            </h2>
            <p className="text-[16px] text-[#4b5563]">No hidden fees. Cancel anytime.</p>
          </div>
          <div className="flex items-center gap-1 bg-[#e5e7eb] rounded-[8px] p-1 self-start sm:self-auto" data-testid="pricing-toggle">
            <button onClick={() => setAnnual(false)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors ${!annual ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280]"}`} data-testid="button-pricing-monthly">Monthly</button>
            <button onClick={() => setAnnual(true)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors flex items-center gap-1.5 ${annual ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280]"}`} data-testid="button-pricing-annual">
              Annual
              <span className="text-[9px] bg-emerald-500 text-white rounded-full px-1.5 py-0.5 font-bold">–10%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map(plan => (
            <div key={plan.name} className={`rounded-[12px] p-7 flex flex-col relative ${plan.popular ? "bg-primary text-white shadow-[0_12px_40px_rgba(30,100,200,0.28)]" : "bg-white border border-[#e5e7eb]"}`} data-testid={`card-plan-${plan.name.toLowerCase()}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-6">
                  <span className="text-[10px] font-bold bg-[#111827] text-white px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}
              <div className="mb-5">
                <div className={`text-[13px] font-bold mb-1 ${plan.popular ? "text-white/80" : "text-[#374151]"}`}>{plan.name}</div>
                <div className={`text-[11px] mb-4 ${plan.popular ? "text-white/60" : "text-[#9ca3af]"}`}>{plan.limits}</div>
                <div className="flex items-end gap-1">
                  <span className="text-[40px] font-bold leading-none">${annual ? plan.yearlyPerMonth : plan.monthly}</span>
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
                <button className={`w-full py-2.5 rounded-[8px] text-[13.5px] font-semibold transition-colors ${plan.popular ? "bg-white text-primary hover:bg-white/90" : "bg-[#111827] text-white hover:bg-[#1f2937]"}`}>
                  Get started
                </button>
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-[13px] text-[#9ca3af] mt-8">
          Need more capacity?{" "}
          <a href="mailto:support@clockfield.com" className="text-primary hover:underline underline-offset-2" data-testid="link-contact-sales">Contact us</a>
          {" "}for a custom plan.
        </p>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const faqs = [
  { q: "What is Clockfield?", a: "Clockfield is a workforce operations platform for cleaning and field service businesses. It covers scheduling, employee clock-in/out, work documentation with photos, shareable client reports, review collection, training management, payroll estimates, incident reports, and quotations — all in one platform." },
  { q: "Who is Clockfield built for?", a: "Clockfield is built for cleaning companies, janitorial teams, residential cleaning services, property maintenance businesses, and any service operation that needs to manage staff, document work, and share results with clients." },
  { q: "Can employees clock in and out from mobile?", a: "Yes. Employees use a separate employee login with their Employee ID (e.g., EMP-1001) and a PIN. They can clock in, view their schedule, upload photos, and submit job reports from any mobile device." },
  { q: "Can I create client reports with photos?", a: "Yes. After a job is completed, you generate a unique shareable link and send it to your client. They open a polished report page with before/after photos, job notes, and a service summary — no account or download required." },
  { q: "Can I assign employee training?", a: "Yes. You can create custom training courses with content blocks, assign them to employees, track completion rates, and issue completion certificates through the Training Hub." },
  { q: "Can I generate payroll estimates?", a: "Yes. Clockfield calculates payroll estimates based on hours worked, hourly rates, and selected pay periods. You can review estimates by employee and export summaries." },
  { q: "Can I create incident reports and PDFs?", a: "Yes. Incident reports include all relevant details, support digital employee signatures, can be shared with clients, and can be exported as print-ready PDFs." },
  { q: "Can clients view reports through a public link?", a: "Yes. Every client report gets a unique shareable URL that clients can access without creating an account. They can view photos, read notes, leave a star rating, and click through to Google Reviews." },
  { q: "Does Clockfield work for commercial and residential cleaning?", a: "Yes. Clockfield supports both commercial cleaning operations and residential cleaning services. Multi-location support, role-based access, and flexible scheduling work for both business types." },
  { q: "How do I get started?", a: "Create a free account at clockfield.com, set up your company, add employees and clients, and start scheduling shifts. Most businesses are up and running in under an hour — no IT setup required." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 sm:py-28 px-6 lg:px-10 bg-white" data-testid="section-faq">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid lg:grid-cols-[340px_1fr] gap-16">
          <div>
            <div className="text-[11.5px] font-bold text-primary uppercase tracking-[0.08em] mb-3">FAQ</div>
            <h2 className="text-[34px] font-bold text-[#111827] leading-[1.2] tracking-[-0.02em] mb-4">Common questions</h2>
            <p className="text-[15px] text-[#4b5563] leading-[1.6] mb-6">
              Still have questions?{" "}
              <a href="mailto:support@clockfield.com" className="text-primary hover:underline underline-offset-2">Email us</a>.
            </p>
            <Link href="/login?tab=register" data-testid="link-faq-cta">
              <button className="flex items-center gap-2 text-[13.5px] font-semibold text-primary border border-primary/30 px-4 py-2.5 rounded-[7px] hover:bg-primary hover:text-white transition-colors">
                Start free today <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
          <div className="space-y-px" role="list">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-[#f0f0f0] first:border-t" data-testid={`faq-item-${i}`} role="listitem">
                <button className="w-full flex items-center justify-between py-4 text-left gap-8" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span className={`text-[14px] font-medium transition-colors ${open === i ? "text-primary" : "text-[#111827]"}`}>{faq.q}</span>
                  {open === i ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />}
                </button>
                {open === i && <div className="pb-4 text-[14px] text-[#4b5563] leading-[1.7] pr-10">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer CTA ────────────────────────────────────────────────────────────────
function FooterCTASection() {
  return (
    <section className="py-16 px-6 lg:px-10 bg-primary" data-testid="section-footer-cta">
      <div className="max-w-[1280px] mx-auto text-center">
        <h2 className="text-[30px] sm:text-[38px] font-bold text-white leading-[1.15] tracking-[-0.025em] mb-4">
          Ready to organize your cleaning business?
        </h2>
        <p className="text-[16px] text-white/70 leading-[1.6] mb-8 max-w-[480px] mx-auto">
          Set up in minutes. Manage your team, clients, and reports from one clean dashboard.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/login?tab=register" data-testid="link-footer-cta-register">
            <button className="flex items-center gap-2 bg-white text-primary text-[15px] font-semibold px-6 py-3 rounded-[8px] hover:bg-white/90 transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/login" data-testid="link-footer-cta-login">
            <button className="text-[15px] font-medium text-white/80 border border-white/30 px-6 py-3 rounded-[8px] hover:bg-white/10 transition-colors">
              Log In
            </button>
          </Link>
        </div>
        <p className="text-[12px] text-white/50 mt-4">No credit card required · Cancel anytime</p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function MarketingFooter() {
  const productLinks = [
    { label: "Scheduling", href: "#features" },
    { label: "Attendance", href: "#features" },
    { label: "Worklogs", href: "#features" },
    { label: "Client Reports", href: "#features" },
    { label: "Training", href: "#features" },
    { label: "Payroll", href: "#features" },
    { label: "Quotes", href: "#features" },
    { label: "Incident Reports", href: "#features" },
  ];

  return (
    <footer className="bg-[#0f172a] text-white/50 py-14 px-6 lg:px-10" data-testid="footer-marketing">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[6px] bg-primary flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-white text-[14px] font-bold">ClockField</span>
            </div>
            <p className="text-[12.5px] leading-relaxed mb-4">
              Workforce management for cleaning and field service businesses.
            </p>
            <a href="mailto:support@clockfield.com" className="text-[12px] hover:text-white transition-colors">support@clockfield.com</a>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white text-[11.5px] font-semibold mb-4 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2.5 text-[12.5px]">
              {productLinks.slice(0, 4).map(l => (
                <li key={l.label}>
                  <button onClick={() => scrollTo(l.href)} className="hover:text-white transition-colors text-left">{l.label}</button>
                </li>
              ))}
            </ul>
          </div>

          {/* More Product */}
          <div>
            <h4 className="text-white text-[11.5px] font-semibold mb-4 uppercase tracking-wider">More</h4>
            <ul className="space-y-2.5 text-[12.5px]">
              {productLinks.slice(4).map(l => (
                <li key={l.label}>
                  <button onClick={() => scrollTo(l.href)} className="hover:text-white transition-colors text-left">{l.label}</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white text-[11.5px] font-semibold mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5 text-[12.5px]">
              <li><Link href="/login?tab=register" className="hover:text-white transition-colors" data-testid="footer-link-register">Get Started</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors" data-testid="footer-link-login">Log In</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors" data-testid="footer-link-employee">Employee Access</Link></li>
              <li><a href="mailto:support@clockfield.com" className="hover:text-white transition-colors">Contact Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white text-[11.5px] font-semibold mb-4 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2.5 text-[12.5px]">
              <li><button onClick={() => scrollTo("#faq")} className="hover:text-white transition-colors text-left">FAQ</button></li>
              <li><span className="opacity-40 cursor-default">Privacy Policy</span></li>
              <li><span className="opacity-40 cursor-default">Terms of Service</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11.5px]">
          <span>© {new Date().getFullYear()} ClockField. All rights reserved.</span>
          <span className="opacity-40">Built for cleaning businesses</span>
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
        <ValueCardsSection />
        <IndustryStripSection />
        <FeatureTabsSection />
        <WhySection />
        <IndustryCardsSection />
        <ProductCTASection />
        <FeatureGridSection />
        <PricingSection />
        <FAQSection />
        <FooterCTASection />
      </main>
      <MarketingFooter />
    </div>
  );
}
