import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ExternalLink, Upload, Bell } from "lucide-react";

const TIMEZONES = [
  { group: "Canada", options: [
    { value: "America/St_Johns",   label: "St. John's (Newfoundland Time)" },
    { value: "America/Halifax",    label: "Halifax (Atlantic Time)" },
    { value: "America/Moncton",    label: "Moncton (Atlantic Time)" },
    { value: "America/Toronto",    label: "Toronto (Eastern Time)" },
    { value: "America/Winnipeg",   label: "Winnipeg (Central Time)" },
    { value: "America/Regina",     label: "Regina (Central Standard)" },
    { value: "America/Edmonton",   label: "Edmonton (Mountain Time)" },
    { value: "America/Vancouver",  label: "Vancouver (Pacific Time)" },
    { value: "America/Whitehorse", label: "Whitehorse (Yukon Time)" },
  ]},
  { group: "United States", options: [
    { value: "America/New_York",   label: "New York (Eastern Time)" },
    { value: "America/Chicago",    label: "Chicago (Central Time)" },
    { value: "America/Denver",     label: "Denver (Mountain Time)" },
    { value: "America/Phoenix",    label: "Phoenix (Mountain Standard)" },
    { value: "America/Los_Angeles",label: "Los Angeles (Pacific Time)" },
    { value: "America/Anchorage",  label: "Anchorage (Alaska Time)" },
    { value: "Pacific/Honolulu",   label: "Honolulu (Hawaii Time)" },
  ]},
  { group: "United Kingdom", options: [
    { value: "Europe/London",      label: "London (GMT / BST)" },
  ]},
  { group: "Other", options: [
    { value: "Europe/Dublin",      label: "Dublin (IST)" },
    { value: "Europe/Paris",       label: "Paris (CET / CEST)" },
    { value: "Europe/Berlin",      label: "Berlin (CET / CEST)" },
    { value: "Australia/Sydney",   label: "Sydney (AEST / AEDT)" },
    { value: "Australia/Melbourne",label: "Melbourne (AEST / AEDT)" },
    { value: "Pacific/Auckland",   label: "Auckland (NZST / NZDT)" },
    { value: "UTC",                label: "UTC (Universal Coordinated Time)" },
  ]},
];

const PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const { data: company, isLoading } = useQuery<any>({ queryKey: ["/api/company"] });
  const { data: customDeductions, isLoading: deductionsLoading } = useQuery<any[]>({ queryKey: ["/api/payroll-deductions"] });
  const [form, setForm] = useState<any>(null);
  const [newDeduction, setNewDeduction] = useState({ label: "", type: "percent", value: "" });
  const [addingDeduction, setAddingDeduction] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a PNG, JPG, JPEG, or WEBP image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5 MB.", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Upload failed");
      }
      const { url } = await res.json();
      setForm((p: any) => ({ ...p, companyLogoUrl: url }));
      toast({ title: "Logo uploaded", description: "Click Save Settings to apply." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (company && !form) setForm(company);
  }, [company]);

  const updateMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/company", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addDeductionMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/payroll-deductions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-deductions"] });
      setNewDeduction({ label: "", type: "percent", value: "" });
      setAddingDeduction(false);
      toast({ title: "Deduction added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateDeductionMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/payroll-deductions/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payroll-deductions"] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteDeductionMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/payroll-deductions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-deductions"] });
      toast({ title: "Deduction removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !form) return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your company preferences</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Company Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input data-testid="input-company-name" value={form.name || ""} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input data-testid="input-company-address" placeholder="123 Main Street" value={form.address || ""} onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-1">
                <Label>City</Label>
                <Input data-testid="input-company-city" placeholder="Victoria" value={form.city || ""} onChange={e => setForm((p: any) => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-1">
                <Label>Province / State</Label>
                <Input data-testid="input-company-province" placeholder="BC" value={form.province || ""} onChange={e => setForm((p: any) => ({ ...p, province: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-1">
                <Label>Postal / ZIP</Label>
                <Input data-testid="input-company-postal" placeholder="V8T 5L9" value={form.postalCode || ""} onChange={e => setForm((p: any) => ({ ...p, postalCode: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Company Phone</Label>
                <Input data-testid="input-company-phone" placeholder="+1 (250) 555-0100" value={form.companyPhone || ""} onChange={e => setForm((p: any) => ({ ...p, companyPhone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Company Email</Label>
                <Input type="email" data-testid="input-company-email" placeholder="info@company.com" value={form.companyEmail || ""} onChange={e => setForm((p: any) => ({ ...p, companyEmail: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Address and contact details appear on official pay stubs.</p>

            <div className="space-y-2">
              <Label>Google Review Link</Label>
              <div className="flex gap-2">
                <Input
                  data-testid="input-google-review-url"
                  type="url"
                  placeholder="https://g.page/r/your-business-review-link"
                  value={form.googleReviewUrl || ""}
                  onChange={e => setForm((p: any) => ({ ...p, googleReviewUrl: e.target.value }))}
                  className="flex-1"
                />
                {form.googleReviewUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(form.googleReviewUrl, "_blank", "noopener,noreferrer")}
                    title="Test Google Review Link"
                    data-testid="button-test-google-review-url"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Paste your Google Business Profile review link here. When set, a "Leave a Google review" button will appear on your public client reports.</p>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <p className="text-xs text-muted-foreground">Used for schedules, attendance, and payroll calculations</p>
              <Select
                value={form.timezone || "America/New_York"}
                onValueChange={v => setForm((p: any) => ({ ...p, timezone: v }))}
              >
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIMEZONES.map(group => (
                    <div key={group.group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.group}</div>
                      {group.options.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scheduling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Grace Period (minutes)</Label>
              <Input data-testid="input-grace-period" type="number" value={form.defaultGracePeriodMinutes} onChange={e => setForm((p: any) => ({ ...p, defaultGracePeriodMinutes: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Allow Unscheduled Clock-ins</Label><p className="text-xs text-muted-foreground mt-0.5">Let employees clock in without a scheduled shift</p></div>
              <Switch data-testid="switch-unscheduled" checked={form.allowUnscheduledClockIns} onCheckedChange={v => setForm((p: any) => ({ ...p, allowUnscheduledClockIns: v }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>Require Reports for All Shifts</Label></div>
              <Switch data-testid="switch-reports" checked={form.requireReports} onCheckedChange={v => setForm((p: any) => ({ ...p, requireReports: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Require Before Photos</Label></div>
              <Switch checked={form.requireBeforePhotos} onCheckedChange={v => setForm((p: any) => ({ ...p, requireBeforePhotos: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Require After Photos</Label></div>
              <Switch checked={form.requireAfterPhotos} onCheckedChange={v => setForm((p: any) => ({ ...p, requireAfterPhotos: v }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payroll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>Overtime Enabled</Label></div>
              <Switch data-testid="switch-overtime" checked={form.overtimeEnabled} onCheckedChange={v => setForm((p: any) => ({ ...p, overtimeEnabled: v }))} />
            </div>
            {form.overtimeEnabled && (
              <div className="space-y-2">
                <Label>Overtime Threshold (hours/week)</Label>
                <Input type="number" value={form.overtimeThresholdWeekly || 40} onChange={e => setForm((p: any) => ({ ...p, overtimeThresholdWeekly: parseInt(e.target.value) || 40 }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Pay Period</Label>
              <Select value={form.defaultPayPeriodType} onValueChange={v => setForm((p: any) => ({ ...p, defaultPayPeriodType: v }))}>
                <SelectTrigger data-testid="select-pay-period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payroll Cycle Start Date</Label>
              <p className="text-xs text-muted-foreground">The anchor date for biweekly pay period calculations (YYYY-MM-DD)</p>
              <Input
                data-testid="input-payroll-cycle-start"
                type="date"
                value={form.payrollCycleStartDate || ""}
                onChange={e => setForm((p: any) => ({ ...p, payrollCycleStartDate: e.target.value || null }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payroll Deductions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payroll Deductions</CardTitle>
            <CardDescription className="text-xs">
              Configure estimated Canadian payroll deductions. These are estimates only and do not replace official CRA payroll filing or remittances.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Estimated Deductions</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Apply deduction estimates to the payroll estimator</p>
              </div>
              <Switch
                data-testid="switch-deductions-enabled"
                checked={form.deductionsEnabled || false}
                onCheckedChange={v => setForm((p: any) => ({ ...p, deductionsEnabled: v }))}
              />
            </div>

            {form.deductionsEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Province</Label>
                  <Select value={form.provinceCode || "MB"} onValueChange={v => setForm((p: any) => ({ ...p, provinceCode: v }))}>
                    <SelectTrigger data-testid="select-province"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map(p => (
                        <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Deduction Rates</Label>

                  {[
                    { key: "federalTax", label: "Federal Tax", modeKey: "federalTaxMode", percentKey: "federalTaxPercent" },
                    { key: "provincialTax", label: "Provincial Tax", modeKey: "provincialTaxMode", percentKey: "provincialTaxPercent" },
                    { key: "cpp", label: "CPP", modeKey: "cppMode", percentKey: "cppPercent" },
                    { key: "ei", label: "EI", modeKey: "eiMode", percentKey: "eiPercent" },
                  ].map(({ key, label, modeKey, percentKey }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-32 flex-shrink-0">
                        <p className="text-sm font-medium">{label}</p>
                      </div>
                      <Select
                        value={form[modeKey] || "off"}
                        onValueChange={v => setForm((p: any) => ({ ...p, [modeKey]: v }))}
                      >
                        <SelectTrigger className="w-36" data-testid={`select-${key}-mode`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Off</SelectItem>
                          <SelectItem value="percent">Manual %</SelectItem>
                        </SelectContent>
                      </Select>
                      {(form[modeKey] || "off") === "percent" && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-24"
                            value={form[percentKey] ?? ""}
                            data-testid={`input-${key}-percent`}
                            onChange={e => setForm((p: any) => ({ ...p, [percentKey]: e.target.value }))}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Custom Deductions</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setAddingDeduction(true)}
                      data-testid="button-add-deduction"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </Button>
                  </div>

                  {addingDeduction && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                      <Input
                        placeholder="Label (e.g. Union Dues)"
                        className="flex-1 h-8 text-sm"
                        value={newDeduction.label}
                        onChange={e => setNewDeduction(p => ({ ...p, label: e.target.value }))}
                        data-testid="input-new-deduction-label"
                      />
                      <Select value={newDeduction.type} onValueChange={v => setNewDeduction(p => ({ ...p, type: v }))}>
                        <SelectTrigger className="w-28 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent</SelectItem>
                          <SelectItem value="fixed">Fixed $</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="w-20 h-8 text-sm"
                        value={newDeduction.value}
                        onChange={e => setNewDeduction(p => ({ ...p, value: e.target.value }))}
                        data-testid="input-new-deduction-value"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={addDeductionMut.isPending || !newDeduction.label}
                        onClick={() => addDeductionMut.mutate(newDeduction)}
                        data-testid="button-save-deduction"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => setAddingDeduction(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {deductionsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (customDeductions || []).length === 0 && !addingDeduction ? (
                    <p className="text-xs text-muted-foreground">No custom deductions. Add union dues, benefits, or other deductions.</p>
                  ) : (
                    <div className="space-y-2">
                      {(customDeductions || []).map((d: any) => (
                        <div key={d.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border bg-background" data-testid={`row-deduction-${d.id}`}>
                          <Switch
                            checked={d.isActive}
                            onCheckedChange={v => updateDeductionMut.mutate({ id: d.id, data: { isActive: v } })}
                            data-testid={`switch-deduction-${d.id}`}
                          />
                          <span className="flex-1 text-sm font-medium">{d.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {d.type === "percent" ? `${parseFloat(d.value).toFixed(2)}%` : `$${parseFloat(d.value).toFixed(2)}`}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => deleteDeductionMut.mutate(d.id)}
                            data-testid={`button-delete-deduction-${d.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Report Branding</CardTitle>
            <CardDescription className="text-xs">Customize how your public client reports look.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Logo</Label>
              {/* Hidden file input */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                data-testid="input-logo-file"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />

              {form.companyLogoUrl ? (
                /* Logo preview with replace / remove controls */
                <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/40">
                  <img
                    src={form.companyLogoUrl}
                    alt="Company logo"
                    className="h-12 max-w-[140px] object-contain rounded shrink-0"
                    onError={e => (e.currentTarget.style.display = "none")}
                  />
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                      data-testid="button-replace-logo"
                    >
                      {logoUploading ? "Uploading..." : "Replace Logo"}
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline text-left"
                      onClick={() => setForm((p: any) => ({ ...p, companyLogoUrl: null }))}
                      data-testid="button-remove-logo"
                    >
                      Remove logo
                    </button>
                  </div>
                </div>
              ) : (
                /* Upload prompt when no logo is set */
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={() => logoInputRef.current?.click()}
                  data-testid="button-upload-logo"
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-colors py-6 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">PNG, JPG, WEBP · Max 5 MB</span>
                </button>
              )}

              <p className="text-xs text-muted-foreground">Upload your company logo. It will appear in the header of your public service reports. Recommended: square or horizontal logo with transparent background.</p>
            </div>
            <div className="space-y-2">
              <Label>Brand Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  data-testid="input-brand-color"
                  value={form.brandColor || "#2563eb"}
                  onChange={e => setForm((p: any) => ({ ...p, brandColor: e.target.value }))}
                  className="h-9 w-14 rounded border border-input cursor-pointer p-0.5 bg-background"
                />
                <Input
                  placeholder="#2563eb"
                  value={form.brandColor || ""}
                  onChange={e => setForm((p: any) => ({ ...p, brandColor: e.target.value }))}
                  className="font-mono text-sm"
                  data-testid="input-brand-color-hex"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used as the header background color on your public service reports. Leave blank for default blue.</p>
            </div>
            <div className="space-y-2">
              <Label>Default Service Summary</Label>
              <Textarea
                data-testid="textarea-default-report-intro"
                placeholder="This report provides a summary of the work completed, observations recorded, and supporting service photos for this visit."
                value={form.defaultReportIntro || ""}
                onChange={e => setForm((p: any) => ({ ...p, defaultReportIntro: e.target.value }))}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">This intro text appears on all public reports before the work sections. Cleaners can override it per report.</p>
            </div>
          </CardContent>
        </Card>

        {/* Email Alert Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Email Alerts
            </CardTitle>
            <CardDescription>
              Choose which attendance events trigger email notifications to this account's admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Late Clock-In</p>
                <p className="text-xs text-muted-foreground">Email when an employee clocks in late</p>
              </div>
              <Switch
                data-testid="switch-alert-late-clock-in"
                checked={form.alertLateClockIn ?? false}
                onCheckedChange={v => setForm((p: any) => ({ ...p, alertLateClockIn: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Missed Shift</p>
                <p className="text-xs text-muted-foreground">Email when an employee misses a scheduled shift</p>
              </div>
              <Switch
                data-testid="switch-alert-missed-shift"
                checked={form.alertMissedShift ?? false}
                onCheckedChange={v => setForm((p: any) => ({ ...p, alertMissedShift: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Employee Clocked In</p>
                <p className="text-xs text-muted-foreground">Email when any employee clocks in</p>
              </div>
              <Switch
                data-testid="switch-alert-clocked-in"
                checked={form.alertEmployeeClockedIn ?? false}
                onCheckedChange={v => setForm((p: any) => ({ ...p, alertEmployeeClockedIn: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Employee Clocked Out</p>
                <p className="text-xs text-muted-foreground">Email when any employee clocks out</p>
              </div>
              <Switch
                data-testid="switch-alert-clocked-out"
                checked={form.alertEmployeeClockedOut ?? false}
                onCheckedChange={v => setForm((p: any) => ({ ...p, alertEmployeeClockedOut: v }))}
              />
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">Alert emails are sent to the primary admin email on file. Alerts are de-duplicated per event.</p>
          </CardContent>
        </Card>

        <Button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending} className="w-full" data-testid="button-save-settings">
          {updateMut.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
