import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Copy, Mail, Eye, Save, Plus, Trash2, GripVertical,
  ChevronLeft, ChevronRight, Check, ExternalLink, Printer, Mic, MicOff,
  FileText, User, MapPin, Settings, DollarSign, AlignLeft, Share2, RefreshCw,
  Wand2, ListChecks, ChevronDown,
} from "lucide-react";
import type {
  Proposal, ScopeSection, IncludedItem, PricingLineItem, TaxConfig, PricingConfig, ServiceDetails,
} from "@shared/schema";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "client", label: "Client", icon: User },
  { id: "service", label: "Service", icon: Settings },
  { id: "scope", label: "Scope", icon: AlignLeft },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "terms", label: "Terms", icon: FileText },
  { id: "share", label: "Share", icon: Share2 },
];

const SERVICE_TYPES = [
  "Office Cleaning", "Commercial Cleaning", "Restaurant Cleaning",
  "Restaurant Kitchen Deep Cleaning", "Retail Store Cleaning", "Medical Office Cleaning",
  "Gym Cleaning", "School / Daycare Cleaning", "Post-Construction Cleaning",
  "Move-In / Move-Out Cleaning", "One-Time Deep Clean", "Floor Care",
  "Carpet Cleaning", "Window Cleaning", "Janitorial Service", "Custom",
];
const FREQUENCIES = ["One-Time", "Daily", "Weekly", "Bi-Weekly", "Monthly", "Custom"];
const DAYS_PER_WEEK = ["1 day/week", "2 days/week", "3 days/week", "4 days/week", "5 days/week", "6 days/week", "7 days/week", "Custom"];
const PREFERRED_TIMES = ["Morning", "Afternoon", "Evening", "After-Hours", "Custom"];
const CONTRACT_LENGTHS = ["One-Time", "Monthly", "3 Months", "6 Months", "12 Months", "Custom"];
const TAX_TYPES = [
  { value: "none", label: "No Tax", rate: 0 },
  { value: "gst", label: "GST (5%)", rate: 5 },
  { value: "pst", label: "PST (7%)", rate: 7 },
  { value: "hst", label: "HST (13%)", rate: 13 },
  { value: "qst", label: "QST (9.975%)", rate: 9.975 },
  { value: "custom", label: "Custom Rate", rate: 0 },
];

const BILLING_TYPES = [
  { value: "per_visit",        label: "Per Visit",        billingLabel: "Per Visit Total",   suffix: "/ visit" },
  { value: "weekly",           label: "Weekly",           billingLabel: "Weekly Total",      suffix: "/ week" },
  { value: "bi_weekly",        label: "Bi-Weekly",        billingLabel: "Bi-Weekly Total",   suffix: "/ two weeks" },
  { value: "monthly",          label: "Monthly",          billingLabel: "Monthly Total",     suffix: "/ month" },
  { value: "every_3_months",   label: "Every 3 Months",   billingLabel: "Quarterly Total",   suffix: "/ quarter" },
  { value: "every_6_months",   label: "Every 6 Months",   billingLabel: "6-Month Total",     suffix: "/ 6 months" },
  { value: "yearly",           label: "Yearly",           billingLabel: "Annual Total",      suffix: "/ year" },
  { value: "full_contract",    label: "Full Contract",    billingLabel: "Contract Total",    suffix: "" },
  { value: "custom",           label: "Custom",           billingLabel: "Total",             suffix: "" },
];

// Given a contract length string (e.g. "12 Months") and billing type, return how many
// billing periods fit in the contract. Returns null if we can't compute it.
function getContractMultiplier(contractLength: string, billingType: string, visitsPerMonth: number): number | null {
  const monthsMap: Record<string, number> = { "3 Months": 3, "6 Months": 6, "12 Months": 12, "Monthly": 1 };
  const months = monthsMap[contractLength];
  if (!months || months <= 1) return null;
  switch (billingType) {
    case "per_visit":      return visitsPerMonth > 0 ? months * visitsPerMonth : null;
    case "weekly":         return months * (52 / 12);
    case "bi_weekly":      return months * (26 / 12);
    case "monthly":        return months;
    case "every_3_months": return months / 3;
    case "every_6_months": return months / 6;
    case "yearly":         return months / 12;
    case "full_contract":  return null; // already the full contract price
    default:               return null;
  }
}

function contractLabel(contractLength: string, billingType: string): string {
  return `Estimated ${contractLength} Total`;
}

const PROFESSIONAL_TERMS = `1. Proposal Validity
   This proposal is valid until the expiry date shown on the document. Pricing and availability may be subject to change after this date.

2. Scope of Work
   The services included in this proposal are limited to the scope of work listed in this document. Any additional services, special requests, or work outside the agreed scope may require a separate quote or written approval.

3. Service Schedule
   Service days, times, and start date are subject to final confirmation between the client and the service provider. The preferred start date selected by the client will be reviewed and confirmed before service begins.

4. Pricing and Taxes
   All pricing is based on the service details, frequency, estimated labour, and scope listed in this proposal. Applicable taxes will be added where required. Final pricing may change if site conditions, service requirements, or cleaning frequency differ from the information provided.

5. Supplies and Equipment
   Unless stated otherwise, standard cleaning supplies and equipment required to complete the listed scope are included. Specialty supplies, consumables, paper products, dispensers, waste bags, floor care products, or equipment rentals may be billed separately if not included in this proposal.

6. Access to Site
   The client is responsible for providing safe and reasonable access to the service location during the agreed service time. Delays or missed access may affect scheduling and may result in additional charges.

7. Health and Safety
   The service provider may refuse or pause work if unsafe conditions are present. Hazardous materials, biohazards, pest issues, excessive debris, or unsafe areas may require additional assessment before work can continue.

8. Changes and Cancellations
   Any requested changes to the scope, schedule, or frequency should be communicated in advance. Cancellations, rescheduling, or service changes may be subject to the business's cancellation policy if applicable.

9. Acceptance
   By accepting this proposal, the client confirms that they have reviewed the scope of work, pricing, service details, and terms listed in this document. Acceptance does not replace a separate service agreement if one is required by the business.

10. Payment Terms
    Payment terms will be confirmed by the service provider. Invoices are due according to the agreed billing schedule. Late payments may affect future service scheduling.`;

const SHORT_TERMS = `This proposal is valid until the expiry date shown. Services are limited to the scope of work listed in this document. Any extra work may require approval and additional charges. Pricing is based on the service frequency, estimated labour, and site details provided. The preferred start date is subject to final confirmation. By accepting this proposal, the client confirms they have reviewed the service details, pricing, and terms.`;

