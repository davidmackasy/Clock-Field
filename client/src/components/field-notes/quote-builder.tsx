import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Check, ChevronDown, ChevronUp, Plus, X, Loader2,
  DollarSign, Building, LayoutList, FileCheck, Sparkles,
  Wand2, Lock, Home, Briefcase, Factory, CheckCircle2, XCircle,
  Receipt, Percent, Trash2, CalendarClock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────
type PropertyType = "residential" | "commercial" | "industrial" | "";

interface TaxLine { name: string; rate: string; }

interface AddOnPricingLine {
  name: string;
  pricingType: string;
  amount: string;
  included: boolean;
}

// Default pricing type per add-on name
const ADDON_DEFAULT_TYPE: Record<string, string> = {
  "Deep Clean": "One-time",
  "Strip & Wax Floors": "One-time",
  "Disinfection": "One-time",
  "Floor Buffing": "One-time",
  "Power Washing": "One-time",
  "Post-Construction Cleanup": "One-time",
  "Carpet Spot Cleaning": "One-time",
  "Odor Treatment": "One-time",
  "Inside Windows": "One-time",
  "Restocking": "Per visit",
  "High-Touch Detailing": "Per visit",
};

const ADDON_PRICING_TYPES = ["One-time", "Per visit", "Per week", "Per month", "Custom"];

// ── Display billing period ─────────────────────────────────────────────────────
const DISPLAY_PERIODS = [
  "Per visit", "Weekly", "Bi-weekly", "Monthly",
  "Every 2 months", "Quarterly", "6 months", "Custom",
];

function getDisplayPeriodLabel(period: string, customWeeks?: string, customMonths?: string): string {
  if (period === "Custom") {
    if (customMonths && parseInt(customMonths) > 0) return `${customMonths}-month service`;
    if (customWeeks && parseInt(customWeeks) > 0) return `${customWeeks}-week service`;
    return "Custom period";
  }
  const map: Record<string, string> = {
    "Per visit": "Per visit", "Weekly": "Weekly", "Bi-weekly": "Bi-weekly",
    "Monthly": "Monthly", "Every 2 months": "Every 2 months",
    "Quarterly": "Quarterly", "6 months": "6-month",
  };
  return map[period] || period;
}

// Compute the display amount from a base per-visit price scaled to a display period
function computeDisplayAmountFromPerVisit(
  perVisitAmt: number,
  daysPerWeek: number,
  displayPeriod: string,
  customWeeks?: string,
  customMonths?: string
): number {
  const visitsPerWeek = daysPerWeek;
  const visitsPerMonth = daysPerWeek * 4;
  switch (displayPeriod) {
    case "Per visit":       return perVisitAmt;
    case "Weekly":          return perVisitAmt * visitsPerWeek;
    case "Bi-weekly":       return perVisitAmt * visitsPerWeek * 2;
    case "Monthly":         return perVisitAmt * visitsPerMonth;
    case "Every 2 months":  return perVisitAmt * visitsPerMonth * 2;
    case "Quarterly":       return perVisitAmt * visitsPerMonth * 3;
    case "6 months":        return perVisitAmt * visitsPerMonth * 6;
    case "Custom": {
      if (customMonths && parseInt(customMonths) > 0)
        return perVisitAmt * visitsPerMonth * parseInt(customMonths);
      if (customWeeks && parseInt(customWeeks) > 0)
        return perVisitAmt * visitsPerWeek * parseInt(customWeeks);
      return perVisitAmt;
    }
    default: return perVisitAmt;
  }
}

// Scale an add-on amount based on its pricingType and the selected display period
function scaleAddonForDisplay(
  addonAmt: number,
  pricingType: string,
  displayPeriod: string,
  daysPerWeek: number,
  customWeeks?: string,
  customMonths?: string
): number {
  // One-time add-ons never scale
  if (!pricingType || pricingType === "One-time") return addonAmt;
  // Recurring add-ons: scale the same way as base service
  return computeDisplayAmountFromPerVisit(
    pricingType === "Per visit"  ? addonAmt :
    pricingType === "Per week"   ? addonAmt / daysPerWeek :
    pricingType === "Per month"  ? addonAmt / (daysPerWeek * 4) : addonAmt,
    daysPerWeek, displayPeriod, customWeeks, customMonths
  );
}

// ── Helpers: parse / stringify tag arrays from quoteData ───────────────────────
function parseTags(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}
function stringifyTags(tags: string[]): string { return JSON.stringify(tags); }

