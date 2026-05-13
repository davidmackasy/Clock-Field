import { useState } from "react";
import { useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, Calendar } from "lucide-react";

const SERVICE_TYPES = [
  "Commercial Cleaning", "Residential Cleaning", "Office Cleaning",
  "Retail Cleaning", "Post-Construction Cleaning", "Move-In Cleaning",
  "Move-Out Cleaning", "Deep Cleaning", "Recurring Cleaning",
  "One-Time Cleaning", "General Service Request",
];

const emptyForm = {
  name: "", companyName: "", phone: "", email: "",
  serviceAddress: "", unitOrSuite: "",
  serviceType: "Commercial Cleaning", customerType: "commercial",
  preferredDate: "", preferredTime: "", alternateDate: "", alternateTime: "",
  frequency: "one_time", notes: "", urgency: "normal",
};

export default function PublicBookingForm() {
  const { companyId } = useParams<{ companyId: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/booking-request/${companyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardContent className="pt-12 pb-12 space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Request Received!</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Thank you! Your booking request has been submitted. We'll review it and be in touch shortly to confirm your appointment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Book a Service</h1>
          <p className="text-muted-foreground text-sm">Fill out the form below and we'll get back to you to confirm your booking.</p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="pt-6 pb-8">
            <form
              onSubmit={e => { e.preventDefault(); if (!consent) return; mutation.mutate(); }}
              className="space-y-6"
            >
              {/* Contact */}
              <section className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Your Name *</Label>
                    <Input required placeholder="Jane Smith" value={form.name} onChange={e => set("name", e.target.value)} data-testid="input-booking-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input placeholder="ABC Corporation" value={form.companyName} onChange={e => set("companyName", e.target.value)} data-testid="input-booking-company" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone *</Label>
                    <Input required type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={e => set("phone", e.target.value)} data-testid="input-booking-phone" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input required type="email" placeholder="jane@example.com" value={form.email} onChange={e => set("email", e.target.value)} data-testid="input-booking-email" />
                  </div>
                </div>
              </section>

              {/* Service Location */}
              <section className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">Service Location</h3>
                <div className="space-y-1.5">
                  <Label>Service Address *</Label>
                  <Input required placeholder="123 Main St, City, Province A1B 2C3" value={form.serviceAddress} onChange={e => set("serviceAddress", e.target.value)} data-testid="input-booking-address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit / Suite <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input placeholder="Suite 100, Unit 4B, etc." value={form.unitOrSuite} onChange={e => set("unitOrSuite", e.target.value)} data-testid="input-booking-unit" />
                </div>
              </section>

              {/* Service Details */}
              <section className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">Service Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Service Type *</Label>
                    <Select value={form.serviceType} onValueChange={v => set("serviceType", v)}>
                      <SelectTrigger data-testid="select-booking-service-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Customer Type</Label>
                    <Select value={form.customerType} onValueChange={v => set("customerType", v)}>
                      <SelectTrigger data-testid="select-booking-customer-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="residential">Residential</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frequency</Label>
                    <Select value={form.frequency} onValueChange={v => set("frequency", v)}>
                      <SelectTrigger data-testid="select-booking-frequency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One-time</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom / TBD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Urgency</Label>
                    <Select value={form.urgency} onValueChange={v => set("urgency", v)}>
                      <SelectTrigger data-testid="select-booking-urgency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent — ASAP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Preferred Schedule */}
              <section className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">Preferred Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Preferred Date *</Label>
                    <Input required type="date" value={form.preferredDate} onChange={e => set("preferredDate", e.target.value)} data-testid="input-booking-preferred-date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Time *</Label>
                    <Input required type="time" value={form.preferredTime} onChange={e => set("preferredTime", e.target.value)} data-testid="input-booking-preferred-time" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alternate Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input type="date" value={form.alternateDate} onChange={e => set("alternateDate", e.target.value)} data-testid="input-booking-alt-date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alternate Time <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input type="time" value={form.alternateTime} onChange={e => set("alternateTime", e.target.value)} data-testid="input-booking-alt-time" />
                  </div>
                </div>
              </section>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  className="resize-none"
                  rows={3}
                  placeholder="Any special instructions, access info, specific areas to clean, etc."
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  data-testid="input-booking-notes"
                />
              </div>

              {/* Consent */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={c => setConsent(!!c)}
                  data-testid="checkbox-booking-consent"
                  className="mt-0.5"
                />
                <label htmlFor="consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  I agree to be contacted regarding my booking request and consent to the collection of my information for the purpose of scheduling services.
                </label>
              </div>

              {mutation.isError && (
                <p className="text-sm text-destructive text-center">{(mutation.error as any)?.message || "An error occurred. Please try again."}</p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!consent || mutation.isPending}
                data-testid="button-submit-booking"
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting...</>
                ) : "Submit Booking Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
