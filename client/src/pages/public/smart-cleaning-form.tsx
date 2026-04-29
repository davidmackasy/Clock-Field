import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ClipboardList } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type Props = {
  formId: string;
  companyId: string;
  slug: string;
  companyName: string;
  companyLogo: string | null;
  brandColor: string;
  isEmbed: boolean;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  submitted: boolean;
  onReset: () => void;
};

// ── Static Options ──────────────────────────────────────────────────────────
const SERVICE_TYPES = [
  "Residential Cleaning", "Commercial Cleaning", "Post-Construction Cleaning",
  "Move-In / Move-Out Cleaning", "Deep Cleaning", "Recurring Cleaning", "Other",
];
const PROPERTY_CATEGORIES = ["Residential", "Commercial", "Industrial / Warehouse", "Other"];
const RES_PROPERTY_TYPES = [
  "Apartment / Condo", "Townhouse", "Single-Family House", "Duplex",
  "Two-Story House", "Basement Suite", "Other",
];
const COM_PROPERTY_TYPES = [
  "Office", "Retail Store", "Restaurant", "Medical Clinic", "Dental Clinic",
  "School / Daycare", "Church", "Gym / Fitness Facility", "Warehouse",
  "Industrial Building", "Apartment Common Area", "Post-Construction Site", "Other",
];
const BASEMENT_OPTIONS = [
  "No", "Yes, unfinished basement", "Yes, finished basement", "Yes, basement suite",
];
const BASEMENT_CLEANING_OPTIONS = ["Yes", "No", "Only part of it"];
const CONDITION_OPTIONS_RES = [
  "Light cleaning needed", "Normal cleaning needed", "Deep cleaning needed",
  "Very dirty / heavy buildup", "Move-out condition", "Post-renovation dust",
];
const CONDITION_OPTIONS_COM = [
  "Light maintenance cleaning", "Normal cleaning", "Heavy traffic areas",
  "Deep cleaning needed", "Post-construction dust", "Grease buildup", "Industrial dirt / dust",
];
const SUPPLY_OPTIONS = [
  "Yes, bring all supplies", "No, supplies are provided", "Some supplies are provided",
];
const FLOOR_TYPES = [
  "Vinyl", "Tile", "Carpet", "Concrete", "Hardwood", "Laminate", "Epoxy",
  "Rubber gym flooring", "Other",
];
const FREQUENCY_OPTIONS = [
  "One-time", "Daily", "2x per week", "3x per week", "Weekly",
  "Bi-weekly", "Monthly", "Custom",
];
const CLEANING_DURATION = [
  "Not sure", "Under 1 hour", "1–2 hours", "2–4 hours", "4–6 hours",
  "6+ hours", "Multiple cleaners needed",
];
const RES_ADDONS = [
  "Inside fridge", "Inside oven", "Microwave cleaning", "Inside cabinets",
  "Wall spot cleaning", "Baseboards", "Interior windows", "Garage cleaning",
  "Basement cleaning", "Laundry room", "Pantry cleaning", "Carpet cleaning",
  "Upholstery cleaning", "Pet hair removal", "Trash removal", "Heavy-duty deep clean",
];
const COM_ADDONS = [
  "Interior windows", "Exterior windows", "Carpet cleaning", "Floor scrubbing",
  "Floor stripping and waxing", "High dusting", "Disinfection", "Garbage removal",
  "Recycling service", "Restocking supplies", "Kitchen appliance cleaning",
  "Warehouse floor cleaning", "Post-construction dust removal", "Pressure washing",
];
const RESTOCKING = ["Toilet paper", "Paper towel", "Soap", "Sanitizer", "Garbage bags", "Not needed"];

// ── Step Definitions ────────────────────────────────────────────────────────
const STEPS = [
  { id: "contact",  title: "Contact Information" },
  { id: "address",  title: "Service Address" },
  { id: "service",  title: "Service Type" },
  { id: "details",  title: "Property Details" },
  { id: "addons",   title: "Add-ons" },
  { id: "review",   title: "Review & Submit" },
];

// ── UI Primitives ───────────────────────────────────────────────────────────
const inputCls = (err?: boolean) => cn(
  "w-full rounded-xl border px-4 py-3 text-sm bg-white transition-all outline-none",
  "focus:ring-2 focus:ring-offset-0 placeholder-gray-400 text-gray-900",
  err
    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
    : "border-gray-200 focus:border-indigo-300 focus:ring-indigo-100"
);