function parseTaxes(v: any): TaxLine[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

function parseAddonPricingLines(v: any): AddOnPricingLine[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

// Sync add-on pricing lines to match the current set of add-on tags
function syncAddonPricingLines(tags: string[], existing: AddOnPricingLine[]): AddOnPricingLine[] {
  const kept = existing.filter(l => tags.includes(l.name));
  const newTags = tags.filter(t => !existing.find(l => l.name === t));
  const newLines: AddOnPricingLine[] = newTags.map(name => ({
    name,
    pricingType: ADDON_DEFAULT_TYPE[name] || "One-time",
    amount: "",
    included: true,
  }));
  return [...kept, ...newLines];
}

// Parse a price string like "$1,200" or "$1200/month" → number or null
function parseAmount(s: string): number | null {
  const m = s.replace(/[$,\/\s]/g, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function fmtDollar(n: number): string {
  return "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── TagInput ──────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange, placeholder, testId }: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
  testId?: string;
}) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); setInput(""); }
  };
  const remove = (i: number) => onChange(tags.filter((_, j) => j !== i));
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        <Input
          ref={ref}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-7 text-xs flex-1"
          data-testid={testId}
        />
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          onClick={add}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-muted border rounded-full px-2 py-0.5 text-[11px]">
              {t}
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-foreground">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dropdown field helper ─────────────────────────────────────────────────────
function DropField({ label, value, onChange, options, testId, wide }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <Label className="text-[11px] text-muted-foreground mb-1 block">{label}</Label>
      <Select value={value || "none"} onValueChange={v => onChange(v === "none" ? "" : v)}>
        <SelectTrigger className="h-7 text-xs" data-testid={testId}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Text field helper ─────────────────────────────────────────────────────────
function TextField({ label, value, onChange, placeholder, testId, wide }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; testId?: string; wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <Label className="text-[11px] text-muted-foreground mb-1 block">{label}</Label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-xs"
        data-testid={testId}
      />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, open, onToggle, children, badge }: {
  title: string; icon: React.ReactNode; open: boolean;
  onToggle: () => void; children: React.ReactNode; badge?: string;
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
        onClick={onToggle}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-bold text-foreground uppercase tracking-wide flex-1">{title}</span>
        {badge && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-4">{children}</div>}
    </div>
  );
}

// ── Dropdown option sets ──────────────────────────────────────────────────────
const COUNT_0_10 = ["0","1","2","3","4","5","6","7","8","9","10+"];
const COUNT_0_6  = ["0","1","2","3","4","5","6+"];
const COUNT_1_6  = ["1","2","3","4","5","6+"];
const COUNT_1_5  = ["1","2","3","4","5+"];
const FLOORS     = ["1","2","3","4","5+"];
const CREW       = ["1","2","3","4","5","6","7","8","9","10+"];

const VISIT_DURATIONS = [
  "0.5 hr","1 hr","1.5 hrs","2 hrs","2.5 hrs","3 hrs","4 hrs","5 hrs","6 hrs","8 hrs","Custom",
];

const COMMERCIAL_SUBTYPES = [
  "Office","Restaurant","Retail","Clinic","School","Warehouse Office","Mixed-Use","Other",
];
const INDUSTRIAL_SUBTYPES = [
  "Warehouse","Plant","Shop","Manufacturing","Distribution","Workshop","Other",
];
const HOME_TYPES = ["House","Apartment","Condo","Townhouse","Duplex","Basement Suite","Other"];
const BASEMENTS  = ["None","Finished","Unfinished","Walkout"];
const CONDITIONS = ["Light Cleaning","Moderate Cleaning","Heavy Cleaning","Deep Clean Needed"];

const SERVICE_TYPES = [
  "One-Time","Daily","Weekly","Bi-Weekly","Monthly","Custom",
];
const DAYS_PER_WEEK  = ["1","2","3","4","5","6","7"];
const VISITS_MONTHLY = ["1","2","3","4","5","6+"];
const BILLING_MODES = ["One-time","Per visit","Weekly","Bi-weekly","Monthly","Custom recurring"];
const QUOTE_PERIODS = ["1 week","2 weeks","4 weeks","1 month","3 months","6 months","12 months","Custom"];

function quotePeriodToWeeks(period: string): number | null {
  if (period === "1 week") return 1;
  if (period === "2 weeks") return 2;
  if (period === "4 weeks") return 4;
  if (period === "1 month") return 4;
  if (period === "3 months") return 13;
  if (period === "6 months") return 26;
  if (period === "12 months") return 52;
  return null;
}
const FIRST_CLEAN_TYPES = [
  "Standard","Heavy Initial Clean","Deep Clean","Move-In / Move-Out","Post-Construction Touch-Up","Other",
];

const COMMON_ADDONS = [
  "Inside Windows","Carpet Spot Cleaning","Floor Buffing","Disinfection",
  "Restocking","High-Touch Detailing","Power Washing","Strip & Wax Floors",
  "Post-Construction Cleanup","Odor Treatment",
];

const PRESET_TAXES: Record<string, string> = {
  "GST": "5",
  "PST": "7",
  "HST": "13",
  "QST": "9.975",
};

// ── Main QuoteBuilder ─────────────────────────────────────────────────────────
export function QuoteBuilder({ sessionId, quoteData, onSave }: {
  sessionId: string;
  quoteData: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
}) {
  const { toast } = useToast();

  // -- Form state ---------------------------------------------------------------
  const [propertyType, setPropertyType] = useState<PropertyType>(quoteData.propertyType || "");
  const [commercialSubtype, setCommercialSubtype] = useState(quoteData.commercialSubtype || "");
  const [industrialSubtype, setIndustrialSubtype] = useState(quoteData.industrialSubtype || "");

  // Client
  const [clientName, setClientName] = useState(quoteData.clientName || "");
  const [siteAddress, setSiteAddress] = useState(quoteData.siteAddress || "");
  const [squareFootage, setSquareFootage] = useState(quoteData.squareFootage || "");

  // Residential
  const [homeType, setHomeType] = useState(quoteData.homeType || "");
  const [bedrooms, setBedrooms] = useState(quoteData.bedrooms || "");
  const [bathrooms, setBathrooms] = useState(quoteData.bathrooms || "");
  const [halfBaths, setHalfBaths] = useState(quoteData.halfBaths || "");
  const [stories, setStories] = useState(quoteData.stories || "");
  const [basement, setBasement] = useState(quoteData.basement || "");
  const [kitchenCount, setKitchenCount] = useState(quoteData.kitchenCount || "");
  const [livingAreas, setLivingAreas] = useState(quoteData.livingAreas || "");
  const [conditionLevel, setConditionLevel] = useState(quoteData.conditionLevel || "");

  // Commercial / generic
  const [numOffices, setNumOffices]         = useState(quoteData.numOffices || "");
  const [numBoardrooms, setNumBoardrooms]   = useState(quoteData.numBoardrooms || "");
  const [numReception, setNumReception]     = useState(quoteData.numReception || "");
  const [numWashrooms, setNumWashrooms]     = useState(quoteData.numWashrooms || "");
  const [numKitchens, setNumKitchens]       = useState(quoteData.numKitchens || "");
  const [numHallways, setNumHallways]       = useState(quoteData.numHallways || "");
  const [numEntrances, setNumEntrances]     = useState(quoteData.numEntrances || "");
  const [numFloors, setNumFloors]           = useState(quoteData.numFloors || "");

  // Restaurant extras
  const [hasKitchen, setHasKitchen]         = useState(quoteData.hasKitchen || "");
  const [numDiningAreas, setNumDiningAreas] = useState(quoteData.numDiningAreas || "");
  const [greasLevel, setGreaseLevel]        = useState(quoteData.greaseLevel || "");

  // Retail extras
  const [hasSalesFloor, setHasSalesFloor]   = useState(quoteData.hasSalesFloor || "");
  const [hasStockRoom, setHasStockRoom]     = useState(quoteData.hasStockRoom || "");

  // Industrial
  const [numOfficeAreas, setNumOfficeAreas] = useState(quoteData.numOfficeAreas || "");
  const [hasLunchroom, setHasLunchroom]     = useState(quoteData.hasLunchroom || "");
  const [hasLockerRoom, setHasLockerRoom]   = useState(quoteData.hasLockerRoom || "");
  const [heavySoilLevel, setHeavySoilLevel] = useState(quoteData.heavySoilLevel || "");
  const [hasLoadingDock, setHasLoadingDock] = useState(quoteData.hasLoadingDock || "");

  // Tags
  const [specialSurfaceTags, setSpecialSurfaceTags] = useState<string[]>(parseTags(quoteData.specialSurfaceTags));
  const [otherAreaTags, setOtherAreaTags]           = useState<string[]>(parseTags(quoteData.otherAreaTags));
  const [addOnTags, setAddOnTags]                   = useState<string[]>(parseTags(quoteData.addOnTags));
  const [includedAreaTags, setIncludedAreaTags]     = useState<string[]>(parseTags(quoteData.includedAreaTags));

  // Service scope
  const [serviceType, setServiceType]       = useState(quoteData.serviceType || "");
  const [daysPerWeek, setDaysPerWeek]       = useState(quoteData.daysPerWeek || "");
  const [visitsPerMonth, setVisitsPerMonth] = useState(quoteData.visitsPerMonth || "");
  const [visitDuration, setVisitDuration]   = useState(quoteData.visitDuration || "");
  const [crewSizeEst, setCrewSizeEst]       = useState(quoteData.crewSizeEst || "");
  const [firstCleanType, setFirstCleanType] = useState(quoteData.firstCleanType || "");
  const [scopeSummary, setScopeSummary]     = useState(quoteData.scopeSummary || "");

  // Pricing schedule
  const [billingMode, setBillingMode]               = useState(quoteData.billingMode || "");
  const [serviceDaysPerWeek, setServiceDaysPerWeek] = useState(quoteData.serviceDaysPerWeek || "");
  const [quotePeriod, setQuotePeriod]               = useState(quoteData.quotePeriod || "");

  // Internal pricing (admin-only)
  const [laborHours, setLaborHours]         = useState(quoteData.laborHours || "");
  const [hourlyPay, setHourlyPay]           = useState(quoteData.hourlyPay || "");
  const [targetMargin, setTargetMargin]     = useState(quoteData.targetMargin || "50");
  const [travelAdjust, setTravelAdjust]     = useState(quoteData.travelAdjust || "");
  const [suppliesAdjust, setSuppliesAdjust] = useState(quoteData.suppliesAdjust || "");
  const [difficultyMult, setDifficultyMult] = useState(quoteData.difficultyMult || "1.0");
  const [minimumCharge, setMinimumCharge]   = useState(quoteData.minimumCharge || "");

  // Client-facing pricing outputs (subtotal / base amount)
  const [baseAmount, setBaseAmount]         = useState(quoteData.baseAmount || "");
  const [pricingNotes, setPricingNotes]     = useState(quoteData.pricingNotes || "");

  // Legacy fields kept for backward compat with public page
  const [oneTimeAmount, setOneTimeAmount]   = useState(quoteData.oneTimeAmount || "");
  const [weeklyAmount, setWeeklyAmount]     = useState(quoteData.weeklyAmount || "");
  const [biweeklyAmount, setBiweeklyAmount] = useState(quoteData.biweeklyAmount || "");
  const [monthlyAmount, setMonthlyAmount]   = useState(quoteData.monthlyAmount || "");

  // Tax state
  const [taxEnabled, setTaxEnabled] = useState<boolean>(quoteData.taxEnabled === true || quoteData.taxEnabled === "true");
  const [taxes, setTaxes] = useState<TaxLine[]>(parseTaxes(quoteData.taxes));

  // Add-on pricing lines — initialized from saved data, then synced to addOnTags
  const [addonPricingLines, setAddonPricingLines] = useState<AddOnPricingLine[]>(() => {
    const saved = parseAddonPricingLines(quoteData.addonPricingLines);
    const tags = parseTags(quoteData.addOnTags);
    return syncAddonPricingLines(tags, saved);
  });

  // Display billing period — controls what the public quote shows
  const [displayBillingPeriod, setDisplayBillingPeriod] = useState(quoteData.displayBillingPeriod || "");
  const [customDisplayWeeks, setCustomDisplayWeeks]     = useState(quoteData.customDisplayWeeks || "");
  const [customDisplayMonths, setCustomDisplayMonths]   = useState(quoteData.customDisplayMonths || "");
  // Manually-overridden display amount (set when admin edits the computed field)
  const [displayAmountOverride, setDisplayAmountOverride] = useState(quoteData.displayAmount || "");

  // AI suggestion results
  const [suggestion, setSuggestion] = useState<Record<string, any> | null>(
    quoteData.pricingExplanation ? quoteData : null
  );
  const [suggestError, setSuggestError] = useState<string>("");

  // Section open state
  const [openSection, setOpenSection] = useState<string[]>(["details", "scope", "pricing_output"]);
  const toggle = (s: string) => setOpenSection(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s]);
  const isOpen = (s: string) => openSection.includes(s);

  const quoteStatus = quoteData.quoteStatus;
  const isRes = propertyType === "residential";
  const isCom = propertyType === "commercial";
  const isInd = propertyType === "industrial";
  const comSub = commercialSubtype.toLowerCase();

  // -- Tax helpers --------------------------------------------------------------
  const addTax = (name = "", rate = "") => setTaxes(t => [...t, { name, rate }]);
  const removeTax = (i: number) => setTaxes(t => t.filter((_, j) => j !== i));
  const updateTax = (i: number, field: "name" | "rate", val: string) =>
    setTaxes(t => t.map((x, j) => j === i ? { ...x, [field]: val } : x));

  // -- Add-on pricing line helpers ----------------------------------------------
  const updateAddonLine = (i: number, field: keyof AddOnPricingLine, val: string | boolean) =>
    setAddonPricingLines(t => t.map((x, j) => j === i ? { ...x, [field]: val } : x));
  const toggleAddonIncluded = (i: number) =>
    setAddonPricingLines(t => t.map((x, j) => j === i ? { ...x, included: !x.included } : x));

  // Combined setter — keeps addonPricingLines in sync whenever add-ons change
  const handleAddOnTagsChange = (tags: string[]) => {
    setAddOnTags(tags);
    setAddonPricingLines(prev => syncAddonPricingLines(tags, prev));
  };

  // -- Pricing schedule computed values ----------------------------------------
  const quotePeriodWeeks = quotePeriodToWeeks(quotePeriod);
  const estimatedVisits: number | null =
    billingMode && billingMode !== "One-time" && billingMode !== "Per visit" &&
    serviceDaysPerWeek && quotePeriodWeeks !== null
      ? parseInt(serviceDaysPerWeek) * quotePeriodWeeks
      : null;

  // -- Live price calculation ---------------------------------------------------
  const getPrimaryAmount = (): number | null => {
    const raw = baseAmount || oneTimeAmount || weeklyAmount || biweeklyAmount || monthlyAmount;
    return raw ? parseAmount(raw) : null;
  };
  const baseAmt = getPrimaryAmount();
  const addonTotal = addonPricingLines
    .filter(l => l.included && l.amount)
    .reduce((s, l) => s + (parseAmount(l.amount) || 0), 0);
  const hasBase = baseAmt !== null;
  const hasAddons = addonTotal > 0;
  const subtotal = hasBase || hasAddons ? (baseAmt || 0) + addonTotal : null;
  const taxLines: Array<{ name: string; rate: number; amount: number }> =
    taxEnabled && subtotal !== null
      ? taxes
          .filter(t => t.name && t.rate)
          .map(t => ({ name: t.name, rate: parseFloat(t.rate) || 0, amount: (subtotal * (parseFloat(t.rate) || 0)) / 100 }))
      : [];
  const taxTotal = taxLines.reduce((s, t) => s + t.amount, 0);
  const grandTotal = subtotal !== null ? subtotal + taxTotal : null;

  // ── Display period computed values ──────────────────────────────────────────
  // Derive per-visit amount from baseAmt + billingMode + serviceDaysPerWeek
  const dpwNum = parseInt(serviceDaysPerWeek) || parseInt(daysPerWeek) || 5;
  const perVisitAmt: number | null = (() => {
    if (!baseAmt) return null;
    const bm = billingMode || serviceType || "";
    if (bm.toLowerCase().includes("per visit") || bm.toLowerCase().includes("one")) return baseAmt;
    if (bm.toLowerCase().includes("bi")) return baseAmt / (dpwNum * 2);
    if (bm.toLowerCase().includes("week") && !bm.toLowerCase().includes("month")) return baseAmt / dpwNum;
    if (bm.toLowerCase().includes("month")) return baseAmt / (dpwNum * 4);
    return baseAmt; // fallback: treat as per-visit
  })();

  // Computed display recurring service amount (from per-visit × display period)
  const isOneTimeBilling = (billingMode || "").toLowerCase().includes("one") || (serviceType || "").toLowerCase().includes("one");
  const computedDisplayBase: number | null =
    !isOneTimeBilling && displayBillingPeriod && displayBillingPeriod !== "" && perVisitAmt !== null
      ? computeDisplayAmountFromPerVisit(perVisitAmt, dpwNum, displayBillingPeriod, customDisplayWeeks, customDisplayMonths)
      : null;

  // Compute scaled addon totals for display period
  const displayAddonLines = displayBillingPeriod
    ? addonPricingLines.filter(l => l.included && l.amount).map(l => {
        const raw = parseAmount(l.amount) || 0;
        const scaledAmt = scaleAddonForDisplay(raw, l.pricingType, displayBillingPeriod, dpwNum, customDisplayWeeks, customDisplayMonths);
        return { ...l, scaledAmount: scaledAmt };
      })
    : [];
  const displayOneTimeAddons = displayAddonLines.filter(l => !l.pricingType || l.pricingType === "One-time");
  const displayRecurringAddons = displayAddonLines.filter(l => l.pricingType && l.pricingType !== "One-time");

  // Total for display period
  const displayBaseAmt = displayAmountOverride ? (parseAmount(displayAmountOverride) ?? computedDisplayBase) : computedDisplayBase;
  const displayAddonTotal = displayAddonLines.reduce((s, l) => s + l.scaledAmount, 0);
  const displaySubtotal = displayBaseAmt !== null ? displayBaseAmt + displayAddonTotal : null;
  const displayTaxLines: Array<{ name: string; rate: number; amount: number }> =
    taxEnabled && displaySubtotal !== null
      ? taxes.filter(t => t.name && t.rate)
             .map(t => ({ name: t.name, rate: parseFloat(t.rate) || 0, amount: (displaySubtotal * (parseFloat(t.rate) || 0)) / 100 }))
      : [];
  const displayTaxTotal = displayTaxLines.reduce((s, t) => s + t.amount, 0);
  const displayGrandTotal = displaySubtotal !== null ? displaySubtotal + displayTaxTotal : null;
  const displayPeriodLabel = displayBillingPeriod ? getDisplayPeriodLabel(displayBillingPeriod, customDisplayWeeks, customDisplayMonths) : "";

  // -- Compile current quoteData object ----------------------------------------
  const buildQuoteData = () => ({
    ...quoteData,
    propertyType, commercialSubtype, industrialSubtype,
    clientName, siteAddress, squareFootage,
    // Residential
    homeType, bedrooms, bathrooms, halfBaths, stories, basement, kitchenCount, livingAreas, conditionLevel,
    // Commercial
    numOffices, numBoardrooms, numReception, numWashrooms, numKitchens, numHallways, numEntrances, numFloors,
    hasKitchen, numDiningAreas, greaseLevel: greasLevel, hasSalesFloor, hasStockRoom,
    // Industrial
    numOfficeAreas, hasLunchroom, hasLockerRoom, heavySoilLevel, hasLoadingDock,
    // Tags
    specialSurfaceTags: stringifyTags(specialSurfaceTags),
    otherAreaTags: stringifyTags(otherAreaTags),
    addOnTags: stringifyTags(addOnTags),
    includedAreaTags: stringifyTags(includedAreaTags),
    // Scope
    serviceType, daysPerWeek, visitsPerMonth, visitDuration, crewSizeEst, firstCleanType, scopeSummary,
    // Pricing schedule
    billingMode, serviceDaysPerWeek, quotePeriod,
    estimatedVisits: estimatedVisits !== null ? String(estimatedVisits) : "",
    // Internal
    laborHours, hourlyPay, targetMargin, travelAdjust, suppliesAdjust, difficultyMult, minimumCharge,
    // Pricing outputs
    baseAmount,
    oneTimeAmount, weeklyAmount, biweeklyAmount, monthlyAmount,
    pricingNotes,
    // Add-on pricing lines
    addonPricingLines: JSON.stringify(addonPricingLines),
    // Tax
    taxEnabled,
    taxes: JSON.stringify(taxes),
    // Computed totals (for public page display)
    taxLines: JSON.stringify(taxLines),
    grandTotal: grandTotal !== null ? fmtDollar(grandTotal) : "",
    // Base + addon breakdown for public page
    baseSubtotal: baseAmt !== null ? fmtDollar(baseAmt) : "",
    addonSubtotal: addonTotal > 0 ? fmtDollar(addonTotal) : "",
    combinedSubtotal: subtotal !== null ? fmtDollar(subtotal) : "",
    // Display billing period (controls what public quote shows)
    displayBillingPeriod,
    displayPeriodLabel,
    customDisplayWeeks,
    customDisplayMonths,
    displayAmount: displayAmountOverride || (computedDisplayBase !== null ? fmtDollar(computedDisplayBase) : ""),
    displaySubtotal: displaySubtotal !== null ? fmtDollar(displaySubtotal) : "",
    displayGrandTotal: displayGrandTotal !== null ? fmtDollar(displayGrandTotal) : "",
    displayTaxLines: JSON.stringify(displayTaxLines),
    displayAddonLines: JSON.stringify(displayAddonLines.map(l => ({
      name: l.name, pricingType: l.pricingType, amount: fmtDollar(l.scaledAmount), included: l.included,
      isRecurring: l.pricingType !== "One-time",
    }))),
  });

  const handleSave = () => onSave(buildQuoteData());

  // -- AI Scope Summary --------------------------------------------------------
  const scopeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/field-notes/sessions/${sessionId}/generate-scope`, {
      propertyType, commercialSubtype, numOffices, numWashrooms, numKitchens,
      numHallways, numEntrances, numFloors, squareFootage, serviceType,
      includedAreas: includedAreaTags.join(", "),
    }).then(r => r.json()),
    onSuccess: (data) => {
      setScopeSummary(data.scopeSummary || "");
      toast({ title: "Scope summary generated" });
    },
    onError: () => toast({ title: "Failed to generate scope", variant: "destructive" }),
  });

  // -- AI Price Suggestion -----------------------------------------------------
  const priceMutation = useMutation({
    mutationFn: () => {
      setSuggestError("");
      return apiRequest("POST", `/api/field-notes/sessions/${sessionId}/suggest-price`, {
        propertyType, commercialSubtype, industrialSubtype, squareFootage,
        numOffices, numWashrooms, numKitchens, numHallways, numEntrances, numFloors,
        numDiningAreas, numBoardrooms, numReception, hasKitchen, greaseLevel: greasLevel,
        bedrooms, bathrooms, stories, conditionLevel, homeType,
        numOfficeAreas, hasLunchroom, hasLockerRoom, heavySoilLevel,
        serviceType, daysPerWeek, visitsPerMonth, visitDuration, crewSizeEst,
        firstCleanType, addOnTags: addOnTags.join(", "),
        specialSurfaces: specialSurfaceTags.join(", "),
        otherAreas: otherAreaTags.join(", "),
        laborHours, hourlyPay, targetMargin, travelAdjust, suppliesAdjust,
        difficultyMult, minimumCharge,
        // Pricing schedule
        billingMode, serviceDaysPerWeek, quotePeriod,
        estimatedVisits: estimatedVisits !== null ? String(estimatedVisits) : "",
        // Add-on list for pricing suggestions
        addOnList: addonPricingLines.map(l => l.name).join(", "),
      }).then(r => r.json());
    },
    onSuccess: (data) => {
      setSuggestion(data);
      setSuggestError("");
      // Autofill — billingMode takes priority over serviceType for determining which field to fill
      const bm = (billingMode || serviceType || "").toLowerCase();
      if (bm.includes("one") || bm.includes("time") || (!billingMode && !serviceType)) {
        if (data.suggestedOneTime) { setOneTimeAmount(data.suggestedOneTime); setBaseAmount(data.suggestedOneTime); }
      } else if (bm.includes("per visit")) {
        if (data.suggestedPerVisit || data.suggestedOneTime) {
          const v = data.suggestedPerVisit || data.suggestedOneTime;
          setBaseAmount(v); setOneTimeAmount(v);
        }
      } else if (bm.includes("bi")) {
        if (data.suggestedBiweekly) { setBiweeklyAmount(data.suggestedBiweekly); setBaseAmount(data.suggestedBiweekly); }
      } else if (bm.includes("week")) {
        if (data.suggestedWeekly) { setWeeklyAmount(data.suggestedWeekly); setBaseAmount(data.suggestedWeekly); }
      } else if (bm.includes("month")) {
        if (data.suggestedMonthly) { setMonthlyAmount(data.suggestedMonthly); setBaseAmount(data.suggestedMonthly); }
      } else {
        // Fallback: fill the primary amount from whichever the AI returned
        const fallback = data.suggestedMonthly || data.suggestedBiweekly || data.suggestedWeekly || data.suggestedOneTime;
        if (fallback) setBaseAmount(fallback);
      }
      if (data.pricingNotes && !pricingNotes) setPricingNotes(data.pricingNotes);
      if (data.scopeSummary && !scopeSummary) setScopeSummary(data.scopeSummary);
      // Autofill add-on amounts from AI suggestions
      if (Array.isArray(data.addOnSuggestions) && data.addOnSuggestions.length > 0) {
        setAddonPricingLines(prev => prev.map(line => {
          const match = data.addOnSuggestions.find(
            (s: any) => s.name?.toLowerCase() === line.name.toLowerCase()
          );
          if (match && match.amount && !line.amount) {
            return { ...line, amount: match.amount, pricingType: match.pricingType || line.pricingType };
          }
          return line;
        }));
        if (!isOpen("addon_pricing")) setOpenSection(v => [...v, "addon_pricing"]);
      }
      if (!isOpen("pricing_output")) setOpenSection(v => [...v, "pricing_output"]);
      toast({ title: "Price suggestion applied", description: "Review and edit below, then save." });
    },
    onError: (err: any) => {
      let msg = err?.message || "Failed to generate suggestion";
      // Parse raw JSON error bodies like {"message":"..."} that apiRequest can surface
      try { const parsed = JSON.parse(msg); if (parsed?.message) msg = parsed.message; } catch {}
      // Strip leading status code prefix e.g. "500: ..."
      msg = msg.replace(/^\d+:\s*/, "").trim();
      const displayMsg = msg.length > 0 ? msg : "Could not generate pricing suggestion. Please try again.";
      setSuggestError(displayMsg);
      toast({ title: "Could not generate suggestion", description: displayMsg.slice(0, 120), variant: "destructive" });
    },
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mt-10 pt-6 border-t space-y-5">

      {/* Response status banners */}
      {quoteStatus === "accepted" && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl dark:bg-green-950/20 dark:border-green-800 dark:text-green-400" data-testid="banner-admin-quote-accepted">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Client accepted this quote</p>
            {quoteData.quoteAcceptedAt && <p className="text-[11px] text-green-600 dark:text-green-500">Accepted {format(parseISO(quoteData.quoteAcceptedAt), "MMM d, yyyy 'at' h:mm a")}</p>}
          </div>
        </div>
      )}
      {quoteStatus === "declined" && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl dark:bg-red-950/20 dark:border-red-800 dark:text-red-400" data-testid="banner-admin-quote-declined">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">Client declined this quote</p>
            {quoteData.quoteDeclineReason && <p className="text-[11px] text-red-600 dark:text-red-500 mt-0.5">Reason: {quoteData.quoteDeclineReason}</p>}
            {quoteData.quoteDeclinedAt && <p className="text-[11px] text-red-500 mt-0.5">{format(parseISO(quoteData.quoteDeclinedAt), "MMM d, yyyy 'at' h:mm a")}</p>}
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Quote Builder</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSave} data-testid="button-save-quote">
          <Check className="w-3 h-3" /> Save
        </Button>
      </div>

      {/* ── S1: Client & Property Type ── */}
      <Section title="Client & Property Type" icon={<Building className="w-3.5 h-3.5" />} open={isOpen("type")} onToggle={() => toggle("type")}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <TextField label="Client name" value={clientName} onChange={setClientName} placeholder="e.g. Acme Corp" testId="input-quote-clientName" />
          <TextField label="Site address" value={siteAddress} onChange={setSiteAddress} placeholder="123 Main Street" testId="input-quote-siteAddress" />
        </div>

        {/* Property type cards */}
        <p className="text-[11px] text-muted-foreground mb-2 font-medium">Property type <span className="text-red-500">*</span></p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {([
            { type: "residential" as PropertyType, label: "Residential", icon: <Home className="w-4 h-4" /> },
            { type: "commercial" as PropertyType,  label: "Commercial",  icon: <Briefcase className="w-4 h-4" /> },
            { type: "industrial" as PropertyType,  label: "Industrial",  icon: <Factory className="w-4 h-4" /> },
          ]).map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              data-testid={`button-property-type-${type}`}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all text-xs font-medium",
                propertyType === type
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-input bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
              onClick={() => {
                setPropertyType(type);
                if (!isOpen("type")) toggle("type");
                if (!isOpen("details")) setOpenSection(v => [...v, "details"]);
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Subtypes */}
        {isCom && (
          <DropField
            label="Commercial subtype"
            value={commercialSubtype}
            onChange={setCommercialSubtype}
            options={COMMERCIAL_SUBTYPES}
            testId="select-commercial-subtype"
          />
        )}
        {isInd && (
          <DropField
            label="Industrial subtype"
            value={industrialSubtype}
            onChange={setIndustrialSubtype}
            options={INDUSTRIAL_SUBTYPES}
            testId="select-industrial-subtype"
          />
        )}
      </Section>

      {/* ── S2: Property Details ── */}
      {propertyType && (
        <Section title="Property Details" icon={<LayoutList className="w-3.5 h-3.5" />} open={isOpen("details")} onToggle={() => toggle("details")}>

          {/* Square footage — always available */}
          <TextField label="Square footage (optional)" value={squareFootage} onChange={setSquareFootage} placeholder="e.g. 2,400 sq ft" testId="input-quote-squareFootage" wide />

          {/* ── Residential ── */}
          {isRes && (
            <div className="grid grid-cols-2 gap-3">
              <DropField label="Home type" value={homeType} onChange={setHomeType} options={HOME_TYPES} testId="select-homeType" />
              <DropField label="Condition" value={conditionLevel} onChange={setConditionLevel} options={CONDITIONS} testId="select-conditionLevel" />
              <DropField label="Bedrooms" value={bedrooms} onChange={setBedrooms} options={COUNT_0_6} testId="select-bedrooms" />
              <DropField label="Bathrooms" value={bathrooms} onChange={setBathrooms} options={COUNT_1_5} testId="select-bathrooms" />
              <DropField label="Half bathrooms" value={halfBaths} onChange={setHalfBaths} options={COUNT_0_6} testId="select-halfBaths" />
              <DropField label="Stories" value={stories} onChange={setStories} options={FLOORS} testId="select-stories" />
              <DropField label="Basement" value={basement} onChange={setBasement} options={BASEMENTS} testId="select-basement" />
              <DropField label="Kitchens" value={kitchenCount} onChange={setKitchenCount} options={COUNT_1_5} testId="select-kitchenCount" />
              <DropField label="Living areas" value={livingAreas} onChange={setLivingAreas} options={COUNT_1_5} testId="select-livingAreas" />
            </div>
          )}

          {/* ── Commercial general ── */}
          {isCom && (
            <div className="grid grid-cols-2 gap-3">
              <DropField label="Floors" value={numFloors} onChange={setNumFloors} options={FLOORS} testId="select-numFloors" />
              <DropField label="Washrooms" value={numWashrooms} onChange={setNumWashrooms} options={COUNT_0_10} testId="select-numWashrooms" />
              <DropField label="Entrances" value={numEntrances} onChange={setNumEntrances} options={COUNT_0_10} testId="select-numEntrances" />
              <DropField label="Hallways" value={numHallways} onChange={setNumHallways} options={COUNT_0_10} testId="select-numHallways" />

              {/* Office subtype */}
              {(!commercialSubtype || comSub === "office" || comSub === "mixed-use") && (
                <>
                  <DropField label="Offices" value={numOffices} onChange={setNumOffices} options={COUNT_0_10} testId="select-numOffices" />
                  <DropField label="Boardrooms" value={numBoardrooms} onChange={setNumBoardrooms} options={COUNT_0_6} testId="select-numBoardrooms" />
                  <DropField label="Reception areas" value={numReception} onChange={setNumReception} options={COUNT_0_6} testId="select-numReception" />
                  <DropField label="Break rooms / kitchens" value={numKitchens} onChange={setNumKitchens} options={COUNT_0_6} testId="select-numKitchens" />
                </>
              )}

              {/* Restaurant subtype */}
              {comSub === "restaurant" && (
                <>
                  <DropField label="Kitchen present" value={hasKitchen} onChange={setHasKitchen} options={["Yes","No"]} testId="select-hasKitchen" />
                  <DropField label="Dining areas" value={numDiningAreas} onChange={setNumDiningAreas} options={COUNT_0_10} testId="select-numDiningAreas" />
                  <DropField label="Kitchen / grease condition" value={greasLevel} onChange={setGreaseLevel} options={["Light","Moderate","Heavy","Very Heavy"]} testId="select-greaseLevel" />
                </>
              )}

              {/* Retail subtype */}
              {comSub === "retail" && (
                <>
                  <DropField label="Has sales floor" value={hasSalesFloor} onChange={setHasSalesFloor} options={["Yes","No"]} testId="select-hasSalesFloor" />
                  <DropField label="Has stock room" value={hasStockRoom} onChange={setHasStockRoom} options={["Yes","No"]} testId="select-hasStockRoom" />
                </>
              )}

              {/* Clinic / School / Other */}
              {(comSub === "clinic" || comSub === "school" || comSub === "warehouse office" || comSub === "other" || comSub === "") && (
                <>
                  <DropField label="Offices" value={numOffices} onChange={setNumOffices} options={COUNT_0_10} testId="select-numOffices-alt" />
                  <DropField label="Break rooms / kitchens" value={numKitchens} onChange={setNumKitchens} options={COUNT_0_6} testId="select-numKitchens-alt" />
                </>
              )}
            </div>
          )}

          {/* ── Industrial ── */}
          {isInd && (
            <div className="grid grid-cols-2 gap-3">
              <DropField label="Floors" value={numFloors} onChange={setNumFloors} options={FLOORS} testId="select-numFloors-ind" />
              <DropField label="Washrooms" value={numWashrooms} onChange={setNumWashrooms} options={COUNT_0_10} testId="select-numWashrooms-ind" />
              <DropField label="Office areas" value={numOfficeAreas} onChange={setNumOfficeAreas} options={COUNT_0_6} testId="select-numOfficeAreas" />
              <DropField label="Heavy soil level" value={heavySoilLevel} onChange={setHeavySoilLevel} options={["None","Light","Moderate","Heavy","Very Heavy"]} testId="select-heavySoilLevel" />
              <DropField label="Lunchroom / break room" value={hasLunchroom} onChange={setHasLunchroom} options={["Yes","No"]} testId="select-hasLunchroom" />
              <DropField label="Locker room" value={hasLockerRoom} onChange={setHasLockerRoom} options={["Yes","No"]} testId="select-hasLockerRoom" />
              <DropField label="Loading dock" value={hasLoadingDock} onChange={setHasLoadingDock} options={["Yes","No"]} testId="select-hasLoadingDock" />
            </div>
          )}

          {/* Special surfaces & other areas — all types */}
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 block">Special surfaces</Label>
              <TagInput tags={specialSurfaceTags} onChange={setSpecialSurfaceTags} placeholder="e.g. VCT tile, carpet, glass…" testId="input-special-surfaces" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 block">Other areas</Label>
              <TagInput tags={otherAreaTags} onChange={setOtherAreaTags} placeholder="e.g. lobby, server room…" testId="input-other-areas" />
            </div>
          </div>
        </Section>
      )}

      {/* ── S3: Service Scope ── */}
      <Section title="Service Scope" icon={<FileCheck className="w-3.5 h-3.5" />} open={isOpen("scope")} onToggle={() => toggle("scope")}>
        <div className="grid grid-cols-2 gap-3">
          <DropField label="Service type" value={serviceType} onChange={setServiceType} options={SERVICE_TYPES} testId="select-serviceType" wide />
          {serviceType === "Weekly" && (
            <DropField label="Days per week" value={daysPerWeek} onChange={setDaysPerWeek} options={DAYS_PER_WEEK} testId="select-daysPerWeek" />
          )}
          {(serviceType === "Monthly" || serviceType === "Custom") && (
            <DropField label="Visits per month" value={visitsPerMonth} onChange={setVisitsPerMonth} options={VISITS_MONTHLY} testId="select-visitsPerMonth" />
          )}
          {serviceType === "Bi-Weekly" && (
            <DropField label="Visits per month" value={visitsPerMonth} onChange={setVisitsPerMonth} options={VISITS_MONTHLY} testId="select-visitsPerMonth-bw" />
          )}
          <DropField label="Est. visit duration" value={visitDuration} onChange={setVisitDuration} options={VISIT_DURATIONS} testId="select-visitDuration" />
          <DropField label="Est. crew size" value={crewSizeEst} onChange={setCrewSizeEst} options={CREW} testId="select-crewSizeEst" />
          <DropField label="First clean type" value={firstCleanType} onChange={setFirstCleanType} options={FIRST_CLEAN_TYPES} testId="select-firstCleanType" wide />
        </div>

        {/* Included areas */}
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1.5 block">Included areas</Label>
            <TagInput tags={includedAreaTags} onChange={setIncludedAreaTags} placeholder="e.g. All offices, Washrooms…" testId="input-included-areas" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1.5 block">Add-ons</Label>
            <TagInput tags={addOnTags} onChange={handleAddOnTagsChange} placeholder="e.g. Floor buffing…" testId="input-add-ons" />
            {/* Common add-on chips */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {COMMON_ADDONS.filter(a => !addOnTags.includes(a)).map(a => (
                <button
                  key={a}
                  type="button"
                  className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  onClick={() => handleAddOnTagsChange([...addOnTags, a])}
                >
                  + {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope summary */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[11px] text-muted-foreground">Scope summary</Label>
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
              onClick={() => scopeMutation.mutate()}
              disabled={scopeMutation.isPending}
              data-testid="button-ai-scope-summary"
            >
              {scopeMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wand2 className="w-2.5 h-2.5" />}
              {scopeMutation.isPending ? "Generating…" : "AI Generate"}
            </button>
          </div>
          <Textarea
            value={scopeSummary}
            onChange={e => setScopeSummary(e.target.value)}
            rows={3}
            placeholder="Describe what the service includes…"
            className="text-xs resize-none"
            data-testid="textarea-quote-scopeSummary"
          />
        </div>
      </Section>

      {/* ── S4a: Add-on Pricing ── */}
      {addonPricingLines.length > 0 && (
        <Section
          title="Add-on Pricing"
          icon={<LayoutList className="w-3.5 h-3.5" />}
          open={isOpen("addon_pricing")}
          onToggle={() => toggle("addon_pricing")}
        >
          <p className="text-[11px] text-muted-foreground">Each selected add-on appears as a separate line item on the quote. Set its pricing type and amount independently.</p>
          <div className="space-y-2">
            {addonPricingLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2.5" data-testid={`row-addon-pricing-${i}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">{line.name}</p>
                </div>
                <Select value={line.pricingType || "One-time"} onValueChange={v => updateAddonLine(i, "pricingType", v)}>
                  <SelectTrigger className="h-6 text-[10px] w-24 shrink-0" data-testid={`select-addon-pricingType-${i}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDON_PRICING_TYPES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={line.amount}
                  onChange={e => updateAddonLine(i, "amount", e.target.value)}
                  placeholder="e.g. $500"
                  className="h-6 text-[10px] w-24 shrink-0"
                  data-testid={`input-addon-amount-${i}`}
                />
                <button
                  type="button"
                  onClick={() => toggleAddonIncluded(i)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors shrink-0",
                    line.included
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "text-muted-foreground border-border"
                  )}
                  data-testid={`button-addon-included-${i}`}
                >
                  {line.included ? "Included" : "Excluded"}
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── S4b: Internal Pricing (admin-only) ── */}
      <Section
        title="Internal Pricing"
        icon={<Lock className="w-3.5 h-3.5" />}
        open={isOpen("internal")}
        onToggle={() => toggle("internal")}
        badge="Not shown to client"
      >
        <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          These inputs help calculate suggested pricing. They are never included on the public quote.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Est. labor hours" value={laborHours} onChange={setLaborHours} placeholder="e.g. 4" testId="input-laborHours" />
          <TextField label="Hourly pay per worker ($)" value={hourlyPay} onChange={setHourlyPay} placeholder="e.g. 22" testId="input-hourlyPay" />
          <TextField label="Target margin (%)" value={targetMargin} onChange={setTargetMargin} placeholder="e.g. 50" testId="input-targetMargin" />
          <TextField label="Minimum charge ($)" value={minimumCharge} onChange={setMinimumCharge} placeholder="e.g. 150" testId="input-minimumCharge" />
          <TextField label="Travel adjustment ($)" value={travelAdjust} onChange={setTravelAdjust} placeholder="e.g. 25" testId="input-travelAdjust" />
          <TextField label="Supplies adjustment ($)" value={suppliesAdjust} onChange={setSuppliesAdjust} placeholder="e.g. 30" testId="input-suppliesAdjust" />
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground mb-1 block">Difficulty multiplier</Label>
            <Select value={difficultyMult || "1.0"} onValueChange={setDifficultyMult}>
              <SelectTrigger className="h-7 text-xs" data-testid="select-difficultyMult">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["0.8","0.9","1.0","1.1","1.2","1.3","1.4","1.5","1.75","2.0"].map(v => (
                  <SelectItem key={v} value={v}>{v}× {v === "1.0" ? "(Standard)" : v < "1.0" ? "(Easy)" : "(Hard)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ── Pricing Schedule ── */}
      <div className="rounded-xl border bg-muted/20 px-4 py-3 space-y-3" data-testid="section-pricing-schedule">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Pricing Schedule</span>
          <span className="text-[10px] text-muted-foreground ml-auto">Guides the pricing suggestion</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground mb-1 block">Billing mode</Label>
            <Select value={billingMode || "none"} onValueChange={v => setBillingMode(v === "none" ? "" : v)}>
              <SelectTrigger className="h-7 text-xs" data-testid="select-billingMode">
                <SelectValue placeholder="Select billing mode…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {BILLING_MODES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {billingMode && billingMode !== "One-time" && billingMode !== "Per visit" && (
            <>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Service days / week</Label>
                <Select value={serviceDaysPerWeek || "none"} onValueChange={v => setServiceDaysPerWeek(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs" data-testid="select-serviceDaysPerWeek">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {["1","2","3","4","5","6","7"].map(o => (
                      <SelectItem key={o} value={o}>{o} day{o !== "1" ? "s" : ""}/week</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Quote period</Label>
                <Select value={quotePeriod || "none"} onValueChange={v => setQuotePeriod(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs" data-testid="select-quotePeriod">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {QUOTE_PERIODS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        {estimatedVisits !== null && (
          <div className="text-[11px] text-muted-foreground bg-background rounded-lg border px-3 py-2" data-testid="text-estimated-visits">
            <span className="font-medium text-foreground">{estimatedVisits} estimated visits</span>
            {" "}in period — {serviceDaysPerWeek} days/week × {quotePeriodWeeks} week{quotePeriodWeeks !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Suggest Price button (always visible once propertyType is set) ── */}
      <div className="space-y-2">
        <Button
          className="w-full gap-2"
          onClick={() => priceMutation.mutate()}
          disabled={priceMutation.isPending || !propertyType}
          data-testid="button-suggest-price"
        >
          {priceMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
            : <><Sparkles className="w-4 h-4" /> Suggest Price</>
          }
        </Button>
        {!propertyType && (
          <p className="text-[11px] text-muted-foreground text-center">Select a property type above to enable price suggestion.</p>
        )}
        {suggestError && (
          <p className="text-[11px] text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" data-testid="text-suggest-error">
            {suggestError.replace(/^\d+:\s*/, "").slice(0, 200)}
          </p>
        )}
      </div>

      {/* ── AI Suggestion Result ── */}
      {suggestion?.pricingExplanation && (
        <div className="rounded-xl border border-primary/20 bg-primary/3 p-4 space-y-3" data-testid="section-ai-suggestion">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold text-primary uppercase tracking-wide">AI Pricing Suggestion</p>
            {suggestion.pricingConfidence && (
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
                Confidence: {suggestion.pricingConfidence}
              </span>
            )}
          </div>
          {/* Billing context row */}
          {(billingMode || estimatedVisits !== null) && (
            <div className="flex flex-wrap gap-2">
              {billingMode && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {billingMode}
                </span>
              )}
              {serviceDaysPerWeek && billingMode !== "One-time" && billingMode !== "Per visit" && (
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {serviceDaysPerWeek} days/week
                </span>
              )}
              {quotePeriod && billingMode !== "One-time" && billingMode !== "Per visit" && (
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {quotePeriod}
                </span>
              )}
              {estimatedVisits !== null && (
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  ~{estimatedVisits} visits
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-foreground/80 leading-relaxed">{suggestion.pricingExplanation}</p>
          <div className="grid grid-cols-2 gap-2">
            {suggestion.suggestedPerVisit && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Per visit</p>
                <p className="text-sm font-bold">{suggestion.suggestedPerVisit}</p>
              </div>
            )}
            {suggestion.suggestedOneTime && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">One-time</p>
                <p className="text-sm font-bold">{suggestion.suggestedOneTime}</p>
              </div>
            )}
            {suggestion.suggestedWeekly && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Weekly</p>
                <p className="text-sm font-bold">{suggestion.suggestedWeekly}</p>
              </div>
            )}
            {suggestion.suggestedBiweekly && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Bi-weekly</p>
                <p className="text-sm font-bold">{suggestion.suggestedBiweekly}</p>
              </div>
            )}
            {suggestion.suggestedMonthly && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Monthly</p>
                <p className="text-sm font-bold">{suggestion.suggestedMonthly}</p>
              </div>
            )}
            {suggestion.suggestedSubtotal && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Period subtotal</p>
                <p className="text-sm font-bold">{suggestion.suggestedSubtotal}</p>
              </div>
            )}
            {suggestion.suggestedLaborHours && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Est. labor hours</p>
                <p className="text-sm font-bold">{suggestion.suggestedLaborHours}</p>
              </div>
            )}
            {suggestion.suggestedCrew && (
              <div className="bg-background rounded-lg border px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Crew size</p>
                <p className="text-sm font-bold">{suggestion.suggestedCrew}</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground italic">Prices applied to Quote Output below. Edit to finalize, then save.</p>
        </div>
      )}

      {/* ── S5: Quote Output (Client-Facing) ── */}
      <Section title="Quote Output" icon={<Receipt className="w-3.5 h-3.5" />} open={isOpen("pricing_output")} onToggle={() => toggle("pricing_output")}>
        <p className="text-[11px] text-muted-foreground">These amounts appear on the public quote. Edit to finalize before sharing.</p>

        {/* Base amount */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground block">
            {(billingMode === "One-time" || serviceType === "One-Time") ? "One-time amount" :
             (billingMode === "Per visit") ? "Per-visit amount" :
             (billingMode === "Weekly" || serviceType === "Weekly") ? "Weekly amount" :
             (billingMode === "Bi-weekly" || serviceType === "Bi-Weekly") ? "Bi-weekly amount" :
             (billingMode === "Monthly" || serviceType === "Monthly") ? "Monthly amount" :
             billingMode === "Custom recurring" ? "Amount for selected period" :
             "Quote amount (subtotal before taxes)"}
          </Label>
          <Input
            value={baseAmount}
            onChange={e => {
              setBaseAmount(e.target.value);
              // Sync to the appropriate legacy field too
              const st = (serviceType || "").toLowerCase();
              if (st.includes("one") || !serviceType) setOneTimeAmount(e.target.value);
              else if (st.includes("week") && !st.includes("bi")) setWeeklyAmount(e.target.value);
              else if (st.includes("bi")) setBiweeklyAmount(e.target.value);
              else if (st.includes("month")) setMonthlyAmount(e.target.value);
            }}
            placeholder="e.g. $1,200"
            className="h-8 text-sm font-medium"
            data-testid="input-quote-baseAmount"
          />
        </div>

        {/* Display Billing Period selector */}
        {!isOneTimeBilling && (
          <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">Display billing period</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Choose how the quote amount is presented to the client. Recurring amounts are automatically scaled; one-time add-ons are never multiplied.
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={displayBillingPeriod || "none"}
                onValueChange={v => {
                  setDisplayBillingPeriod(v === "none" ? "" : v);
                  setDisplayAmountOverride(""); // clear override so computed takes over
                }}
              >
                <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-displayBillingPeriod">
                  <SelectValue placeholder="Same as billing mode…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Same as billing mode</SelectItem>
                  {DISPLAY_PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Custom period inputs */}
            {displayBillingPeriod === "Custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1 block">Number of weeks</Label>
                  <Input
                    value={customDisplayWeeks}
                    onChange={e => { setCustomDisplayWeeks(e.target.value); setCustomDisplayMonths(""); setDisplayAmountOverride(""); }}
                    placeholder="e.g. 6"
                    className="h-7 text-xs"
                    data-testid="input-customDisplayWeeks"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1 block">— or months —</Label>
                  <Input
                    value={customDisplayMonths}
                    onChange={e => { setCustomDisplayMonths(e.target.value); setCustomDisplayWeeks(""); setDisplayAmountOverride(""); }}
                    placeholder="e.g. 3"
                    className="h-7 text-xs"
                    data-testid="input-customDisplayMonths"
                  />
                </div>
              </div>
            )}

            {/* Computed display amount preview */}
            {displayBillingPeriod && displayBillingPeriod !== "none" && computedDisplayBase !== null && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground block">
                  {displayPeriodLabel} service amount
                  {displayAddonTotal > 0 ? " (recurring add-ons scaled)" : ""}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={displayAmountOverride || fmtDollar(computedDisplayBase)}
                    onChange={e => setDisplayAmountOverride(e.target.value)}
                    placeholder={fmtDollar(computedDisplayBase)}
                    className="h-8 text-sm font-semibold flex-1"
                    data-testid="input-displayAmount"
                  />
                  {displayAmountOverride && (
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground border rounded px-2 h-8 shrink-0"
                      onClick={() => setDisplayAmountOverride("")}
                      data-testid="button-reset-displayAmount"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Display period breakdown preview */}
                <div className="rounded-lg border bg-background p-2.5 space-y-1 mt-2 text-xs" data-testid="section-display-breakdown">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Recurring {displayPeriodLabel.toLowerCase()} service</span>
                    <span className="font-medium text-foreground">{displayAmountOverride || fmtDollar(computedDisplayBase)}</span>
                  </div>
                  {displayOneTimeAddons.map((l, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{l.name} <span className="text-[10px] opacity-60">(one-time)</span></span>
                      <span>{fmtDollar(l.scaledAmount)}</span>
                    </div>
                  ))}
                  {displayRecurringAddons.map((l, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{l.name} <span className="text-[10px] opacity-60">({l.pricingType})</span></span>
                      <span>{fmtDollar(l.scaledAmount)}</span>
                    </div>
                  ))}
                  {displayAddonLines.length > 0 && (
                    <div className="flex justify-between text-muted-foreground border-t pt-1 mt-0.5">
                      <span>Subtotal</span>
                      <span className="font-medium text-foreground">{displaySubtotal !== null ? fmtDollar(displaySubtotal) : "—"}</span>
                    </div>
                  )}
                  {displayTaxLines.map((t, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{t.name} ({t.rate}%)</span>
                      <span>{fmtDollar(t.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-foreground border-t pt-1 mt-0.5">
                    <span>Total</span>
                    <span data-testid="text-display-grand-total">{displayGrandTotal !== null ? fmtDollar(displayGrandTotal) : "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tax toggle */}
        <div className="flex items-center justify-between pt-1 pb-1">
          <div className="flex items-center gap-2">
            <Percent className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground">Apply taxes</span>
          </div>
          <Switch
            checked={taxEnabled}
            onCheckedChange={setTaxEnabled}
            data-testid="switch-tax-enabled"
          />
        </div>

        {/* Tax rows */}
        {taxEnabled && (
          <div className="space-y-2">
            {taxes.map((tax, i) => (
              <div key={i} className="flex items-center gap-2" data-testid={`row-tax-${i}`}>
                <Input
                  value={tax.name}
                  onChange={e => updateTax(i, "name", e.target.value)}
                  placeholder="Tax name (e.g. GST)"
                  className="h-7 text-xs flex-1"
                  data-testid={`input-tax-name-${i}`}
                />
                <div className="relative flex items-center">
                  <Input
                    value={tax.rate}
                    onChange={e => updateTax(i, "rate", e.target.value)}
                    placeholder="Rate"
                    className="h-7 text-xs w-20 pr-6"
                    data-testid={`input-tax-rate-${i}`}
                  />
                  <span className="absolute right-2 text-[10px] text-muted-foreground">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTax(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  data-testid={`button-remove-tax-${i}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {/* Preset tax quick-add */}
            <div className="flex flex-wrap gap-1">
              {Object.entries(PRESET_TAXES).map(([name, rate]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addTax(name, rate)}
                  className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  data-testid={`button-preset-tax-${name}`}
                >
                  + {name} {rate}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => addTax()}
                className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                data-testid="button-add-custom-tax"
              >
                + Custom tax
              </button>
            </div>
          </div>
        )}

        {/* Live price breakdown */}
        {subtotal !== null && (
          <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5 text-xs" data-testid="section-price-breakdown">
            {/* Base service line */}
            {baseAmt !== null && (
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {(billingMode === "One-time" || serviceType === "One-Time") ? "One-time service" :
                   billingMode === "Per visit" ? "Per visit" :
                   (billingMode === "Weekly" || serviceType === "Weekly") ? "Weekly service" :
                   (billingMode === "Bi-weekly" || serviceType === "Bi-Weekly") ? "Bi-weekly service" :
                   (billingMode === "Monthly" || serviceType === "Monthly") ? "Monthly service" :
                   "Base service"}
                </span>
                <span className="font-medium text-foreground">{fmtDollar(baseAmt)}</span>
              </div>
            )}
            {/* Add-on line items */}
            {addonPricingLines.filter(l => l.included && l.amount).map((l, i) => (
              <div key={i} className="flex justify-between text-muted-foreground" data-testid={`row-addon-line-${i}`}>
                <span>{l.name} <span className="text-[10px] opacity-60">({l.pricingType})</span></span>
                <span>{l.amount.startsWith("$") ? l.amount : `$${l.amount}`}</span>
              </div>
            ))}
            {/* Subtotal divider — only show if there are add-ons */}
            {hasAddons && hasBase && (
              <div className="flex justify-between text-muted-foreground border-t pt-1.5 mt-0.5">
                <span>Subtotal</span>
                <span className="font-medium text-foreground">{fmtDollar(subtotal)}</span>
              </div>
            )}
            {/* Tax lines */}
            {taxLines.map((t, i) => (
              <div key={i} className="flex justify-between text-muted-foreground" data-testid={`row-tax-line-${i}`}>
                <span>{t.name} ({t.rate}%)</span>
                <span>{fmtDollar(t.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-foreground border-t pt-1.5 mt-1">
              <span>Total</span>
              <span data-testid="text-grand-total">{fmtDollar(grandTotal !== null ? grandTotal : subtotal)}</span>
            </div>
          </div>
        )}

        {/* Pricing notes */}
        <div>
          <Label className="text-[11px] text-muted-foreground mb-1 block">Pricing notes</Label>
          <Textarea
            value={pricingNotes}
            onChange={e => setPricingNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Based on 3 visits per week, includes all supplies."
            className="text-xs resize-none"
            data-testid="textarea-quote-pricingNotes"
          />
        </div>
      </Section>

      {/* Save button */}
      <Button size="sm" className="w-full gap-1" onClick={handleSave} data-testid="button-save-quote-bottom">
        <Check className="w-3.5 h-3.5" /> Save Quote Details
      </Button>
    </div>
  );
}