// Scope section presets
const SCOPE_SECTION_PRESETS: Record<string, string[]> = {
  "General Cleaning": [
    "Empty garbage and replace liners",
    "Dust desks, ledges, and accessible surfaces",
    "Wipe high-touch surfaces",
    "Spot clean doors and walls",
    "Clean entrance areas",
    "Vacuum carpeted areas",
    "Sweep hard floors",
    "Mop hard floors",
    "Remove cobwebs from accessible areas",
    "Straighten common areas",
  ],
  "Washroom Cleaning": [
    "Clean and disinfect toilets",
    "Clean and disinfect urinals",
    "Clean and disinfect sinks",
    "Clean counters and fixtures",
    "Clean mirrors",
    "Restock toilet paper if supplied",
    "Restock paper towels if supplied",
    "Restock hand soap if supplied",
    "Empty washroom garbage",
    "Mop washroom floors",
    "Disinfect high-touch points",
    "Spot clean partitions and doors",
  ],
  "Kitchen / Breakroom Cleaning": [
    "Wipe counters",
    "Clean sinks and faucets",
    "Clean exterior of appliances",
    "Wipe tables and chairs",
    "Empty garbage",
    "Clean microwave exterior",
    "Spot clean cabinet fronts",
    "Sweep and mop floors",
    "Remove visible spills",
  ],
  "Restaurant Kitchen Cleaning": [
    "Degrease cooking area surfaces",
    "Clean floor edges and corners",
    "Scrub buildup around equipment",
    "Clean under accessible equipment",
    "Remove grease from high-touch areas",
    "Clean stainless steel surfaces",
    "Sweep and mop kitchen floors",
    "Detail drains where accessible",
    "Wipe prep tables",
    "Remove food debris from floor areas",
  ],
  "Floor Cleaning": [
    "Sweep floors",
    "Dust mop floors",
    "Wet mop floors",
    "Auto-scrub floors if required",
    "Spot clean floor stains",
    "Clean baseboard edges",
    "Remove visible floor buildup",
    "Vacuum carpets",
    "Spot vacuum entrance mats",
  ],
  "Floor Care": [
    "Strip and wax floors",
    "Buff floors",
    "Burnish floors",
    "Apply floor finish",
    "Deep scrub tile floors",
    "Restore dull floor areas",
  ],
  "Carpet Cleaning": [
    "Vacuum carpet",
    "Spot treat stains",
    "Extract carpet",
    "Deodorize carpet",
    "Clean entrance mats",
  ],
  "Window / Glass Cleaning": [
    "Clean interior glass",
    "Clean entrance doors",
    "Clean partition glass",
    "Remove fingerprints from glass",
    "Clean mirrors",
  ],
  "High-Touch Disinfection": [
    "Disinfect door handles",
    "Disinfect light switches",
    "Disinfect railings",
    "Disinfect counters",
    "Disinfect shared surfaces",
    "Disinfect touch points in common areas",
  ],
  "Garbage & Recycling": [
    "Empty all garbage cans",
    "Replace garbage liners",
    "Empty recycling bins",
    "Consolidate recycling to collection area",
    "Clean and wipe garbage bins if soiled",
  ],
  "Post-Construction Cleaning": [
    "Remove dust from horizontal surfaces",
    "Vacuum construction dust",
    "Clean windows and frames",
    "Wipe doors and trims",
    "Clean cabinets inside and outside",
    "Remove small debris",
    "Mop floors",
    "Detail washrooms",
  ],
  "Dusting": [
    "Dust accessible furniture surfaces",
    "Dust window sills and ledges",
    "Dust light fixtures if accessible",
    "Dust baseboards",
    "Dust shelving",
  ],
};

const INCLUDED_PRESETS = [
  "Labour",
  "Basic cleaning supplies",
  "Commercial-grade cleaning products",
  "Disinfectant products",
  "Garbage bags",
  "Microfiber cloths",
  "Mop and bucket",
  "Vacuum equipment",
  "Auto-scrubber if required",
  "Floor care equipment",
  "Quality checks",
  "Supervisor inspection",
  "Before and after photos",
  "Service report",
  "Restocking support",
  "Client communication",
  "Scheduled cleaning checklist",
  "After-hours service",
  "Emergency cleaning support",
  "Paper products",
  "Hand soap",
  "Toilet paper",
  "Window cleaning",
  "Floor stripping and waxing",
  "Carpet cleaning",
];

const SERVICE_TEMPLATES: Record<string, { scope: Array<{ title: string; bullets: string[] }>; included: string[]; notes: string }> = {
  "Office Cleaning": {
    scope: [
      { title: "General Cleaning", bullets: ["Empty garbage and replace liners", "Dust desks, ledges, and accessible surfaces", "Wipe high-touch surfaces", "Vacuum carpeted areas", "Sweep and mop hard floors"] },
      { title: "Washroom Cleaning", bullets: ["Clean and disinfect toilets", "Clean and disinfect sinks", "Clean mirrors", "Mop washroom floors", "Restock supplies if provided"] },
      { title: "Kitchen / Breakroom Cleaning", bullets: ["Wipe counters", "Clean sinks and faucets", "Empty garbage", "Sweep and mop floors"] },
    ],
    included: ["Labour", "Basic cleaning supplies", "Garbage bags", "Microfiber cloths", "Vacuum equipment"],
    notes: "Pricing is based on estimated square footage and frequency. May be adjusted after site visit.",
  },
  "Restaurant Cleaning": {
    scope: [
      { title: "General Cleaning", bullets: ["Empty garbage and replace liners", "Wipe high-touch surfaces", "Sweep and mop floors", "Clean entrance areas"] },
      { title: "Washroom Cleaning", bullets: ["Clean and disinfect toilets", "Clean and disinfect sinks", "Mop washroom floors", "Restock supplies if provided"] },
    ],
    included: ["Labour", "Commercial-grade cleaning products", "Disinfectant products", "Garbage bags"],
    notes: "Front-of-house cleaning. Kitchen cleaning is quoted separately.",
  },
  "Restaurant Kitchen Deep Cleaning": {
    scope: [
      { title: "Restaurant Kitchen Cleaning", bullets: ["Degrease cooking area surfaces", "Clean floor edges and corners", "Scrub buildup around equipment", "Clean under accessible equipment", "Remove grease from high-touch areas", "Clean stainless steel surfaces", "Sweep and mop kitchen floors"] },
      { title: "High-Touch Disinfection", bullets: ["Disinfect door handles", "Disinfect counters", "Disinfect shared surfaces"] },
    ],
    included: ["Labour", "Commercial-grade cleaning products", "Disinfectant products", "Floor care equipment"],
    notes: "Deep kitchen cleaning service. Equipment must be shut down and accessible before service begins.",
  },
  "Post-Construction Cleaning": {
    scope: [
      { title: "Post-Construction Cleaning", bullets: ["Remove dust from horizontal surfaces", "Vacuum construction dust", "Clean windows and frames", "Wipe doors and trims", "Clean cabinets inside and outside", "Remove small debris", "Mop floors", "Detail washrooms"] },
    ],
    included: ["Labour", "Commercial-grade cleaning products", "Vacuum equipment", "Basic cleaning supplies"],
    notes: "Post-construction cleaning scope may vary based on project size and debris level. Final pricing confirmed after site assessment.",
  },
  "Carpet Cleaning": {
    scope: [
      { title: "Carpet Cleaning", bullets: ["Vacuum carpet", "Spot treat stains", "Extract carpet", "Deodorize carpet", "Clean entrance mats"] },
    ],
    included: ["Labour", "Carpet cleaning equipment", "Spot treatment products", "Deodorizing products"],
    notes: "Drying time is typically 4–8 hours. Please avoid heavy foot traffic on wet carpet.",
  },
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  thinking: "bg-amber-100 text-amber-700",
};