function Field({ label, required, error, children, note }: { label: string; required?: boolean; error?: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
        {label}
        {required ? <span className="text-red-500 text-xs">*</span> : <span className="text-[10px] text-gray-400">(optional)</span>}
      </label>
      {children}
      {note && <p className="text-[11px] text-gray-400">{note}</p>}
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", err }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; err?: boolean }) {
  return <input type={type} className={inputCls(err)} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />;
}

function SelectInput({ value, onChange, options, placeholder, err }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; err?: boolean }) {
  return (
    <select className={cn(inputCls(err), "cursor-pointer")} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder || "Select an option…"}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange, placeholder, err }: { value: string; onChange: (v: string) => void; placeholder?: string; err?: boolean }) {
  return <input type="number" min="0" className={inputCls(err)} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />;
}

function CheckboxGroup({ options, selected, onChange, cols = 2 }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; cols?: number }) {
  const toggle = (o: string) => {
    onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  };
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {options.map(o => (
        <label key={o} className="flex items-center gap-2.5 cursor-pointer group">
          <div className={cn(
            "w-4.5 h-4.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
            selected.includes(o) ? "border-indigo-500 bg-indigo-500" : "border-gray-300 group-hover:border-indigo-400"
          )}>
            {selected.includes(o) && <svg viewBox="0 0 10 8" className="w-3 h-3"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span className="text-sm text-gray-700 leading-tight">{o}</span>
        </label>
      ))}
    </div>
  );
}

