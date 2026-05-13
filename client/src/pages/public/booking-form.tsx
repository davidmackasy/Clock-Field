import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Upload, X, AlertCircle } from "lucide-react";

const SERVICE_TYPES = [
  "Commercial Cleaning","Residential Cleaning","Office Cleaning","Retail Cleaning",
  "Post-Construction Cleaning","Move-In Cleaning","Move-Out Cleaning","Deep Cleaning",
  "Recurring Cleaning","One-Time Cleaning","Industrial Cleaning","Medical / Clinic Cleaning",
  "General Service Request",
];
const CUSTOMER_TYPES = ["Commercial","Residential","Property Manager","Construction","Retail","Office","Other"];
const FREQUENCIES = ["One-time","Daily","Weekly","Bi-weekly","Monthly","Custom"];
const URGENCIES = ["Normal","Soon","Urgent","Emergency"];

function isCommercialType(s: string, c: string) {
  return ["Commercial","Office","Retail","Property Manager","Construction"].includes(c) ||
    ["Commercial Cleaning","Office Cleaning","Retail Cleaning","Industrial Cleaning","Medical / Clinic Cleaning"].includes(s);
}
function isResidentialType(s: string, c: string) {
  return c === "Residential" ||
    ["Residential Cleaning","Deep Cleaning","Recurring Cleaning","One-Time Cleaning"].includes(s);
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-gray-200 pb-3 mb-5">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function CheckGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <Checkbox checked={value.includes(opt)} onCheckedChange={() =>
              onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
            } />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function YesNoSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options?: string[] }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          {(options || ["Yes","No","Not sure"]).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

export default function PublicBookingForm() {
  const { companyId } = useParams<{ companyId: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contact
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bestContactMethod, setBestContactMethod] = useState("");
  const [bestContactTime, setBestContactTime] = useState("");

  // Location
  const [serviceAddress, setServiceAddress] = useState("");
  const [unitOrSuite, setUnitOrSuite] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [parkingInstructions, setParkingInstructions] = useState("");
  const [entryInstructions, setEntryInstructions] = useState("");
  const [alarmInstructions, setAlarmInstructions] = useState("");

  // Service
  const [serviceType, setServiceType] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [frequency, setFrequency] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [alternateDate, setAlternateDate] = useState("");
  const [alternateTime, setAlternateTime] = useState("");

  // Site visit
  const [siteVisitPreference, setSiteVisitPreference] = useState("no");
  const [siteVisitDate, setSiteVisitDate] = useState("");
  const [siteVisitTime, setSiteVisitTime] = useState("");
  const [siteVisitContact, setSiteVisitContact] = useState("");

  // Commercial
  const [businessType, setBusinessType] = useState("");
  const [commercialSqft, setCommercialSqft] = useState("");
  const [numOffices, setNumOffices] = useState("");
  const [numWashrooms, setNumWashrooms] = useState("");
  const [numToilets, setNumToilets] = useState("");
  const [numSinks, setNumSinks] = useState("");
  const [numKitchens, setNumKitchens] = useState("");
  const [numFloors, setNumFloors] = useState("");
  const [numEntrances, setNumEntrances] = useState("");
  const [numMeetingRooms, setNumMeetingRooms] = useState("");
  const [numGarbageAreas, setNumGarbageAreas] = useState("");
  const [floorTypes, setFloorTypes] = useState<string[]>([]);
  const [floorCareNeeds, setFloorCareNeeds] = useState<string[]>([]);
  const [cleaningTimePreference, setCleaningTimePreference] = useState("");
  const [alarmKeyRequired, setAlarmKeyRequired] = useState("");
  const [highTouchDisinfection, setHighTouchDisinfection] = useState("");
  const [suppliesProvided, setSuppliesProvided] = useState("");
  const [consumablesNeeded, setConsumablesNeeded] = useState<string[]>([]);

  // Residential
  const [homeType, setHomeType] = useState("");
  const [numStories, setNumStories] = useState("");
  const [numBedrooms, setNumBedrooms] = useState("");
  const [numBathrooms, setNumBathrooms] = useState("");
  const [numResKitchens, setNumResKitchens] = useState("");
  const [numLivingRooms, setNumLivingRooms] = useState("");
  const [numLaundryRooms, setNumLaundryRooms] = useState("");
  const [numBasementAreas, setNumBasementAreas] = useState("");
  const [numStaircases, setNumStaircases] = useState("");
  const [residentialSqft, setResidentialSqft] = useState("");
  const [hasPets, setHasPets] = useState("");
  const [petTypes, setPetTypes] = useState<string[]>([]);
  const [cleaningType, setCleaningType] = useState("");
  const [areasToClean, setAreasToClean] = useState<string[]>([]);
  const [insideAppliances, setInsideAppliances] = useState<string[]>([]);
  const [specialConditions, setSpecialConditions] = useState<string[]>([]);
  const [cleaningSupplies, setCleaningSupplies] = useState("");

  // Post-Construction
  const [projectType, setProjectType] = useState("");
  const [postSqft, setPostSqft] = useState("");
  const [postNumFloors, setPostNumFloors] = useState("");
  const [heavyDustPresent, setHeavyDustPresent] = useState("");
  const [debrisRemovalNeeded, setDebrisRemovalNeeded] = useState("");
  const [windowsIncluded, setWindowsIncluded] = useState("");
  const [floorsFinished, setFloorsFinished] = useState("");
  const [siteAccessible, setSiteAccessible] = useState("");
  const [completionDeadline, setCompletionDeadline] = useState("");
  const [photosRequiredBeforeQuote, setPhotosRequiredBeforeQuote] = useState("");

  // Move-in/out
  const [propertyEmpty, setPropertyEmpty] = useState("");
  const [appliancesIncluded, setAppliancesIncluded] = useState("");
  const [cabinetsIncluded, setCabinetsIncluded] = useState("");
  const [carpetsIncluded, setCarpetsIncluded] = useState("");
  const [garbageRemoval, setGarbageRemoval] = useState("");
  const [sameDayService, setSameDayService] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [keyAccessInstructions, setKeyAccessInstructions] = useState("");

  // Notes & photos
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [areasAttention, setAreasAttention] = useState("");
  const [areasAvoid, setAreasAvoid] = useState("");
  const [healthSafetyConcerns, setHealthSafetyConcerns] = useState("");
  const [clientExpectations, setClientExpectations] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<{ name: string; dataUrl: string }[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);

  const showCommercial = !!(serviceType && customerType && isCommercialType(serviceType, customerType));
  const showResidential = !!(serviceType && customerType && isResidentialType(serviceType, customerType));
  const showPostConstruction = serviceType === "Post-Construction Cleaning";
  const showMoveInOut = ["Move-In Cleaning","Move-Out Cleaning"].includes(serviceType);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => {
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = ev => setUploadedPhotos(prev => [...prev, { name: file.name, dataUrl: ev.target?.result as string }]);
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = "";
  };

  const submit = useMutation({
    mutationFn: async () => {
      const errs: Record<string, string> = {};
      if (!name.trim()) errs.name = "Name is required";
      if (!phone.trim()) errs.phone = "Phone is required";
      if (!email.trim()) errs.email = "Email is required";
      if (!serviceAddress.trim()) errs.serviceAddress = "Service address is required";
      if (!serviceType) errs.serviceType = "Service type is required";
      if (!customerType) errs.customerType = "Customer type is required";
      if (!frequency) errs.frequency = "Frequency is required";
      if (!preferredDate) errs.preferredDate = "Preferred date is required";
      if (!preferredTime) errs.preferredTime = "Preferred time is required";
      if (!consentGiven) errs.consent = "You must agree to be contacted";
      setErrors(errs);
      if (Object.keys(errs).length > 0) throw new Error("Please fill in all required fields");

      const res = await apiRequest("POST", `/api/public/booking-request/${companyId}`, {
        name, companyName: companyName || null, phone, email,
        bestContactMethod: bestContactMethod || null, bestContactTime: bestContactTime || null,
        serviceAddress, unitOrSuite: unitOrSuite || null, city: city || null, province: province || null,
        postalCode: postalCode || null, accessInstructions: accessInstructions || null,
        parkingInstructions: parkingInstructions || null, entryInstructions: entryInstructions || null,
        alarmInstructions: alarmInstructions || null,
        serviceType, customerType, frequency, urgency,
        preferredDate, preferredTime, alternateDate: alternateDate || null, alternateTime: alternateTime || null,
        siteVisitPreference, siteVisitDate: siteVisitDate || null, siteVisitTime: siteVisitTime || null, siteVisitContact: siteVisitContact || null,
        commercialDetails: showCommercial ? { businessType, squareFootage: commercialSqft, numOffices, numWashrooms, numToilets, numSinks, numKitchens, numFloors, numEntrances, numMeetingRooms, numGarbageAreas, floorTypes, floorCareNeeds, cleaningTimePreference, alarmKeyRequired, highTouchDisinfection, suppliesProvided, consumablesNeeded } : null,
        residentialDetails: showResidential ? { homeType, numStories, numBedrooms, numBathrooms, numKitchens: numResKitchens, numLivingRooms, numLaundryRooms, numBasementAreas, numStaircases, squareFootage: residentialSqft, hasPets, petTypes, cleaningType, areasToClean, insideAppliances, specialConditions, cleaningSupplies } : null,
        postConstructionDetails: showPostConstruction ? { projectType, squareFootage: postSqft, numFloors: postNumFloors, heavyDustPresent, debrisRemovalNeeded, windowsIncluded, floorsFinished, siteAccessible, completionDeadline, photosRequiredBeforeQuote } : null,
        moveInOutDetails: showMoveInOut ? { propertyEmpty, appliancesIncluded, cabinetsIncluded, carpetsIncluded, garbageRemoval, sameDayService, moveDate, keyAccessInstructions } : null,
        uploadedPhotos: uploadedPhotos.length > 0 ? uploadedPhotos : null,
        notes: notes || null, specialInstructions: specialInstructions || null,
        areasAttention: areasAttention || null, areasAvoid: areasAvoid || null,
        healthSafetyConcerns: healthSafetyConcerns || null, clientExpectations: clientExpectations || null,
        consentGiven,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Submission failed"); }
    },
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h1>
          <p className="text-gray-600 leading-relaxed">
            Thank you. Your booking request has been submitted. We will review the details and contact you with an estimate or quote.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Booking Request</h1>
          <p className="text-gray-500 mt-2">Fill out the form below and we'll contact you with an estimate.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 space-y-10">

          {/* ── Contact ── */}
          <section>
            <SectionHeader title="Contact Information" />
            <div className="space-y-4">
              <TwoCol>
                <Field label="Your Name" required error={errors.name}>
                  <Input data-testid="input-name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className={errors.name ? "border-red-400" : ""} />
                </Field>
                <Field label="Company Name">
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Optional" />
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="Phone" required error={errors.phone}>
                  <Input data-testid="input-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className={errors.phone ? "border-red-400" : ""} />
                </Field>
                <Field label="Email" required error={errors.email}>
                  <Input data-testid="input-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={errors.email ? "border-red-400" : ""} />
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="Best Contact Method">
                  <Select value={bestContactMethod} onValueChange={setBestContactMethod}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["Phone","Email","Text","WhatsApp"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Best Time to Contact">
                  <Input value={bestContactTime} onChange={e => setBestContactTime(e.target.value)} placeholder="e.g. Weekday mornings" />
                </Field>
              </TwoCol>
            </div>
          </section>

          {/* ── Location ── */}
          <section>
            <SectionHeader title="Service Location" />
            <div className="space-y-4">
              <Field label="Service Address" required error={errors.serviceAddress}>
                <Input data-testid="input-service-address" value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} placeholder="123 Main Street" className={errors.serviceAddress ? "border-red-400" : ""} />
              </Field>
              <TwoCol>
                <Field label="Unit / Suite"><Input value={unitOrSuite} onChange={e => setUnitOrSuite(e.target.value)} placeholder="Optional" /></Field>
                <Field label="City"><Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" /></Field>
              </TwoCol>
              <TwoCol>
                <Field label="Province / State"><Input value={province} onChange={e => setProvince(e.target.value)} placeholder="Province or state" /></Field>
                <Field label="Postal Code"><Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="A1B 2C3" /></Field>
              </TwoCol>
              <div className="pt-1 space-y-3">
                <p className="text-sm font-medium text-gray-500">Access Details (optional)</p>
                <TwoCol>
                  <Field label="Access Instructions"><Input value={accessInstructions} onChange={e => setAccessInstructions(e.target.value)} placeholder="Building access" /></Field>
                  <Field label="Parking Instructions"><Input value={parkingInstructions} onChange={e => setParkingInstructions(e.target.value)} placeholder="Where to park" /></Field>
                </TwoCol>
                <TwoCol>
                  <Field label="Entry Instructions"><Input value={entryInstructions} onChange={e => setEntryInstructions(e.target.value)} placeholder="Door codes, keys" /></Field>
                  <Field label="Alarm / Key Instructions"><Input value={alarmInstructions} onChange={e => setAlarmInstructions(e.target.value)} placeholder="Alarm code, key pickup" /></Field>
                </TwoCol>
              </div>
            </div>
          </section>

          {/* ── Service Details ── */}
          <section>
            <SectionHeader title="Service Details" />
            <div className="space-y-4">
              <TwoCol>
                <Field label="Service Type" required error={errors.serviceType}>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger data-testid="select-service-type" className={errors.serviceType ? "border-red-400" : ""}><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>{SERVICE_TYPES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Customer Type" required error={errors.customerType}>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger data-testid="select-customer-type" className={errors.customerType ? "border-red-400" : ""}><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>{CUSTOMER_TYPES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="Frequency" required error={errors.frequency}>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger data-testid="select-frequency" className={errors.frequency ? "border-red-400" : ""}><SelectValue placeholder="How often?" /></SelectTrigger>
                    <SelectContent>{FREQUENCIES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Urgency">
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger data-testid="select-urgency"><SelectValue /></SelectTrigger>
                    <SelectContent>{URGENCIES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="Preferred Start Date" required error={errors.preferredDate}>
                  <Input data-testid="input-preferred-date" type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} className={errors.preferredDate ? "border-red-400" : ""} />
                </Field>
                <Field label="Preferred Time" required error={errors.preferredTime}>
                  <Input data-testid="input-preferred-time" type="time" value={preferredTime} onChange={e => setPreferredTime(e.target.value)} className={errors.preferredTime ? "border-red-400" : ""} />
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="Alternate Date"><Input type="date" value={alternateDate} onChange={e => setAlternateDate(e.target.value)} /></Field>
                <Field label="Alternate Time"><Input type="time" value={alternateTime} onChange={e => setAlternateTime(e.target.value)} /></Field>
              </TwoCol>
            </div>
          </section>

          {/* ── Commercial Conditional ── */}
          {showCommercial && (
            <section className="bg-blue-50 rounded-xl p-5 space-y-5 border border-blue-100">
              <SectionHeader title="Commercial Property Details" subtitle="Answer only what applies to your space" />
              <TwoCol>
                <Field label="Business Type">
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger data-testid="select-business-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["Office","Restaurant","Retail","Medical / Clinic","Warehouse","School / Daycare","Gym","Other"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Approximate Square Footage">
                  <Input type="number" min="0" value={commercialSqft} onChange={e => setCommercialSqft(e.target.value)} placeholder="e.g. 2500" />
                </Field>
              </TwoCol>
              <div className="grid grid-cols-3 gap-3">
                {[["# of Offices", numOffices, setNumOffices],["# of Washrooms", numWashrooms, setNumWashrooms],["# of Toilets", numToilets, setNumToilets],["# of Sinks", numSinks, setNumSinks],["# of Kitchens/Breakrooms", numKitchens, setNumKitchens],["# of Floors", numFloors, setNumFloors],["# of Entrances", numEntrances, setNumEntrances],["# of Meeting Rooms", numMeetingRooms, setNumMeetingRooms],["# of Garbage Areas", numGarbageAreas, setNumGarbageAreas]].map(([lbl, val, setter]: any) => (
                  <Field key={lbl as string} label={lbl as string}>
                    <Input type="number" min="0" value={val as string} onChange={e => setter(e.target.value)} placeholder="0" />
                  </Field>
                ))}
              </div>
              <CheckGroup label="Floor Types" options={["Tile","Carpet","Concrete","Vinyl","Hardwood","Mixed"]} value={floorTypes} onChange={setFloorTypes} />
              <CheckGroup label="Floor Care Needs" options={["Sweep","Mop","Vacuum","Strip and wax","Carpet cleaning","Not sure"]} value={floorCareNeeds} onChange={setFloorCareNeeds} />
              <TwoCol>
                <YesNoSelect label="Cleaning Time Preference" value={cleaningTimePreference} onChange={setCleaningTimePreference} options={["During business hours","After hours","Weekend","Flexible"]} />
                <YesNoSelect label="Alarm/Key Access Required?" value={alarmKeyRequired} onChange={setAlarmKeyRequired} />
              </TwoCol>
              <TwoCol>
                <YesNoSelect label="High-Touch Disinfection Needed?" value={highTouchDisinfection} onChange={setHighTouchDisinfection} />
                <YesNoSelect label="Supplies/Equipment Onsite?" value={suppliesProvided} onChange={setSuppliesProvided} options={["Yes","No","Some"]} />
              </TwoCol>
              <CheckGroup label="Consumables to Restock" options={["Toilet paper","Paper towel","Soap","Sanitizer","Garbage bags","Not needed"]} value={consumablesNeeded} onChange={setConsumablesNeeded} />
            </section>
          )}

          {/* ── Residential Conditional ── */}
          {showResidential && (
            <section className="bg-green-50 rounded-xl p-5 space-y-5 border border-green-100">
              <SectionHeader title="Residential Property Details" subtitle="Answer only what applies to your home" />
              <TwoCol>
                <Field label="Home Type">
                  <Select value={homeType} onValueChange={setHomeType}>
                    <SelectTrigger data-testid="select-home-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["House","Apartment","Condo","Townhouse","Basement suite","Other"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Number of Stories">
                  <Select value={numStories} onValueChange={setNumStories}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["1 story","2 stories","3 stories","Basement included"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </TwoCol>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Bedrooms", numBedrooms, setNumBedrooms],["Bathrooms", numBathrooms, setNumBathrooms],["Kitchens", numResKitchens, setNumResKitchens],["Living Rooms", numLivingRooms, setNumLivingRooms],["Laundry Rooms", numLaundryRooms, setNumLaundryRooms],["Basement Areas", numBasementAreas, setNumBasementAreas],["Staircases", numStaircases, setNumStaircases]].map(([lbl, val, setter]: any) => (
                  <Field key={lbl as string} label={lbl as string}>
                    <Input type="number" min="0" value={val as string} onChange={e => setter(e.target.value)} placeholder="0" />
                  </Field>
                ))}
              </div>
              <Field label="Approximate Square Footage">
                <Input type="number" min="0" value={residentialSqft} onChange={e => setResidentialSqft(e.target.value)} placeholder="Optional" />
              </Field>
              <TwoCol>
                <YesNoSelect label="Do You Have Pets?" value={hasPets} onChange={setHasPets} options={["Yes","No"]} />
                {hasPets === "Yes" && (
                  <CheckGroup label="Pet Types" options={["Dogs","Cats","Other"]} value={petTypes} onChange={setPetTypes} />
                )}
              </TwoCol>
              <TwoCol>
                <Field label="Cleaning Type">
                  <Select value={cleaningType} onValueChange={setCleaningType}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["Regular clean","Deep clean","Move-in clean","Move-out clean","Post-renovation clean","Airbnb/short-term rental clean"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Cleaning Supplies">
                  <Select value={cleaningSupplies} onValueChange={setCleaningSupplies}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["Client provides supplies","Cleaner should bring supplies","Not sure"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </TwoCol>
              <CheckGroup label="Areas to Clean" options={["Kitchen","Bathrooms","Bedrooms","Living room","Dining room","Laundry room","Basement","Stairs","Windows","Inside appliances","Inside cabinets","Walls/baseboards","Floors","Other"]} value={areasToClean} onChange={setAreasToClean} />
              <CheckGroup label="Inside Appliance Cleaning" options={["Fridge","Oven","Microwave","Dishwasher","Not needed"]} value={insideAppliances} onChange={setInsideAppliances} />
              <CheckGroup label="Special Conditions" options={["Heavy dust","Pet hair","Grease buildup","Mold concern","Clutter","Post-renovation dust","Empty property","Occupied property"]} value={specialConditions} onChange={setSpecialConditions} />
            </section>
          )}

          {/* ── Post-Construction Conditional ── */}
          {showPostConstruction && (
            <section className="bg-orange-50 rounded-xl p-5 space-y-4 border border-orange-100">
              <SectionHeader title="Post-Construction Details" />
              <TwoCol>
                <Field label="Project Type">
                  <Select value={projectType} onValueChange={setProjectType}>
                    <SelectTrigger data-testid="select-project-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["New build","Renovation","Commercial build","Residential renovation"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Approximate Square Footage">
                  <Input type="number" min="0" value={postSqft} onChange={e => setPostSqft(e.target.value)} placeholder="sq ft" />
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="Number of Floors">
                  <Input type="number" min="0" value={postNumFloors} onChange={e => setPostNumFloors(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Preferred Completion Deadline">
                  <Input type="date" value={completionDeadline} onChange={e => setCompletionDeadline(e.target.value)} />
                </Field>
              </TwoCol>
              <div className="grid grid-cols-2 gap-4">
                <YesNoSelect label="Heavy Dust Present?" value={heavyDustPresent} onChange={setHeavyDustPresent} />
                <YesNoSelect label="Debris Removal Needed?" value={debrisRemovalNeeded} onChange={setDebrisRemovalNeeded} />
                <YesNoSelect label="Windows Included?" value={windowsIncluded} onChange={setWindowsIncluded} />
                <YesNoSelect label="Floors Finished?" value={floorsFinished} onChange={setFloorsFinished} />
                <YesNoSelect label="Site Safe & Accessible?" value={siteAccessible} onChange={setSiteAccessible} />
                <YesNoSelect label="Photos Required Before Quote?" value={photosRequiredBeforeQuote} onChange={setPhotosRequiredBeforeQuote} />
              </div>
            </section>
          )}

          {/* ── Move-In/Out Conditional ── */}
          {showMoveInOut && (
            <section className="bg-purple-50 rounded-xl p-5 space-y-4 border border-purple-100">
              <SectionHeader title="Move-In / Move-Out Details" />
              <div className="grid grid-cols-2 gap-4">
                <YesNoSelect label="Is the Property Empty?" value={propertyEmpty} onChange={setPropertyEmpty} options={["Yes","No","Partially"]} />
                <YesNoSelect label="Appliances Included?" value={appliancesIncluded} onChange={setAppliancesIncluded} options={["Yes","No"]} />
                <YesNoSelect label="Cabinets Included?" value={cabinetsIncluded} onChange={setCabinetsIncluded} options={["Yes","No"]} />
                <YesNoSelect label="Carpets Included?" value={carpetsIncluded} onChange={setCarpetsIncluded} options={["Yes","No"]} />
                <YesNoSelect label="Garbage Removal Needed?" value={garbageRemoval} onChange={setGarbageRemoval} options={["Yes","No"]} />
                <YesNoSelect label="Need Same-Day Service?" value={sameDayService} onChange={setSameDayService} options={["Yes","No"]} />
              </div>
              <TwoCol>
                <Field label="Move Date"><Input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} /></Field>
                <Field label="Key Pickup / Access Instructions"><Input value={keyAccessInstructions} onChange={e => setKeyAccessInstructions(e.target.value)} placeholder="Where is the key?" /></Field>
              </TwoCol>
            </section>
          )}

          {/* ── Site Visit ── */}
          <section>
            <SectionHeader title="Site Visit Option" subtitle="Would you like us to visit before providing a final price?" />
            <div className="space-y-2.5">
              {[{v:"yes",l:"Yes, I want a site visit first"},{v:"no",l:"No, please estimate based on the information I provided"},{v:"not_sure",l:"Not sure — contact me first"}].map(opt => (
                <label key={opt.v} className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${siteVisitPreference === opt.v ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="siteVisit" value={opt.v} checked={siteVisitPreference === opt.v} onChange={() => setSiteVisitPreference(opt.v)} className="mt-0.5" />
                  <span className="text-sm font-medium text-gray-800">{opt.l}</span>
                </label>
              ))}
              {siteVisitPreference === "yes" && (
                <div className="pt-2 space-y-4">
                  <TwoCol>
                    <Field label="Preferred Site Visit Date"><Input type="date" value={siteVisitDate} onChange={e => setSiteVisitDate(e.target.value)} /></Field>
                    <Field label="Preferred Site Visit Time"><Input type="time" value={siteVisitTime} onChange={e => setSiteVisitTime(e.target.value)} /></Field>
                  </TwoCol>
                  <Field label="Who Should We Contact Onsite?">
                    <Input value={siteVisitContact} onChange={e => setSiteVisitContact(e.target.value)} placeholder="Name and phone number" />
                  </Field>
                </div>
              )}
            </div>
          </section>

          {/* ── Photos ── */}
          <section>
            <SectionHeader title="Photos & Files" subtitle="Optional but helpful — upload photos of the space, floor plans, or checklists" />
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">Click to upload photos or files</p>
              <p className="text-xs text-gray-400 mt-1">Images, PDF, DOC — max 5MB per file</p>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handlePhotoUpload} />
            {uploadedPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {uploadedPhotos.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5 text-sm">
                    <span className="truncate max-w-[140px] text-gray-700">{p.name}</span>
                    <button onClick={() => setUploadedPhotos(prev => prev.filter((_,j) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Additional Notes ── */}
          <section>
            <SectionHeader title="Additional Notes" />
            <div className="space-y-4">
              <Field label="Special Instructions">
                <Textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Any special requests or requirements..." rows={2} />
              </Field>
              <TwoCol>
                <Field label="Areas Needing Extra Attention">
                  <Textarea value={areasAttention} onChange={e => setAreasAttention(e.target.value)} placeholder="Which areas need the most focus?" rows={2} />
                </Field>
                <Field label="Areas to Avoid">
                  <Textarea value={areasAvoid} onChange={e => setAreasAvoid(e.target.value)} placeholder="Any areas we should not enter?" rows={2} />
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="Health / Safety Concerns">
                  <Textarea value={healthSafetyConcerns} onChange={e => setHealthSafetyConcerns(e.target.value)} placeholder="Allergies, chemical sensitivities, hazards..." rows={2} />
                </Field>
                <Field label="Your Expectations">
                  <Textarea value={clientExpectations} onChange={e => setClientExpectations(e.target.value)} placeholder="What does success look like to you?" rows={2} />
                </Field>
              </TwoCol>
              <Field label="Other Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else we should know..." rows={3} />
              </Field>
            </div>
          </section>

          {/* ── Consent ── */}
          <section>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox data-testid="checkbox-consent" checked={consentGiven} onCheckedChange={v => setConsentGiven(!!v)} className="mt-0.5" />
                <span className="text-sm text-gray-700 leading-relaxed">
                  I agree to be contacted regarding my booking request and consent to the collection of my information for the purpose of scheduling services.
                </span>
              </label>
              {errors.consent && <p className="text-xs text-red-500 mt-2 ml-7">{errors.consent}</p>}
            </div>
          </section>

          {submit.isError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{(submit.error as Error)?.message || "Please fix the errors above."}</p>
            </div>
          )}

          <Button data-testid="button-submit-booking" onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full h-12 text-base font-semibold">
            {submit.isPending ? "Submitting..." : "Submit Booking Request"}
          </Button>
        </div>
      </div>
    </div>
  );
}