function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── VoiceMicButton ──────────────────────────────────────────────────────────

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

function VoiceMicButton({ onTranscript, disabled }: VoiceMicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  if (!SR) return null;

  function toggle() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-CA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(" ").trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = (e: any) => {
      if (e.error === "not-allowed") alert("Microphone access is blocked. Please allow microphone access in your browser settings or type manually.");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("w-8 h-8 flex-shrink-0", isListening && "text-red-500 animate-pulse")}
      onClick={toggle}
      disabled={disabled}
      title={isListening ? "Stop recording" : "Speak to type"}
      data-testid="button-voice-mic"
    >
      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminProposalBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);

  // Scope template picker state
  const [scopeTemplateOpen, setScopeTemplateOpen] = useState(false);
  const [selectedScopeSection, setSelectedScopeSection] = useState("");
  const [selectedBullets, setSelectedBullets] = useState<string[]>([]);

  // Included presets picker state
  const [includedPresetsOpen, setIncludedPresetsOpen] = useState(false);
  const [selectedIncluded, setSelectedIncluded] = useState<string[]>([]);

  // Service template suggestion
  const [templateSuggestOpen, setTemplateSuggestOpen] = useState(false);
  const [templateSuggestService, setTemplateSuggestService] = useState("");

  // Terms style
  const [termsStyle, setTermsStyle] = useState<"standard" | "short" | "custom">("custom");

  // Grammar cleanup
  const [grammarField, setGrammarField] = useState<string | null>(null);

  // Proposal fields
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [serviceDetails, setServiceDetails] = useState<ServiceDetails>({
    serviceType: "", frequency: "", daysPerWeek: "", hoursPerVisit: "",
    numCleaners: "1", preferredTime: "", contractLength: "", proposedStartDate: "",
  });
  const [scopeSections, setScopeSections] = useState<ScopeSection[]>([]);
  const [includedItems, setIncludedItems] = useState<IncludedItem[]>([]);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    lineItems: [], taxConfig: { type: "none", rate: 0, label: "No Tax" }, subtotalOverride: null, notes: "",
  });
  const [termsText, setTermsText] = useState("");

  const { data: proposal, isLoading } = useQuery<Proposal>({
    queryKey: ["/api/proposals", id],
    queryFn: () => fetch(`/api/proposals/${id}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: activityLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/proposals", id, "activity"],
    queryFn: () => fetch(`/api/proposals/${id}/activity`, { credentials: "include" }).then(r => r.json()),
  });

  // Sync from server
  useEffect(() => {
    if (!proposal) return;
    setTitle(proposal.title);
    setClientName(proposal.clientName);
    setClientCompany(proposal.clientCompany);
    setClientEmail(proposal.clientEmail);
    setClientPhone(proposal.clientPhone);
    setServiceAddress(proposal.serviceAddress);
    setBillingAddress(proposal.billingAddress);
    setContactPerson(proposal.contactPerson);
    setLeadSource(proposal.leadSource);
    setExpiryDate(proposal.expiryDate);
    setInternalNotes(proposal.internalNotes);
    setTermsText(proposal.termsText);
    setEmailAddress(proposal.clientEmail || "");
    try { setServiceDetails(JSON.parse(proposal.serviceDetails)); } catch {}
    try { setScopeSections(JSON.parse(proposal.scopeSections)); } catch {}
    try { setIncludedItems(JSON.parse(proposal.includedItems)); } catch {}
    try { setPricingConfig(JSON.parse(proposal.pricingConfig)); } catch {}
  }, [proposal]);

  // Auto-fill email subject/message when dialog opens
  useEffect(() => {
    if (!emailDialogOpen || !proposal) return;
    let snapshot: any = {};
    try { snapshot = JSON.parse(proposal.businessSnapshot); } catch {}
    const bizName = snapshot.name || "Our team";
    setEmailSubject(`Proposal from ${bizName} — ${proposal.proposalNumber}`);
    setEmailMessage(`Hi ${clientName || "there"},\n\nPlease review the proposal from ${bizName}. You can open the secure proposal link to view, print, download, accept, or respond.\n\nThank you,\n${bizName}`);
  }, [emailDialogOpen]);

  const saveMutation = useMutation({
    mutationFn: (patch: Record<string, any>) => apiRequest("PATCH", `/api/proposals/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  const buildPayload = useCallback((extra?: Record<string, any>) => ({
    title, clientName, clientCompany, clientEmail, clientPhone,
    serviceAddress, billingAddress, contactPerson, leadSource,
    expiryDate, internalNotes, termsText,
    serviceDetails: JSON.stringify(serviceDetails),
    scopeSections: JSON.stringify(scopeSections),
    includedItems: JSON.stringify(includedItems),
    pricingConfig: JSON.stringify(pricingConfig),
    ...extra,
  }), [title, clientName, clientCompany, clientEmail, clientPhone, serviceAddress,
    billingAddress, contactPerson, leadSource, expiryDate, internalNotes, termsText,
    serviceDetails, scopeSections, includedItems, pricingConfig]);

  const save = useCallback((extra?: Record<string, any>) => {
    saveMutation.mutate(buildPayload(extra));
  }, [buildPayload]);

  const saveAndWait = useCallback((extra?: Record<string, any>): Promise<void> => {
    return new Promise((resolve, reject) => {
      saveMutation.mutate(buildPayload(extra), { onSuccess: () => resolve(), onError: reject });
    });
  }, [buildPayload]);

  const sendEmailMutation = useMutation({
    mutationFn: (opts: { to: string; subject: string; message: string; sendCopyToSelf: boolean }) =>
      apiRequest("POST", `/api/proposals/${id}/send-email`, opts),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setEmailDialogOpen(false);
      if (data.emailError) {
        toast({ title: "Proposal saved — email not sent", description: data.emailError, variant: "destructive" });
      } else {
        toast({ title: "Proposal sent", description: `Email sent to ${emailAddress}. Status updated to Sent.` });
      }
    },
    onError: () => toast({
      title: "Error", description: "Proposal saved, but the email could not be sent. Please check email settings or copy the proposal link instead.",
      variant: "destructive",
    }),
  });

  const refreshBrandingMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/proposals/${id}/refresh-branding`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", id] });
      toast({ title: "Branding refreshed", description: "Company info and logo have been updated from Settings." });
    },
    onError: () => toast({ title: "Error", description: "Could not refresh branding.", variant: "destructive" }),
  });

  const grammarMutation = useMutation({
    mutationFn: (rawText: string) => apiRequest("POST", "/api/proposals/grammar-cleanup", { rawText }),
    onSuccess: async (res) => {
      const data = await res.json();
      const clean = data.cleanText;
      if (!clean || !grammarField) return;
      if (grammarField === "internalNotes") setInternalNotes(clean);
      else if (grammarField === "termsText") setTermsText(clean);
      else if (grammarField === "pricingNotes") setPricingConfig(p => ({ ...p, notes: clean }));
      else if (grammarField === "emailMessage") setEmailMessage(clean);
      setGrammarField(null);
      toast({ title: "Grammar cleaned", description: "Text has been cleaned and updated." });
    },
    onError: () => { setGrammarField(null); toast({ title: "Cleanup failed", description: "Could not clean grammar. Text unchanged." }); },
  });

  function copyLink() {
    if (!proposal) return;
    const url = `${window.location.origin}/public/proposals/${proposal.publicToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Share this link with your client." });
  }

  function openPreview() {
    if (!proposal) return;
    window.open(`/public/proposals/${proposal.publicToken}`, "_blank");
  }

  function printProposal() {
    if (!proposal) return;
    const url = `/public/proposals/${proposal.publicToken}?print=1`;
    const w = window.open(url, "_blank");
    if (w) setTimeout(() => w.print(), 1200);
  }

  // ── Scope helpers ──────────────────────────────────────────────────────────
  function addSection() {
    setScopeSections(s => [...s, { id: uid(), title: "New Section", items: [] }]);
  }
  function updateSectionTitle(sIdx: number, t: string) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? { ...sec, title: t } : sec));
  }
  function removeSection(sIdx: number) {
    setScopeSections(s => s.filter((_, i) => i !== sIdx));
  }
  function addBullet(sIdx: number) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? { ...sec, items: [...sec.items, { id: uid(), text: "" }] } : sec));
  }
  function updateBullet(sIdx: number, bIdx: number, text: string) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? {
      ...sec, items: sec.items.map((b, j) => j === bIdx ? { ...b, text } : b),
    } : sec));
  }
  function removeBullet(sIdx: number, bIdx: number) {
    setScopeSections(s => s.map((sec, i) => i === sIdx ? {
      ...sec, items: sec.items.filter((_, j) => j !== bIdx),
    } : sec));
  }

  function addScopeFromTemplate() {
    if (!selectedScopeSection || selectedBullets.length === 0) return;
    const existing = scopeSections.find(s => s.title === selectedScopeSection);
    if (existing) {
      // Add bullets to existing section
      setScopeSections(s => s.map(sec => sec.title === selectedScopeSection
        ? { ...sec, items: [...sec.items, ...selectedBullets.filter(b => !sec.items.some(i => i.text === b)).map(b => ({ id: uid(), text: b }))] }
        : sec
      ));
    } else {
      setScopeSections(s => [...s, { id: uid(), title: selectedScopeSection, items: selectedBullets.map(b => ({ id: uid(), text: b })) }]);
    }
    setSelectedBullets([]);
    setSelectedScopeSection("");
    setScopeTemplateOpen(false);
  }

  // ── Included items helpers ─────────────────────────────────────────────────
  function addIncludedItem() {
    setIncludedItems(items => [...items, { id: uid(), label: "", status: "included" }]);
  }
  function updateIncludedItem(idx: number, patch: Partial<IncludedItem>) {
    setIncludedItems(items => items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function removeIncludedItem(idx: number) {
    setIncludedItems(items => items.filter((_, i) => i !== idx));
  }

  function addIncludedFromPresets() {
    const existing = new Set(includedItems.map(i => i.label));
    const newItems = selectedIncluded.filter(l => !existing.has(l)).map(l => ({ id: uid(), label: l, status: "included" as const }));
    setIncludedItems(items => [...items, ...newItems]);
    setSelectedIncluded([]);
    setIncludedPresetsOpen(false);
  }

  // ── Service template apply ─────────────────────────────────────────────────
  function applyServiceTemplate(serviceType: string) {
    const tmpl = SERVICE_TEMPLATES[serviceType];
    if (!tmpl) { setTemplateSuggestOpen(false); return; }
    const newSections = tmpl.scope.map(s => ({
      id: uid(), title: s.title, items: s.bullets.map(b => ({ id: uid(), text: b })),
    }));
    setScopeSections(prev => [...prev, ...newSections]);
    const existingLabels = new Set(includedItems.map(i => i.label));
    const newIncluded = tmpl.included.filter(l => !existingLabels.has(l)).map(l => ({ id: uid(), label: l, status: "included" as const }));
    setIncludedItems(prev => [...prev, ...newIncluded]);
    if (!pricingConfig.notes && tmpl.notes) setPricingConfig(p => ({ ...p, notes: tmpl.notes }));
    setTemplateSuggestOpen(false);
    toast({ title: "Template applied", description: `${serviceType} template sections and items added.` });
  }

  // ── Pricing helpers ────────────────────────────────────────────────────────
  function addLineItem() {
    setPricingConfig(p => ({
      ...p,
      lineItems: [...p.lineItems, { id: uid(), name: "", description: "", quantity: 1, unitPrice: 0, taxable: true }],
    }));
  }
  function updateLineItem(idx: number, patch: Partial<PricingLineItem>) {
    setPricingConfig(p => ({ ...p, lineItems: p.lineItems.map((li, i) => i === idx ? { ...li, ...patch } : li) }));
  }
  function removeLineItem(idx: number) {
    setPricingConfig(p => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== idx) }));
  }
  function setTaxType(type: string) {
    const preset = TAX_TYPES.find(t => t.value === type);
    setPricingConfig(p => ({
      ...p,
      taxConfig: { type: type as TaxConfig["type"], rate: preset?.rate ?? p.taxConfig.rate, label: preset?.label ?? p.taxConfig.label },
    }));
  }

  // ── Pricing math ───────────────────────────────────────────────────────────
  const lineSubtotal = pricingConfig.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const effectiveSubtotal = pricingConfig.subtotalOverride != null ? pricingConfig.subtotalOverride : lineSubtotal;
  const taxableAmount = pricingConfig.subtotalOverride != null
    ? effectiveSubtotal
    : pricingConfig.lineItems.filter(i => i.taxable).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = taxableAmount * (pricingConfig.taxConfig.rate / 100);
  const totalAmount = effectiveSubtotal + taxAmount;

  const publicUrl = proposal ? `${window.location.origin}/public/proposals/${proposal.publicToken}` : "";

  const formatActivity = (log: any) => {
    const labels: Record<string, string> = {
      created: "Proposal created", sent_email: "Sent by email", viewed: "Client viewed", archived: "Archived",
      unarchived: "Unarchived", accepted: "Client accepted", rejected: "Client rejected", thinking: "Client is thinking",
    };
    return labels[log.eventType] || log.eventType;
  };

  // Grammar cleanup helper
  function runGrammarCleanup(field: string, text: string) {
    if (!text.trim()) return;
    setGrammarField(field);
    grammarMutation.mutate(text);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="space-y-3 w-64">
          <div className="h-4 bg-muted animate-pulse rounded" />
          <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        </div>
      </div>
    );
  }
  if (!proposal) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Proposal not found.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/proposals")} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-sm truncate max-w-[200px]">{proposal.title}</h1>
              <span className="text-xs text-muted-foreground font-mono">{proposal.proposalNumber}</span>
              <Badge className={`text-[10px] h-5 px-2 ${STATUS_COLORS[proposal.status] || "bg-gray-100 text-gray-600"}`}>
                {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { save(); toast({ title: "Saved" }); }} disabled={saveMutation.isPending} data-testid="button-save-proposal">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink} data-testid="button-copy-proposal-link">
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={openPreview} data-testid="button-preview-proposal">
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Preview
          </Button>
          <Button size="sm" onClick={() => setEmailDialogOpen(true)} data-testid="button-send-email-proposal">
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Step navigation */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20 overflow-x-auto">
        {STEPS.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => { save(); setStep(idx); }}
            data-testid={`step-${s.id}`}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              step === idx ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <s.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{s.label}</span>
            <span className="sm:hidden">{idx + 1}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

          {/* ── Step 0: Client ───────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold mb-4">Client / Lead Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Proposal Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Office Cleaning Proposal" data-testid="input-proposal-title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client / Lead Name</Label>
                    <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith" data-testid="input-client-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Name</Label>
                    <Input value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="ABC Restaurant" data-testid="input-client-company" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client Email</Label>
                    <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@example.com" data-testid="input-client-email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client Phone</Label>
                    <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(204) 555-0100" data-testid="input-client-phone" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Service Address</Label>
                    <Input value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} placeholder="123 Main Street, Winnipeg, MB" data-testid="input-service-address" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Billing Address <span className="text-muted-foreground text-xs">(if different)</span></Label>
                    <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Same as service address" data-testid="input-billing-address" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact Person</Label>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Office Manager" data-testid="input-contact-person" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lead Source</Label>
                    <Input value={leadSource} onChange={e => setLeadSource(e.target.value)} placeholder="Referral, Google, etc." data-testid="input-lead-source" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expiry Date</Label>
                    <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} data-testid="input-expiry-date" />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Internal Notes <span className="text-muted-foreground text-xs">(never shown on public proposal)</span></Label>
                  <div className="flex items-center gap-1">
                    <VoiceMicButton onTranscript={t => setInternalNotes(n => n ? `${n} ${t}` : t)} />
                    {internalNotes && (
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => runGrammarCleanup("internalNotes", internalNotes)} disabled={grammarMutation.isPending && grammarField === "internalNotes"}>
                        <Wand2 className="w-3 h-3 mr-1" />
                        {grammarMutation.isPending && grammarField === "internalNotes" ? "Cleaning…" : "Clean"}
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Notes visible only to your team…" data-testid="input-internal-notes" />
              </div>
            </div>
          )}

          {/* ── Step 1: Service Details ─────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Service Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Service Type</Label>
                  <div className="flex gap-2">
                    <Select value={serviceDetails.serviceType} onValueChange={v => {
                      setServiceDetails(d => ({ ...d, serviceType: v }));
                      if (SERVICE_TEMPLATES[v]) {
                        setTemplateSuggestService(v);
                        setTemplateSuggestOpen(true);
                      }
                    }}>
                      <SelectTrigger className="flex-1" data-testid="select-service-type"><SelectValue placeholder="Select service type…" /></SelectTrigger>
                      <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {serviceDetails.serviceType && SERVICE_TEMPLATES[serviceDetails.serviceType] && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ListChecks className="w-3 h-3" />
                      Template available — go to Scope step to apply preset sections.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={serviceDetails.frequency} onValueChange={v => setServiceDetails(d => ({ ...d, frequency: v }))}>
                    <SelectTrigger data-testid="select-frequency"><SelectValue placeholder="How often?" /></SelectTrigger>
                    <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Days Per Week</Label>
                  <Select value={serviceDetails.daysPerWeek} onValueChange={v => setServiceDetails(d => ({ ...d, daysPerWeek: v }))}>
                    <SelectTrigger data-testid="select-days-per-week"><SelectValue placeholder="Days/week?" /></SelectTrigger>
                    <SelectContent>{DAYS_PER_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Hours Per Visit</Label>
                  <Input value={serviceDetails.hoursPerVisit} onChange={e => setServiceDetails(d => ({ ...d, hoursPerVisit: e.target.value }))} placeholder="e.g. 2" data-testid="input-hours-per-visit" />
                </div>
                <div className="space-y-1.5">
                  <Label>Number of Cleaners</Label>
                  <Input value={serviceDetails.numCleaners} onChange={e => setServiceDetails(d => ({ ...d, numCleaners: e.target.value }))} placeholder="e.g. 2" data-testid="input-num-cleaners" />
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Time</Label>
                  <Select value={serviceDetails.preferredTime} onValueChange={v => setServiceDetails(d => ({ ...d, preferredTime: v }))}>
                    <SelectTrigger data-testid="select-preferred-time"><SelectValue placeholder="Time preference?" /></SelectTrigger>
                    <SelectContent>{PREFERRED_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Contract Length</Label>
                  <Select value={serviceDetails.contractLength} onValueChange={v => setServiceDetails(d => ({ ...d, contractLength: v }))}>
                    <SelectTrigger data-testid="select-contract-length"><SelectValue placeholder="Contract length?" /></SelectTrigger>
                    <SelectContent>{CONTRACT_LENGTHS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Proposed Start Date</Label>
                  <Input type="date" value={serviceDetails.proposedStartDate} onChange={e => setServiceDetails(d => ({ ...d, proposedStartDate: e.target.value }))} data-testid="input-proposed-start" />
                </div>
              </div>

              {serviceDetails.hoursPerVisit && serviceDetails.numCleaners && serviceDetails.daysPerWeek && (
                <div className="rounded-xl bg-muted/40 border p-4 space-y-1 text-sm">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">Monthly Estimate</p>
                  {(() => {
                    const hpv = parseFloat(serviceDetails.hoursPerVisit) || 0;
                    const nc = parseFloat(serviceDetails.numCleaners) || 1;
                    const dpw = parseFloat(serviceDetails.daysPerWeek) || 0;
                    const weeklyHours = hpv * nc * dpw;
                    const monthlyHours = weeklyHours * 4.33;
                    return (
                      <>
                        <p>Hours per visit: <strong>{hpv} × {nc} cleaner{nc !== 1 ? "s" : ""} = {hpv * nc} hrs</strong></p>
                        <p>Weekly hours: <strong>{weeklyHours.toFixed(1)} hrs ({dpw} days/week)</strong></p>
                        <p>Estimated monthly hours: <strong>{monthlyHours.toFixed(1)} hrs</strong></p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Scope of Work ───────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-semibold">Scope of Work</h2>
                <div className="flex items-center gap-2">
                  {/* Apply service template button */}
                  {serviceDetails.serviceType && SERVICE_TEMPLATES[serviceDetails.serviceType] && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                      setTemplateSuggestService(serviceDetails.serviceType);
                      setTemplateSuggestOpen(true);
                    }}>
                      <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                      Apply Template
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { setSelectedScopeSection(""); setSelectedBullets([]); setScopeTemplateOpen(true); }} data-testid="button-add-from-template">
                    <ListChecks className="w-3.5 h-3.5 mr-1.5" />
                    Add from Preset
                  </Button>
                  <Button variant="outline" size="sm" onClick={addSection} data-testid="button-add-section">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Section
                  </Button>
                </div>
              </div>

              {scopeSections.length === 0 && (
                <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                  <AlignLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm mb-3">No scope sections yet.</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedScopeSection(""); setSelectedBullets([]); setScopeTemplateOpen(true); }}>
                      <ListChecks className="w-3.5 h-3.5 mr-1.5" /> Add from Preset
                    </Button>
                    <Button variant="outline" size="sm" onClick={addSection}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Custom Section
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {scopeSections.map((section, sIdx) => (
                  <div key={section.id} className="border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={section.title}
                        onChange={e => updateSectionTitle(sIdx, e.target.value)}
                        className="h-7 text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 flex-1"
                        placeholder="Section title…"
                        data-testid={`input-section-title-${sIdx}`}
                      />
                      <VoiceMicButton onTranscript={t => updateSectionTitle(sIdx, t)} />
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeSection(sIdx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {section.items.map((bullet, bIdx) => (
                        <div key={bullet.id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-px" />
                          <Input
                            value={bullet.text}
                            onChange={e => updateBullet(sIdx, bIdx, e.target.value)}
                            className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 flex-1"
                            placeholder="Bullet point…"
                            data-testid={`input-bullet-${sIdx}-${bIdx}`}
                          />
                          <VoiceMicButton onTranscript={t => updateBullet(sIdx, bIdx, t)} />
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeBullet(sIdx, bIdx)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 mt-1" onClick={() => addBullet(sIdx)} data-testid={`button-add-bullet-${sIdx}`}>
                        <Plus className="w-3 h-3 mr-1" /> Add bullet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* What's Included */}
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-semibold">What's Included</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedIncluded([]); setIncludedPresetsOpen(true); }} data-testid="button-add-included-presets">
                      <ListChecks className="w-3 h-3 mr-1" /> Add from Presets
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={addIncludedItem} data-testid="button-add-included">
                      <Plus className="w-3 h-3 mr-1" /> Custom item
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {includedItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Input
                        value={item.label}
                        onChange={e => updateIncludedItem(idx, { label: e.target.value })}
                        className="h-8 text-sm flex-1"
                        placeholder="Item name…"
                        data-testid={`input-included-label-${idx}`}
                      />
                      <Select value={item.status} onValueChange={v => updateIncludedItem(idx, { status: v as IncludedItem["status"] })}>
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="included">Included</SelectItem>
                          <SelectItem value="not_included">Not Included</SelectItem>
                          <SelectItem value="extra_cost">Extra Cost</SelectItem>
                          <SelectItem value="client_supplied">Client Supplied</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeIncludedItem(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {includedItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">No items yet. Add what's included in the service.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Pricing ──────────────────────────────────────── */}
          {step === 3 && (() => {
            // Billing type helpers
            const billingType = pricingConfig.billingType || "";
            const btPreset = BILLING_TYPES.find(b => b.value === billingType);
            const billingLabel = pricingConfig.billingLabel || btPreset?.billingLabel || "Total";
            const billingSuffix = pricingConfig.billingSuffix !== undefined ? pricingConfig.billingSuffix : (btPreset?.suffix ?? "");

            // Contract estimate
            const dpw = parseFloat(serviceDetails.daysPerWeek) || 0;
            const visitsPerMonth = dpw * 4.33;
            const multiplier = billingType && serviceDetails.contractLength
              ? getContractMultiplier(serviceDetails.contractLength, billingType, visitsPerMonth)
              : null;
            const contractEstimate = multiplier != null ? totalAmount * multiplier : null;
            const hasBillingType = !!billingType;

            function setBillingType(v: string) {
              const preset = BILLING_TYPES.find(b => b.value === v);
              setPricingConfig(p => ({
                ...p,
                billingType: v,
                billingLabel: preset?.billingLabel ?? "Total",
                billingSuffix: preset?.suffix ?? "",
              }));
            }

            return (
              <div className="space-y-6">
                {/* Billing Type — most important, at the top */}
                <div className="border rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Billing Type <span className="text-red-500">*</span></h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tells the client whether this price is per visit, monthly, yearly, or for the full contract.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={billingType} onValueChange={setBillingType}>
                      <SelectTrigger className="w-56" data-testid="select-billing-type">
                        <SelectValue placeholder="Select billing type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {billingType === "custom" && (
                      <div className="flex items-center gap-2">
                        <Input
                          value={pricingConfig.billingLabel || ""}
                          onChange={e => setPricingConfig(p => ({ ...p, billingLabel: e.target.value }))}
                          className="h-9 w-44 text-sm"
                          placeholder="e.g. Monthly Total"
                          data-testid="input-custom-billing-label"
                        />
                        <Input
                          value={pricingConfig.billingSuffix || ""}
                          onChange={e => setPricingConfig(p => ({ ...p, billingSuffix: e.target.value }))}
                          className="h-9 w-32 text-sm"
                          placeholder="e.g. / month"
                          data-testid="input-custom-billing-suffix"
                        />
                      </div>
                    )}
                  </div>
                  {!hasBillingType && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Please select a billing type so the client knows whether this price is per visit, monthly, yearly, or for the full contract.
                    </p>
                  )}
                  {hasBillingType && billingLabel && (
                    <p className="text-xs text-muted-foreground">
                      The total will display as: <strong>{billingLabel}{billingSuffix ? ` (${billingSuffix})` : ""}</strong>
                    </p>
                  )}
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold">Line Items</h2>
                    <Button variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Line Item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {pricingConfig.lineItems.length > 0 && (
                      <div className="grid grid-cols-[1fr_80px_100px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Item</span><span className="text-center">Qty</span><span className="text-center">Unit Price</span><span className="text-right">Subtotal</span><span />
                      </div>
                    )}
                    {pricingConfig.lineItems.map((item, idx) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="grid grid-cols-[1fr_80px_100px_80px_32px] gap-2 items-center">
                          <Input value={item.name} onChange={e => updateLineItem(idx, { name: e.target.value })} className="h-8 text-sm" placeholder="Service or item name" data-testid={`input-line-name-${idx}`} />
                          <Input type="number" min="0" step="1" value={item.quantity} onChange={e => updateLineItem(idx, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-sm text-center" data-testid={`input-line-qty-${idx}`} />
                          <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateLineItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} className="h-8 text-sm text-right" data-testid={`input-line-price-${idx}`} />
                          <span className="text-sm font-medium text-right tabular-nums">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => removeLineItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4">
                          <Input value={item.description} onChange={e => updateLineItem(idx, { description: e.target.value })} className="h-7 text-xs flex-1 text-muted-foreground" placeholder="Optional description…" />
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                            <Switch checked={item.taxable} onCheckedChange={v => updateLineItem(idx, { taxable: v })} className="scale-75" data-testid={`switch-taxable-${idx}`} />
                            <span>Taxable</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {pricingConfig.lineItems.length === 0 && (
                      <div className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground text-sm">
                        Add line items to build the price.
                      </div>
                    )}
                  </div>
                </div>

                {/* Tax */}
                <div className="border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Tax</h3>
                  <div className="flex items-center gap-3">
                    <Select value={pricingConfig.taxConfig.type} onValueChange={setTaxType}>
                      <SelectTrigger className="w-52" data-testid="select-tax-type"><SelectValue /></SelectTrigger>
                      <SelectContent>{TAX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {pricingConfig.taxConfig.type === "custom" && (
                      <div className="flex items-center gap-2">
                        <Input type="number" min="0" step="0.1" value={pricingConfig.taxConfig.rate} onChange={e => setPricingConfig(p => ({ ...p, taxConfig: { ...p.taxConfig, rate: parseFloat(e.target.value) || 0, label: `Custom (${e.target.value}%)` } }))} className="h-9 w-20 text-sm" data-testid="input-custom-tax-rate" />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtotal override */}
                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Manual Subtotal Override</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch checked={pricingConfig.subtotalOverride != null} onCheckedChange={v => setPricingConfig(p => ({ ...p, subtotalOverride: v ? lineSubtotal : null }))} data-testid="switch-subtotal-override" />
                      Override calculated total
                    </div>
                  </div>
                  {pricingConfig.subtotalOverride != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input type="number" min="0" step="0.01" value={pricingConfig.subtotalOverride} onChange={e => setPricingConfig(p => ({ ...p, subtotalOverride: parseFloat(e.target.value) || 0 }))} className="h-9 w-36 text-sm" data-testid="input-subtotal-override" />
                    </div>
                  )}
                </div>

                {/* Pricing Notes / Billing Details */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Pricing Notes / Billing Details</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Add payment terms, billing schedule, pricing assumptions, or special conditions.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <VoiceMicButton onTranscript={t => setPricingConfig(p => ({ ...p, notes: p.notes ? `${p.notes} ${t}` : t }))} />
                      {pricingConfig.notes && (
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => runGrammarCleanup("pricingNotes", pricingConfig.notes)} disabled={grammarMutation.isPending && grammarField === "pricingNotes"}>
                          <Wand2 className="w-3 h-3 mr-1" />
                          {grammarMutation.isPending && grammarField === "pricingNotes" ? "Cleaning…" : "Clean"}
                        </Button>
                      )}
                    </div>
                  </div>
                  <Textarea
                    value={pricingConfig.notes}
                    onChange={e => setPricingConfig(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="e.g. Pricing is based on the selected billing period, service frequency, and estimated labour. Additional work outside the listed scope may require approval and will be billed separately. Payment terms will be confirmed before service begins."
                    data-testid="textarea-pricing-notes"
                  />
                </div>

                {/* Pricing Summary */}
                <div className="border rounded-xl bg-muted/30 p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Pricing Preview</p>
                  {pricingConfig.lineItems.length > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">${effectiveSubtotal.toFixed(2)}</span></div>
                  )}
                  {pricingConfig.subtotalOverride != null && (
                    <div className="flex justify-between text-amber-700"><span>Manual override</span><span className="tabular-nums">${effectiveSubtotal.toFixed(2)}</span></div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">{pricingConfig.taxConfig.label}</span><span className="tabular-nums">${taxAmount.toFixed(2)}</span></div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>{billingLabel}</span>
                    <span className="tabular-nums">
                      ${totalAmount.toFixed(2)}{billingSuffix ? <span className="text-sm font-normal text-muted-foreground ml-1">{billingSuffix}</span> : null}
                    </span>
                  </div>
                  {contractEstimate != null && serviceDetails.contractLength && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm font-medium text-primary">
                        <span>{contractLabel(serviceDetails.contractLength, billingType)}</span>
                        <span className="tabular-nums">${contractEstimate.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {!hasBillingType && totalAmount > 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      ⚠ Billing type not set — client will see a generic "Total". Please set a billing type above.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Step 4: Terms ────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-semibold">Terms & Conditions</h2>
                <div className="flex items-center gap-1">
                  <VoiceMicButton onTranscript={t => setTermsText(n => n ? `${n}\n${t}` : t)} />
                  {termsText && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => runGrammarCleanup("termsText", termsText)} disabled={grammarMutation.isPending && grammarField === "termsText"}>
                      <Wand2 className="w-3 h-3 mr-1" />
                      {grammarMutation.isPending && grammarField === "termsText" ? "Cleaning…" : "Clean Grammar"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Terms style selector */}
              <div className="flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap">Terms Style</Label>
                <Select value={termsStyle} onValueChange={(v: any) => {
                  setTermsStyle(v);
                  if (v === "standard") setTermsText(PROFESSIONAL_TERMS);
                  else if (v === "short") setTermsText(SHORT_TERMS);
                }}>
                  <SelectTrigger className="w-56" data-testid="select-terms-style"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Cleaning Terms</SelectItem>
                    <SelectItem value="short">Short Terms</SelectItem>
                    <SelectItem value="custom">Custom Terms</SelectItem>
                  </SelectContent>
                </Select>
                {termsStyle !== "custom" && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setTermsStyle("custom")}>
                    Edit custom
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground">These terms will appear on the public proposal. You can edit them freely.</p>
              <Textarea
                value={termsText}
                onChange={e => { setTermsText(e.target.value); setTermsStyle("custom"); }}
                rows={14}
                className="font-mono text-sm"
                placeholder="Enter your terms and conditions…"
                data-testid="textarea-terms"
              />
            </div>
          )}

          {/* ── Step 5: Share ─────────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Preview & Share</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshBrandingMutation.mutate()}
                  disabled={refreshBrandingMutation.isPending}
                  data-testid="button-refresh-branding"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshBrandingMutation.isPending && "animate-spin")} />
                  Refresh Branding from Settings
                </Button>
              </div>

              {/* Business snapshot preview */}
              {(() => {
                let snap: any = {};
                try { snap = JSON.parse(proposal.businessSnapshot); } catch {}
                if (!snap.name) return null;
                return (
                  <div className="border rounded-xl p-4 bg-muted/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Business Info on Proposal</p>
                    <div className="flex items-center gap-3">
                      {snap.logoUrl && <img src={snap.logoUrl} alt={snap.name} className="h-10 object-contain rounded" />}
                      <div className="text-sm">
                        <p className="font-semibold">{snap.name}</p>
                        {(snap.address || snap.city) && <p className="text-muted-foreground text-xs">{[snap.address, snap.city, snap.province].filter(Boolean).join(", ")}</p>}
                        {snap.phone && <p className="text-muted-foreground text-xs">{snap.phone}</p>}
                      </div>
                      {snap.brandColor && <div className="w-6 h-6 rounded-full border ml-auto" style={{ backgroundColor: snap.brandColor }} title={snap.brandColor} />}
                    </div>
                  </div>
                );
              })()}

              {/* Public link */}
              <div className="border rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold">Shareable Link</h3>
                <div className="flex items-center gap-2">
                  <Input value={publicUrl} readOnly className="text-sm font-mono bg-muted/40" data-testid="input-public-url" />
                  <Button variant="outline" size="icon" onClick={copyLink} data-testid="button-copy-link-share">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={openPreview} data-testid="button-open-link-share">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={openPreview} data-testid="button-preview-public">
                  <Eye className="w-5 h-5" />
                  <span className="text-sm">Preview</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={copyLink} data-testid="button-copy-link-final">
                  <Copy className="w-5 h-5" />
                  <span className="text-sm">Copy Link</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setEmailDialogOpen(true)} data-testid="button-send-email-final">
                  <Mail className="w-5 h-5" />
                  <span className="text-sm">Send Email</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={printProposal} data-testid="button-print-proposal">
                  <Printer className="w-5 h-5" />
                  <span className="text-sm">Print</span>
                </Button>
              </div>

              {/* Activity log */}
              {activityLogs.length > 0 && (
                <div className="border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Activity Timeline</h3>
                  <div className="space-y-2">
                    {activityLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{formatActivity(log)}</span>
                          {log.eventData && (() => { try { const d = JSON.parse(log.eventData); return d.to ? <span className="text-muted-foreground text-xs ml-1">→ {d.to}</span> : null; } catch { return null; } })()}
                          <span className="text-muted-foreground text-xs ml-2">
                            {new Date(log.createdAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Client response */}
              {["accepted", "rejected", "thinking"].includes(proposal.status) && (() => {
                try {
                  const cr = JSON.parse(proposal.clientResponse || "{}");
                  return (
                    <div className="border rounded-xl p-4 space-y-2 bg-muted/20">
                      <h3 className="text-sm font-semibold">Client Response</h3>
                      {cr.name && <p className="text-sm"><span className="text-muted-foreground">Name:</span> {cr.name}</p>}
                      {cr.email && <p className="text-sm"><span className="text-muted-foreground">Email:</span> {cr.email}</p>}
                      {cr.rejectionReason && <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {cr.rejectionReason}</p>}
                      {cr.note && <p className="text-sm"><span className="text-muted-foreground">Note:</span> {cr.note}</p>}
                      {cr.preferredStartDate && <p className="text-sm"><span className="text-muted-foreground">Preferred start:</span> {cr.preferredStartDate}</p>}
                      {cr.followUpDate && <p className="text-sm"><span className="text-muted-foreground">Follow-up by:</span> {cr.followUpDate}</p>}
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          )}

          {/* Step nav buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => { save(); setStep(s => Math.max(0, s - 1)); }} disabled={step === 0}>
              <ChevronLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button onClick={() => { save(); step < STEPS.length - 1 ? setStep(s => s + 1) : toast({ title: "All done! Use the Share step to send your proposal." }); }}>
              {step < STEPS.length - 1 ? <><span>Next</span><ChevronRight className="w-4 h-4 ml-1.5" /></> : <><Check className="w-4 h-4 mr-1.5" />Save & Done</>}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Send Email Dialog ──────────────────────────────────────────────── */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Proposal by Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client Email</Label>
              <Input type="email" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} placeholder="client@example.com" data-testid="input-send-email-address" />
              <p className="text-xs text-muted-foreground">The email will include a secure link to view the full proposal.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} data-testid="input-send-email-subject" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="flex items-center gap-1">
                  <VoiceMicButton onTranscript={t => setEmailMessage(m => m ? `${m}\n${t}` : t)} />
                  {emailMessage && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => runGrammarCleanup("emailMessage", emailMessage)} disabled={grammarMutation.isPending && grammarField === "emailMessage"}>
                      <Wand2 className="w-3 h-3 mr-1" />
                      {grammarMutation.isPending && grammarField === "emailMessage" ? "Cleaning…" : "Clean"}
                    </Button>
                  )}
                </div>
              </div>
              <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} rows={4} placeholder="Optional message to your client…" data-testid="textarea-send-email-message" />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox checked={sendCopyToSelf} onCheckedChange={v => setSendCopyToSelf(!!v)} id="send-copy" data-testid="checkbox-send-copy" />
              <label htmlFor="send-copy" className="text-sm cursor-pointer">Send a copy to myself</label>
            </div>
            {!clientEmail && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                No client email saved on this proposal. You can type one above — it will be saved automatically when you send.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                // Auto-save first so status/clientEmail updates are captured
                await saveAndWait({ clientEmail: emailAddress || clientEmail });
                sendEmailMutation.mutate({
                  to: emailAddress || clientEmail,
                  subject: emailSubject,
                  message: emailMessage,
                  sendCopyToSelf,
                });
              }}
              disabled={sendEmailMutation.isPending || (!emailAddress && !clientEmail)}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending ? "Sending…" : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Scope Template Picker ──────────────────────────────────────────── */}
      <Dialog open={scopeTemplateOpen} onOpenChange={setScopeTemplateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Scope Items from Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Section Type</Label>
              <Select value={selectedScopeSection} onValueChange={v => { setSelectedScopeSection(v); setSelectedBullets([]); }}>
                <SelectTrigger data-testid="select-scope-section"><SelectValue placeholder="Choose a section type…" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(SCOPE_SECTION_PRESETS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selectedScopeSection && SCOPE_SECTION_PRESETS[selectedScopeSection] && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Select items to add</Label>
                  <Button
                    variant="ghost" size="sm" className="text-xs"
                    onClick={() => setSelectedBullets(prev => prev.length === SCOPE_SECTION_PRESETS[selectedScopeSection].length ? [] : [...SCOPE_SECTION_PRESETS[selectedScopeSection]])}
                  >
                    {selectedBullets.length === SCOPE_SECTION_PRESETS[selectedScopeSection].length ? "Deselect all" : "Select all"}
                  </Button>
                </div>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {SCOPE_SECTION_PRESETS[selectedScopeSection].map(bullet => (
                    <label key={bullet} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                      <Checkbox
                        checked={selectedBullets.includes(bullet)}
                        onCheckedChange={v => setSelectedBullets(prev => v ? [...prev, bullet] : prev.filter(b => b !== bullet))}
                      />
                      <span className="text-sm">{bullet}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{selectedBullets.length} item{selectedBullets.length !== 1 ? "s" : ""} selected</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScopeTemplateOpen(false)}>Cancel</Button>
            <Button onClick={addScopeFromTemplate} disabled={!selectedScopeSection || selectedBullets.length === 0} data-testid="button-add-selected-scope">
              Add Selected ({selectedBullets.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Included Presets Picker ────────────────────────────────────────── */}
      <Dialog open={includedPresetsOpen} onOpenChange={setIncludedPresetsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add from What's Included Presets</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Select items to add to your proposal.</p>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedIncluded(prev => prev.length === INCLUDED_PRESETS.length ? [] : [...INCLUDED_PRESETS])}>
                {selectedIncluded.length === INCLUDED_PRESETS.length ? "Deselect all" : "Select all"}
              </Button>
            </div>
            <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
              {INCLUDED_PRESETS.map(preset => (
                <label key={preset} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                  <Checkbox
                    checked={selectedIncluded.includes(preset)}
                    onCheckedChange={v => setSelectedIncluded(prev => v ? [...prev, preset] : prev.filter(p => p !== preset))}
                  />
                  <span className="text-sm">{preset}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedIncluded.length} item{selectedIncluded.length !== 1 ? "s" : ""} selected. Duplicates will be skipped.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncludedPresetsOpen(false)}>Cancel</Button>
            <Button onClick={addIncludedFromPresets} disabled={selectedIncluded.length === 0} data-testid="button-add-selected-included">
              Add Selected ({selectedIncluded.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Service Template Suggestion ────────────────────────────────────── */}
      <Dialog open={templateSuggestOpen} onOpenChange={setTemplateSuggestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Service Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            A preset template is available for <strong>{templateSuggestService}</strong>. This will add suggested scope sections and included items. Your existing content will stay — new items are added alongside it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateSuggestOpen(false)}>No thanks</Button>
            <Button onClick={() => applyServiceTemplate(templateSuggestService)} data-testid="button-apply-service-template">
              <Wand2 className="w-4 h-4 mr-1.5" />
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