function Row({ children, half = false }: { children: React.ReactNode; half?: boolean }) {
  return <div className={cn("flex gap-3", half ? "flex-col sm:flex-row" : "flex-col")}>{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function SmartCleaningForm({ companyName, companyLogo, brandColor, isEmbed, onSubmit, submitted, onReset }: Props) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vals, setVals] = useState<Record<string, any>>({});

  const set = (k: string, v: any) => {
    setVals(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => { const e = { ...p }; delete e[k]; return e; });
  };
  const g = (k: string, def: any = "") => vals[k] ?? def;

  const isResidential = ["Residential"].includes(g("propertyCategory"));
  const isCommercial  = ["Commercial", "Industrial / Warehouse"].includes(g("propertyCategory"));
  const totalSteps = STEPS.length;

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!g("email").trim()) e.email = "Email is required";
      else if (!/\S+@\S+\.\S+/.test(g("email"))) e.email = "Enter a valid email";
    }
    if (step === 1) {
      if (!g("streetAddress").trim()) e.streetAddress = "Street address is required";
      if (!g("city").trim()) e.city = "City is required";
    }
    if (step === 2) {
      if (!g("serviceType")) e.serviceType = "Select a service type";
      if (!g("propertyCategory")) e.propertyCategory = "Select property category";
    }
    if (step === 3) {
      if (isResidential) {
        if (!g("resPropertyType")) e.resPropertyType = "Select property type";
        if (!g("sqft") && !g("bedrooms")) e.sqft = "Enter square footage or number of bedrooms";
      }
      if (isCommercial) {
        if (!g("comPropertyType")) e.comPropertyType = "Select property type";
        if (!g("sqftCom")) e.sqftCom = "Square footage is required";
        if (!g("frequency")) e.frequency = "Select cleaning frequency";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    if (step < totalSteps - 1) {
      setStep(s => s + 1);
      if (!isEmbed) window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setSubmitting(true);
      try { await onSubmit(vals); } finally { setSubmitting(false); }
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => s - 1);
    if (!isEmbed) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Success Screen ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className={cn("flex flex-col", isEmbed ? "bg-transparent" : "min-h-screen bg-gradient-to-b from-gray-50 to-white")}>
        {!isEmbed && (
          <header className="pt-10 pb-6 text-center px-4">
            {companyLogo ? (
              <img src={companyLogo} alt={companyName} className="h-12 w-auto mx-auto mb-3 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: brandColor }}>
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
            )}
            <h1 className="text-base font-semibold text-gray-900">{companyName}</h1>
          </header>
        )}
        <main className={cn("flex items-center justify-center px-4", isEmbed ? "py-12" : "flex-1 pb-16")}>
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${brandColor}15` }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: brandColor }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h2>
            <p className="text-gray-500 mb-2 leading-relaxed">
              Thank you for reaching out to <strong>{companyName}</strong>! We've received your cleaning quote request and will be in touch shortly.
            </p>
            <p className="text-sm text-gray-400 mb-8">Check your email for a confirmation message.</p>
            <button onClick={onReset} className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ background: brandColor }} data-testid="button-submit-another">
              Submit Another Request
            </button>
          </div>
        </main>
        {isEmbed ? (
          <div className="mt-4 pb-4 text-center text-xs text-gray-500">
            Created using <a href="https://clockfield.com" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2">Clockfield</a>
          </div>
        ) : (
          <footer className="py-5 text-center">
            <p className="text-xs text-gray-400">Powered by <span className="font-medium">Clockfield</span></p>
          </footer>
        )}
      </div>
    );
  }

  // ── Step Content ────────────────────────────────────────────────────────
  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <Row half>
              <div className="flex-1">
                <Field label="First Name"><TextInput value={g("firstName")} onChange={v => set("firstName", v)} placeholder="Jane" /></Field>
              </div>
              <div className="flex-1">
                <Field label="Last Name"><TextInput value={g("lastName")} onChange={v => set("lastName", v)} placeholder="Smith" /></Field>
              </div>
            </Row>
            <Field label="Email Address" required error={errors.email}>
              <TextInput type="email" value={g("email")} onChange={v => set("email", v)} placeholder="jane@example.com" err={!!errors.email} />
            </Field>
            <Field label="Phone Number">
              <TextInput type="tel" value={g("phone")} onChange={v => set("phone", v)} placeholder="(555) 000-0000" />
            </Field>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <Field label="Street Address" required error={errors.streetAddress}>
              <TextInput value={g("streetAddress")} onChange={v => set("streetAddress", v)} placeholder="123 Main Street" err={!!errors.streetAddress} />
            </Field>
            <Field label="Unit / Suite">
              <TextInput value={g("unitSuite")} onChange={v => set("unitSuite", v)} placeholder="Apt 4B" />
            </Field>
            <Row half>
              <div className="flex-1">
                <Field label="City" required error={errors.city}>
                  <TextInput value={g("city")} onChange={v => set("city", v)} placeholder="Winnipeg" err={!!errors.city} />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Province / State">
                  <TextInput value={g("province")} onChange={v => set("province", v)} placeholder="MB" />
                </Field>
              </div>
            </Row>
            <Field label="Postal Code">
              <TextInput value={g("postalCode")} onChange={v => set("postalCode", v)} placeholder="R3C 0A1" />
            </Field>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <Field label="Service Type" required error={errors.serviceType}>
              <SelectInput value={g("serviceType")} onChange={v => set("serviceType", v)} options={SERVICE_TYPES} err={!!errors.serviceType} />
            </Field>
            <Field label="Property Category" required error={errors.propertyCategory} note="This determines what questions we ask next.">
              <div className="grid grid-cols-2 gap-2">
                {PROPERTY_CATEGORIES.map(cat => (
                  <button key={cat} type="button"
                    className={cn(
                      "px-3 py-3 rounded-xl border text-sm font-medium text-left transition-all",
                      g("propertyCategory") === cat
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    )}
                    onClick={() => set("propertyCategory", cat)}>
                    {cat}
                  </button>
                ))}
              </div>
              {errors.propertyCategory && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.propertyCategory}</p>}
            </Field>
          </div>
        );

      case 3:
        if (!isResidential && !isCommercial) {
          return (
            <div className="space-y-4">
              <Field label="Property Type" required>
                <TextInput value={g("otherPropertyType")} onChange={v => set("otherPropertyType", v)} placeholder="Describe your property type" />
              </Field>
              <Field label="Square Footage">
                <NumberInput value={g("sqftOther")} onChange={v => set("sqftOther", v)} placeholder="e.g. 1500" />
              </Field>
              <Field label="Additional Details">
                <textarea className={inputCls()} rows={4} placeholder="Please describe your space and cleaning needs…" value={g("otherDetails")} onChange={e => set("otherDetails", e.target.value)} />
              </Field>
            </div>
          );
        }

        if (isResidential) {
          return (
            <div className="space-y-6">
              <Section title="Property Type">
                <Field label="Residential Property Type" required error={errors.resPropertyType}>
                  <SelectInput value={g("resPropertyType")} onChange={v => set("resPropertyType", v)} options={RES_PROPERTY_TYPES} err={!!errors.resPropertyType} />
                </Field>
              </Section>

              <Section title="Home Size">
                <Row half>
                  <div className="flex-1">
                    <Field label="Square Footage" error={errors.sqft}>
                      <NumberInput value={g("sqft")} onChange={v => set("sqft", v)} placeholder="e.g. 1500" err={!!errors.sqft} />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Bedrooms">
                      <NumberInput value={g("bedrooms")} onChange={v => set("bedrooms", v)} placeholder="e.g. 3" />
                    </Field>
                  </div>
                </Row>
                <Row half>
                  <div className="flex-1">
                    <Field label="Bathrooms">
                      <NumberInput value={g("bathrooms")} onChange={v => set("bathrooms", v)} placeholder="e.g. 2" />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Kitchens">
                      <NumberInput value={g("kitchens")} onChange={v => set("kitchens", v)} placeholder="e.g. 1" />
                    </Field>
                  </div>
                </Row>
                <Row half>
                  <div className="flex-1">
                    <Field label="Number of Floors">
                      <NumberInput value={g("floors")} onChange={v => set("floors", v)} placeholder="e.g. 2" />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Living Rooms">
                      <NumberInput value={g("livingRooms")} onChange={v => set("livingRooms", v)} placeholder="e.g. 1" />
                    </Field>
                  </div>
                </Row>
              </Section>

              <Section title="Basement">
                <Field label="Do you have a basement?">
                  <SelectInput value={g("basementType")} onChange={v => set("basementType", v)} options={BASEMENT_OPTIONS} />
                </Field>
                {g("basementType") && g("basementType") !== "No" && (
                  <>
                    <Field label="Do you want the basement cleaned?">
                      <SelectInput value={g("basementCleaning")} onChange={v => set("basementCleaning", v)} options={BASEMENT_CLEANING_OPTIONS} />
                    </Field>
                    {g("basementCleaning") === "Only part of it" && (
                      <Field label="Describe which basement areas need cleaning">
                        <textarea className={inputCls()} rows={3} value={g("basementNotes")} onChange={e => set("basementNotes", e.target.value)} placeholder="e.g. Just the laundry area and hallway" />
                      </Field>
                    )}
                  </>
                )}
              </Section>

              <Section title="Condition & Supplies">
                <Field label="Current condition of the home">
                  <SelectInput value={g("condition")} onChange={v => set("condition", v)} options={CONDITION_OPTIONS_RES} />
                </Field>
                <Field label="Should the cleaner bring supplies?">
                  <SelectInput value={g("supplies")} onChange={v => set("supplies", v)} options={SUPPLY_OPTIONS} />
                </Field>
              </Section>
            </div>
          );
        }

        // Commercial
        return (
          <div className="space-y-6">
            <Section title="Property Type">
              <Field label="Commercial Property Type" required error={errors.comPropertyType}>
                <SelectInput value={g("comPropertyType")} onChange={v => set("comPropertyType", v)} options={COM_PROPERTY_TYPES} err={!!errors.comPropertyType} />
              </Field>
            </Section>

            <Section title="Property Size">
              <Row half>
                <div className="flex-1">
                  <Field label="Total Square Footage" required error={errors.sqftCom}>
                    <NumberInput value={g("sqftCom")} onChange={v => set("sqftCom", v)} placeholder="e.g. 5000" err={!!errors.sqftCom} />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Number of Floors">
                    <NumberInput value={g("floorsCom")} onChange={v => set("floorsCom", v)} placeholder="e.g. 2" />
                  </Field>
                </div>
              </Row>
              <Row half>
                <div className="flex-1">
                  <Field label="Has a second story?">
                    <SelectInput value={g("hasSecondStory")} onChange={v => set("hasSecondStory", v)} options={["Yes", "No"]} />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Has elevator?">
                    <SelectInput value={g("hasElevator")} onChange={v => set("hasElevator", v)} options={["Yes", "No"]} />
                  </Field>
                </div>
              </Row>
              {g("hasSecondStory") === "Yes" && (
                <Row half>
                  <div className="flex-1">
                    <Field label="Offices/rooms upstairs">
                      <NumberInput value={g("upstairsOffices")} onChange={v => set("upstairsOffices", v)} placeholder="e.g. 3" />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Upstairs washrooms included?">
                      <SelectInput value={g("upstairsWashrooms")} onChange={v => set("upstairsWashrooms", v)} options={["Yes", "No"]} />
                    </Field>
                  </div>
                </Row>
              )}
            </Section>

            <Section title="Room Breakdown">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Private offices", "privateOffices"], ["Open office areas", "openOfficeAreas"],
                  ["Boardrooms", "boardrooms"], ["Reception areas", "receptionAreas"],
                  ["Hallways", "hallways"], ["Storage rooms", "storageRooms"],
                  ["Staff rooms", "staffRooms"], ["Back offices", "backOffices"],
                ].map(([label, key]) => (
                  <Field key={key} label={label}>
                    <NumberInput value={g(key)} onChange={v => set(key, v)} placeholder="0" />
                  </Field>
                ))}
              </div>
            </Section>

            <Section title="Washrooms">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Total washrooms", "washroomsTotal"], ["Single-stall", "singleStall"],
                  ["Multi-stall", "multiStall"], ["Total toilets", "toilets"],
                  ["Urinals", "urinals"], ["Total sinks", "sinks"],
                ].map(([label, key]) => (
                  <Field key={key} label={label}>
                    <NumberInput value={g(key)} onChange={v => set(key, v)} placeholder="0" />
                  </Field>
                ))}
              </div>
              <Field label="Restocking services needed?">
                <CheckboxGroup options={RESTOCKING} selected={g("restocking", [])} onChange={v => set("restocking", v)} />
              </Field>
            </Section>

            <Section title="Kitchen / Breakroom">
              <Field label="Does the property have a kitchen or breakroom?">
                <SelectInput value={g("hasKitchen")} onChange={v => set("hasKitchen", v)} options={["Yes", "No"]} />
              </Field>
              {g("hasKitchen") === "Yes" && (
                <Field label="Number of kitchens / breakrooms">
                  <NumberInput value={g("kitchenCount")} onChange={v => set("kitchenCount", v)} placeholder="e.g. 1" />
                </Field>
              )}
            </Section>

            <Section title="Floor Types">
              <Field label="What types of floors are present?">
                <CheckboxGroup options={FLOOR_TYPES} selected={g("floorTypes", [])} onChange={v => set("floorTypes", v)} />
              </Field>
            </Section>

            <Section title="Cleaning Schedule">
              <Field label="How often do you need cleaning?" required error={errors.frequency}>
                <SelectInput value={g("frequency")} onChange={v => set("frequency", v)} options={FREQUENCY_OPTIONS} err={!!errors.frequency} />
              </Field>
              {g("frequency") === "Custom" && (
                <Field label="Describe preferred schedule">
                  <textarea className={inputCls()} rows={2} value={g("customSchedule")} onChange={e => set("customSchedule", e.target.value)} placeholder="e.g. Monday and Thursday evenings after 6pm" />
                </Field>
              )}
              <Field label="How long does cleaning usually take now?">
                <SelectInput value={g("cleaningDuration")} onChange={v => set("cleaningDuration", v)} options={CLEANING_DURATION} />
              </Field>
              <Field label="How many cleaners are usually needed?">
                <NumberInput value={g("cleanerCount")} onChange={v => set("cleanerCount", v)} placeholder="e.g. 2" />
              </Field>
            </Section>

            <Section title="Condition">
              <Field label="Current condition of the property">
                <SelectInput value={g("conditionCom")} onChange={v => set("conditionCom", v)} options={CONDITION_OPTIONS_COM} />
              </Field>
            </Section>
          </div>
        );

      case 4:
        const addons = isCommercial ? COM_ADDONS : RES_ADDONS;
        return (
          <div className="space-y-6">
            <Section title={isCommercial ? "Additional Commercial Services" : "Extra Cleaning Add-ons"}>
              <p className="text-sm text-gray-500 -mt-2">Select any additional services you'd like included.</p>
              <CheckboxGroup options={addons} selected={g("addons", [])} onChange={v => set("addons", v)} />
            </Section>
            <Field label="Special Instructions">
              <textarea className={inputCls()} rows={4} placeholder="Anything we should know about your space? Pets, allergies, access instructions, etc." value={g("specialInstructions")} onChange={e => set("specialInstructions", e.target.value)} />
            </Field>
            <Field label="Preferred Date">
              <input type="date" className={inputCls()} value={g("preferredDate")} onChange={e => set("preferredDate", e.target.value)} />
            </Field>
            <Field label="Preferred Time">
              <SelectInput value={g("preferredTime")} onChange={v => set("preferredTime", v)} options={["Morning (8am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–8pm)", "Flexible"]} />
            </Field>
            <Field label="Budget Range">
              <TextInput value={g("budget")} onChange={v => set("budget", v)} placeholder="e.g. $150–$200" />
            </Field>
          </div>
        );

      case 5:
        // Review
        const reviewSections: Array<{ title: string; rows: [string, any][] }> = [];
        if (g("firstName") || g("email"))
          reviewSections.push({ title: "Contact", rows: [["Name", [g("firstName"), g("lastName")].filter(Boolean).join(" ") || "—"], ["Email", g("email") || "—"], ["Phone", g("phone") || "—"]] });
        if (g("streetAddress"))
          reviewSections.push({ title: "Address", rows: [["Street", g("streetAddress")], ["City", [g("city"), g("province"), g("postalCode")].filter(Boolean).join(", ")]] });
        if (g("serviceType"))
          reviewSections.push({ title: "Service", rows: [["Type", g("serviceType")], ["Category", g("propertyCategory")]] });
        if (isResidential && g("resPropertyType"))
          reviewSections.push({ title: "Property Details", rows: [["Property", g("resPropertyType")], ["Size", [g("sqft") && `${g("sqft")} sq ft`, g("bedrooms") && `${g("bedrooms")} bed`, g("bathrooms") && `${g("bathrooms")} bath`].filter(Boolean).join(" · ") || "—"], ["Condition", g("condition") || "—"]] });
        if (isCommercial && g("comPropertyType"))
          reviewSections.push({ title: "Property Details", rows: [["Property", g("comPropertyType")], ["Size", g("sqftCom") ? `${g("sqftCom")} sq ft` : "—"], ["Frequency", g("frequency") || "—"], ["Condition", g("conditionCom") || "—"]] });
        if (g("addons", []).length > 0)
          reviewSections.push({ title: "Add-ons", rows: [["Selected", g("addons", []).join(", ")]] });
        if (g("preferredDate"))
          reviewSections.push({ title: "Scheduling", rows: [["Date", g("preferredDate")], ["Time", g("preferredTime") || "Flexible"]] });

        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Please review your details before submitting.</p>
            {reviewSections.map(sec => (
              <div key={sec.title} className="rounded-xl border bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{sec.title}</p>
                <div className="space-y-1">
                  {sec.rows.map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-sm">
                      <span className="text-gray-400 w-20 flex-shrink-0">{k}</span>
                      <span className="text-gray-800 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const isLast = step === totalSteps - 1;

  return (
    <div className={cn("flex flex-col", isEmbed ? "bg-transparent" : "min-h-screen bg-gradient-to-b from-gray-50 to-white")}>
      {!isEmbed && (
        <header className="pt-8 pb-4 text-center px-4">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="h-12 w-auto mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: brandColor }}>
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
          )}
          <h1 className="text-base font-semibold text-gray-900">{companyName}</h1>
          <div className="mt-4 h-px bg-gray-100 max-w-md mx-auto" />
        </header>
      )}

      {/* Progress bar */}
      <div className={cn("px-4 max-w-lg mx-auto w-full", isEmbed ? "pt-4 pb-2" : "py-3")}>
        <div className="flex gap-1 mb-2">
          {STEPS.map((_, idx) => (
            <div key={idx} className="flex-1 h-1.5 rounded-full transition-all duration-500"
              style={{ background: idx <= step ? brandColor : "#e5e7eb", opacity: idx < step ? 0.5 : 1 }} />
          ))}
        </div>
        <p className="text-[11px] text-gray-400 text-right">Step {step + 1} of {totalSteps}</p>
      </div>

      {/* Form card */}
      <main className={cn("px-4", isEmbed ? "pb-4" : "flex-1 pb-6")}>
        <div className="max-w-lg mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{STEPS[step].title}</h2>
            {stepContent()}

            <div className={cn("flex gap-3 mt-8", step > 0 ? "justify-between" : "justify-end")}>
              {step > 0 && (
                <button data-testid="button-form-back" onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button
                data-testid={isLast ? "button-form-submit" : "button-form-next"}
                onClick={handleNext}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 min-w-[140px] justify-center"
                style={{ background: brandColor }}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> :
                  isLast ? <>Submit Request <ChevronRight className="w-4 h-4" /></> :
                  <>Next <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        </div>
      </main>

      {isEmbed ? (
        <div className="mt-4 pb-4 text-center text-xs text-gray-500">
          Created using{" "}
          <a href="https://clockfield.com" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2">Clockfield</a>
        </div>
      ) : (
        <footer className="py-5 text-center">
          <p className="text-xs text-gray-400">Powered by <span className="font-medium">Clockfield</span></p>
        </footer>
      )}
    </div>
  );
}
