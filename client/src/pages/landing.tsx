import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Users, FileText, Star, CheckCircle, ChevronDown, ChevronUp,
  Menu, X, MapPin, Camera, BarChart3, MessageSquare, Shield,
  ClipboardList, CreditCard, Smartphone, ArrowRight, Check
} from "lucide-react";

// ─── Announcement bar ─────────────────────────────────────────────────────────
function AnnouncementBar({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-primary text-primary-foreground text-sm py-2 px-4 flex items-center justify-center gap-3 relative">
      <span>
        <span className="font-semibold">New:</span> Clients can now leave reviews directly on your public report.
      </span>
      <Link href="/login?tab=register" className="underline underline-offset-2 font-medium hover:opacity-80 transition-opacity">
        Get started free →
      </Link>
      <button
        onClick={onDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss announcement"
        data-testid="button-dismiss-announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Marketing Header ─────────────────────────────────────────────────────────
function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? "shadow-sm border-b border-border" : "border-b border-border/40"}`}
      data-testid="header-marketing"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0" data-testid="link-logo">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">ClockField</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {navLinks.map(l => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {l.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" data-testid="link-header-login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link href="/login?tab=register" data-testid="link-header-get-started">
              <Button size="sm" className="gap-1">Get Started <ArrowRight className="w-3 h-3" /></Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle mobile menu"
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white" data-testid="mobile-nav-drawer">
          <div className="px-4 pt-4 pb-6 space-y-4">
            {navLinks.map(l => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="block w-full text-left text-sm font-medium text-foreground py-2 border-b border-border/50 last:border-0"
              >
                {l.label}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileOpen(false)} data-testid="link-mobile-login">
                <Button variant="outline" className="w-full">Log In</Button>
              </Link>
              <Link href="/login?tab=register" onClick={() => setMobileOpen(false)} data-testid="link-mobile-get-started">
                <Button className="w-full">Get Started Free</Button>
              </Link>
              <Link href="/login" onClick={() => setMobileOpen(false)} data-testid="link-mobile-employee">
                <Button variant="ghost" className="w-full text-muted-foreground text-sm">Employee Access</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── App UI Mockup (hero visual) ─────────────────────────────────────────────
function AppMockup() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto">
      {/* Browser chrome */}
      <div className="rounded-xl border border-border shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/60 border-b border-border">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className="ml-3 flex-1 bg-white rounded px-2 py-0.5 text-xs text-muted-foreground border border-border/60">
            app.clockfield.com/admin
          </div>
        </div>
        {/* App content preview */}
        <div className="flex h-[340px]">
          {/* Sidebar */}
          <div className="w-12 bg-muted/40 border-r border-border flex flex-col items-center gap-3 pt-4">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          {/* Main content */}
          <div className="flex-1 p-4 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-foreground">Good morning, David</div>
                <div className="text-[10px] text-muted-foreground">Thursday, March 27</div>
              </div>
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-green-200">3 Active</Badge>
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Working Now", val: "3", color: "text-primary" },
                { label: "Late Today", val: "1", color: "text-yellow-600" },
                { label: "Open Jobs", val: "5", color: "text-foreground" },
              ].map(s => (
                <div key={s.label} className="bg-muted/60 rounded-lg p-2 border border-border/40">
                  <div className={`text-base font-bold ${s.color}`}>{s.val}</div>
                  <div className="text-[9px] text-muted-foreground leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Employee rows */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Today's Shifts</div>
              {[
                { name: "Sarah M.", job: "Downtown Office", status: "On-site", dot: "bg-green-500" },
                { name: "James K.", job: "Riverside Plaza", status: "Late", dot: "bg-yellow-500" },
                { name: "Ana C.", job: "Westside Mall", status: "Scheduled", dot: "bg-muted-foreground" },
              ].map(e => (
                <div key={e.name} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/30 border border-border/30">
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-medium text-primary flex-shrink-0">
                    {e.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium truncate">{e.name}</div>
                    <div className="text-[8px] text-muted-foreground truncate">{e.job}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
                    <span className="text-[9px] text-muted-foreground">{e.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating "Public Report" card */}
      <div className="absolute -bottom-6 -right-4 w-44 bg-white rounded-xl border border-border shadow-xl p-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold">Client Report Shared</span>
        </div>
        <div className="text-[9px] text-muted-foreground leading-tight">Downtown Office — March 2026</div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(i => (
            <Star key={i} className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
          ))}
          <span className="text-[9px] text-muted-foreground ml-0.5">5.0</span>
        </div>
        <div className="h-1 bg-green-100 rounded-full overflow-hidden">
          <div className="h-full w-4/5 bg-green-500 rounded-full" />
        </div>
        <div className="text-[8px] text-muted-foreground">Client reviewed · 2 min ago</div>
      </div>

      {/* Floating "Clock In" badge */}
      <div className="absolute -top-3 -left-4 bg-white rounded-xl border border-border shadow-xl px-3 py-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-3 h-3 text-green-600" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-foreground">Clocked In</div>
          <div className="text-[9px] text-muted-foreground">Sarah M. · 8:02 AM</div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="bg-white pt-16 pb-24 px-4 sm:px-6 lg:px-8" data-testid="section-hero">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Copy */}
          <div className="space-y-6">
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs px-3 py-1">
              Built for cleaning businesses
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight tracking-tight">
              Run your cleaning business{" "}
              <span className="text-primary">with more clarity</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Clockfield gives cleaning businesses one platform to manage staff, document work,
              share client reports, track hours, and collect reviews — without the mess of texts,
              calls, and disconnected tools.
            </p>

            {/* Trust points */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              {[
                "Employee clock-in & clock-out",
                "Shareable client reports",
                "Work photo documentation",
                "Payroll hour tracking",
                "Review collection",
                "Works on any device",
              ].map(p => (
                <div key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  {p}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/login?tab=register" data-testid="link-hero-get-started">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login" data-testid="link-hero-login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Log In
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              No credit card required ·{" "}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-hero-employee-access">
                Employee? Access here
              </Link>
            </p>
          </div>

          {/* Right: App mockup */}
          <div className="flex justify-center lg:justify-end pt-8 lg:pt-0">
            <AppMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Trust Strip ──────────────────────────────────────────────────────────────
function TrustStrip() {
  return (
    <section className="border-y border-border bg-muted/30 py-8 px-4 sm:px-6 lg:px-8" data-testid="section-trust">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
          {[
            { icon: Users, text: "Teams managed across locations" },
            { icon: FileText, text: "Professional client reports" },
            { icon: Camera, text: "Work photo documentation" },
            { icon: Star, text: "Review collection built-in" },
            { icon: CreditCard, text: "Payroll hour tracking" },
            { icon: Smartphone, text: "Works on any device" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary/60" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features Section ─────────────────────────────────────────────────────────
const featureGroups = [
  {
    icon: Clock,
    title: "Team & Attendance",
    color: "bg-blue-50 text-blue-600",
    features: [
      "Employee clock-in and clock-out",
      "Late and missed shift alerts",
      "Real-time attendance overview",
      "Hours reporting by employee",
      "Admin manual clock-out",
    ],
  },
  {
    icon: ClipboardList,
    title: "Work Management",
    color: "bg-purple-50 text-purple-600",
    features: [
      "Create and assign work submissions",
      "Before/after photo uploads",
      "Job notes and service summaries",
      "Recurring shift scheduling",
      "Employee work log history",
    ],
  },
  {
    icon: FileText,
    title: "Client Reports & Sharing",
    color: "bg-emerald-50 text-emerald-600",
    features: [
      "One-click shareable report links",
      "Professional public report UI",
      "Photos organized per job",
      "Client-facing work summary",
      "Short URLs for easy sharing",
    ],
  },
  {
    icon: Star,
    title: "Reviews & Communication",
    color: "bg-yellow-50 text-yellow-600",
    features: [
      "Client review collection",
      "Google Review link support",
      "In-app client request portal",
      "Admin response workflows",
      "Broadcast messaging to all admins",
    ],
  },
  {
    icon: BarChart3,
    title: "Admin Control",
    color: "bg-rose-50 text-rose-600",
    features: [
      "Multi-location management",
      "Role-based access (Admin, Employee, Client)",
      "Dashboard performance metrics",
      "Pay stub and payroll estimates",
      "Company branding & logo upload",
    ],
  },
  {
    icon: Shield,
    title: "Security & Access",
    color: "bg-slate-50 text-slate-600",
    features: [
      "Employee PIN + ID login",
      "Admin email + password login",
      "Secure client portal",
      "Forgot password via email",
      "Subscription plan management",
    ],
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white" data-testid="section-features">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs px-3 py-1 mb-4">
            Everything you need
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            One platform for your whole operation
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From scheduling and attendance to client reports and reviews — Clockfield covers
            every part of running a cleaning business.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureGroups.map(group => (
            <div
              key={group.title}
              className="rounded-xl border border-border bg-white p-6 hover:shadow-md transition-shadow"
              data-testid={`card-feature-${group.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className={`w-10 h-10 rounded-lg ${group.color} flex items-center justify-center mb-4`}>
                <group.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-3">{group.title}</h3>
              <ul className="space-y-2">
                {group.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    {f}
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

// ─── Problem → Solution ───────────────────────────────────────────────────────
function ProblemSolutionSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-problem-solution">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Before */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-destructive mb-4">Before Clockfield</div>
            <h3 className="text-2xl font-bold text-foreground mb-6">Sound familiar?</h3>
            <div className="space-y-3">
              {[
                "Photos scattered across WhatsApp threads",
                "Employees forgetting to clock out",
                "Clients asking for updates you don't have ready",
                "No consistent job documentation",
                "Manual payroll calculations every week",
                "Zero review collection process",
              ].map(p => (
                <div key={p} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-border/60">
                  <span className="text-destructive text-base mt-0.5">✕</span>
                  <span className="text-sm text-muted-foreground">{p}</span>
                </div>
              ))}
            </div>
          </div>
          {/* After */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">With Clockfield</div>
            <h3 className="text-2xl font-bold text-foreground mb-6">Here's what changes</h3>
            <div className="space-y-3">
              {[
                "All job photos organized by client and date",
                "Clock-in/out tracked automatically with late alerts",
                "Share a professional client report link in seconds",
                "Every job has notes, photos, and a summary",
                "Hours logged automatically for payroll estimates",
                "Clients can leave reviews right on their report",
              ].map(p => (
                <div key={p} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-border/60">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const steps = [
  {
    step: "01",
    title: "Set up your company",
    desc: "Create your account, add your company details, upload a logo, and configure your locations and service areas.",
    icon: Shield,
  },
  {
    step: "02",
    title: "Add employees and clients",
    desc: "Invite employees with a PIN, set up client accounts, and organize your team with roles and permissions.",
    icon: Users,
  },
  {
    step: "03",
    title: "Schedule and assign work",
    desc: "Create shifts, schedule jobs to specific locations, and assign employees to recurring or one-time work.",
    icon: ClipboardList,
  },
  {
    step: "04",
    title: "Employees clock in and document work",
    desc: "Staff clock in on mobile, upload before/after photos, add notes, and complete their job reports.",
    icon: Camera,
  },
  {
    step: "05",
    title: "Share reports and collect reviews",
    desc: "Generate a public client report link, share it instantly, and let clients leave a star rating and review.",
    icon: FileText,
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-white" data-testid="section-how-it-works">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs px-3 py-1 mb-4">
            Simple to start
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">How Clockfield works</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Up and running in minutes, not weeks. No IT department required.
          </p>
        </div>

        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-8 left-[5%] right-[5%] h-px bg-border z-0" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
            {steps.map((s, i) => (
              <div key={s.step} className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg flex-shrink-0">
                  <s.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <div className="text-xs font-bold text-muted-foreground/50 tracking-widest">{s.step}</div>
                <h3 className="font-semibold text-foreground text-sm">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/login?tab=register" data-testid="link-how-it-works-cta">
            <Button size="lg" className="gap-2">
              Start setting up your account <ArrowRight className="w-4 h-4" />
            </Button>
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
      color: "bg-blue-50 border-blue-100",
      iconColor: "bg-blue-100 text-blue-600",
      items: [
        "Full dashboard with real-time team overview",
        "Manage employees, clients, and locations",
        "View attendance, approve hours, run payroll estimates",
        "Generate and share client work reports",
        "Respond to client requests and reviews",
        "Access subscription and billing settings",
      ],
    },
    {
      icon: Users,
      title: "Employee / Cleaner",
      color: "bg-emerald-50 border-emerald-100",
      iconColor: "bg-emerald-100 text-emerald-600",
      items: [
        "Log in with Employee ID + PIN on any device",
        "Clock in and out at assigned locations",
        "View personal schedule and upcoming shifts",
        "Upload work photos and job notes",
        "View pay stubs and worked hours",
        "Submit client requests on behalf of clients",
      ],
    },
    {
      icon: Star,
      title: "Client",
      color: "bg-yellow-50 border-yellow-100",
      iconColor: "bg-yellow-100 text-yellow-600",
      items: [
        "View completed work via a public shareable link",
        "See job photos and service summary",
        "Leave a star rating and written review",
        "Submit new service requests",
        "Track request status and admin responses",
        "No account setup required to view reports",
      ],
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-roles">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs px-3 py-1 mb-4">
            Every role covered
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Built for your whole team
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Clockfield serves everyone in your business — from owners to cleaners to clients.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {roles.map(role => (
            <div
              key={role.title}
              className={`rounded-xl border p-6 ${role.color}`}
              data-testid={`card-role-${role.title.split(" ")[0].toLowerCase()}`}
            >
              <div className={`w-10 h-10 rounded-lg ${role.iconColor} flex items-center justify-center mb-4`}>
                <role.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-3">{role.title}</h3>
              <ul className="space-y-2">
                {role.items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
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

// ─── Pricing Section ──────────────────────────────────────────────────────────
const plans = [
  {
    name: "Starter",
    monthly: 29,
    yearly: Math.round(29 * 12 * 0.9),
    maxEmployees: 2,
    maxClients: 5,
    description: "Perfect for solo cleaners or small operations.",
    features: ["Up to 2 employees", "Up to 5 clients", "Attendance & clock-in", "Employee login", "Client portal", "Basic scheduling"],
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Growth",
    monthly: 79,
    yearly: Math.round(79 * 12 * 0.9),
    maxEmployees: 5,
    maxClients: 10,
    description: "For growing cleaning businesses with multiple crews.",
    features: ["Up to 5 employees", "Up to 10 clients", "Everything in Starter", "Client requests", "Timesheets & exports", "Work reports & sharing"],
    cta: "Start growing",
    highlight: true,
  },
  {
    name: "Pro",
    monthly: 129,
    yearly: Math.round(129 * 12 * 0.9),
    maxEmployees: 10,
    maxClients: 15,
    description: "Full platform access for established teams.",
    features: ["Up to 10 employees", "Up to 15 clients", "Everything in Growth", "Work log & photo uploads", "Payroll estimates", "Pay stubs"],
    cta: "Go Pro",
    highlight: false,
  },
];

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white" data-testid="section-pricing">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs px-3 py-1 mb-4">
            Simple pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Plans that grow with you
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-6">
            No hidden fees. Cancel anytime.
          </p>
          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-muted rounded-full p-1" data-testid="pricing-toggle">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!annual ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              data-testid="button-pricing-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${annual ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              data-testid="button-pricing-annual"
            >
              Annual
              <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-semibold">–10%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`rounded-xl border p-7 flex flex-col ${plan.highlight ? "border-primary shadow-lg ring-1 ring-primary/20 relative" : "border-border"}`}
              data-testid={`card-plan-${plan.name.toLowerCase()}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-xs px-3">Most Popular</Badge>
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mt-1">{plan.description}</p>
              </div>
              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    ${annual ? Math.round(plan.yearly / 12) : plan.monthly}
                  </span>
                  <span className="text-muted-foreground text-sm mb-1.5">/month</span>
                </div>
                {annual && (
                  <p className="text-xs text-muted-foreground mt-1">Billed ${plan.yearly}/year</p>
                )}
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login?tab=register" data-testid={`link-plan-${plan.name.toLowerCase()}`}>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Need more capacity?{" "}
          <a href="mailto:support@clockfield.com" className="text-primary hover:underline" data-testid="link-contact-sales">
            Contact us
          </a>{" "}
          for a custom plan.
        </p>
      </div>
    </section>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
const faqs = [
  { q: "What is Clockfield?", a: "Clockfield is a workforce operations platform built for cleaning businesses. It helps you manage employee attendance, schedule shifts, document completed work with photos, share professional client reports, collect reviews, and track hours for payroll." },
  { q: "Is it only for cleaning companies?", a: "Clockfield is optimized for cleaning and field service businesses, but it works for any service-based operation that needs team scheduling, work documentation, and client reporting." },
  { q: "Can employees clock in and out on their phone?", a: "Yes. Employees log in with their Employee ID and PIN from any device — phone, tablet, or computer — and clock in or out directly. Admins receive real-time updates on who's working, who's late, and who missed a shift." },
  { q: "Can I share reports with clients?", a: "Yes. After a job is documented, you can generate a unique shareable link and send it to your client. They can view a professional report with photos, notes, and a service summary — no account required on their end." },
  { q: "Can clients leave reviews?", a: "Yes. Clients can leave a star rating and written review directly on their public report page. You can also include a Google Review link so clients can post their feedback there too." },
  { q: "Does it work on mobile?", a: "Clockfield is fully responsive. Employees use it on mobile to clock in/out and submit work. Admins can manage the dashboard from desktop or mobile. Public client reports are optimized for phone viewing." },
  { q: "Can I manage multiple locations or teams?", a: "Yes. You can create multiple locations, assign employees to locations, and schedule recurring or one-time shifts per location. Each client can also have their own location settings." },
  { q: "How do employees sign in?", a: "Employees use a separate Employee tab on the login page. They enter their Employee ID (like EMP-1001) and a PIN set by their manager. No email required for employees." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-faq">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs px-3 py-1 mb-4">
            Common questions
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Frequently asked questions
          </h2>
        </div>
        <div className="space-y-2" role="list" aria-label="FAQ">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-border overflow-hidden"
              data-testid={`faq-item-${i}`}
              role="listitem"
            >
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="font-medium text-foreground text-sm">{faq.q}</span>
                {open === i
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary" data-testid="section-final-cta">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
          Ready to get organized?
        </h2>
        <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
          Start managing your team, jobs, and clients with one clean platform.
          Takes less than 5 minutes to set up.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login?tab=register" data-testid="link-final-cta-register">
            <Button size="lg" variant="secondary" className="gap-2 w-full sm:w-auto font-semibold">
              Create your free account <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/login" data-testid="link-final-cta-login">
            <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              Log In
            </Button>
          </Link>
        </div>
        <p className="text-primary-foreground/60 text-sm mt-6">
          Already a cleaner?{" "}
          <Link href="/login" className="underline underline-offset-2 hover:text-primary-foreground transition-colors" data-testid="link-final-cta-employee">
            Employee access here
          </Link>
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function MarketingFooter() {
  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="bg-foreground text-primary-foreground/70 py-12 px-4 sm:px-6 lg:px-8" data-testid="footer-marketing">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-primary-foreground font-semibold">ClockField</span>
            </div>
            <p className="text-sm leading-relaxed">
              Workforce operations platform for cleaning and field service businesses.
            </p>
          </div>
          {/* Product */}
          <div>
            <h4 className="text-primary-foreground text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => scrollTo("#features")} className="hover:text-primary-foreground transition-colors">Features</button></li>
              <li><button onClick={() => scrollTo("#how-it-works")} className="hover:text-primary-foreground transition-colors">How It Works</button></li>
              <li><button onClick={() => scrollTo("#pricing")} className="hover:text-primary-foreground transition-colors">Pricing</button></li>
              <li><button onClick={() => scrollTo("#faq")} className="hover:text-primary-foreground transition-colors">FAQ</button></li>
            </ul>
          </div>
          {/* Access */}
          <div>
            <h4 className="text-primary-foreground text-sm font-semibold mb-3">Access</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login?tab=register" className="hover:text-primary-foreground transition-colors" data-testid="footer-link-register">Get Started</Link></li>
              <li><Link href="/login" className="hover:text-primary-foreground transition-colors" data-testid="footer-link-login">Log In</Link></li>
              <li><Link href="/login" className="hover:text-primary-foreground transition-colors" data-testid="footer-link-employee">Employee Access</Link></li>
              <li><Link href="/forgot-password" className="hover:text-primary-foreground transition-colors" data-testid="footer-link-forgot">Forgot Password</Link></li>
            </ul>
          </div>
          {/* Contact */}
          <div>
            <h4 className="text-primary-foreground text-sm font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:support@clockfield.com" className="hover:text-primary-foreground transition-colors" data-testid="footer-link-support">
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span>© {new Date().getFullYear()} ClockField. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span className="text-primary-foreground/40">Privacy Policy</span>
            <span className="text-primary-foreground/40">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Landing Page (root export) ───────────────────────────────────────────────
export default function LandingPage() {
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  return (
    <>
      {/* SEO meta via document title */}
      {typeof document !== "undefined" && (document.title = "ClockField — Workforce Management for Cleaning Businesses")}

      <div className="flex flex-col min-h-screen">
        {announcementVisible && <AnnouncementBar onDismiss={() => setAnnouncementVisible(false)} />}
        <MarketingHeader />
        <main>
          <HeroSection />
          <TrustStrip />
          <FeaturesSection />
          <ProblemSolutionSection />
          <HowItWorksSection />
          <RolesSection />
          <PricingSection />
          <FAQSection />
          <FinalCTASection />
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
