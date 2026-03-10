import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export default function AdminSettings() {
  const { toast } = useToast();
  const { data: company, isLoading } = useQuery<any>({ queryKey: ["/api/company"] });
  const [form, setForm] = useState<any>(null);

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
              <Input data-testid="input-company-name" value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input data-testid="input-timezone" value={form.timezone} onChange={e => setForm((p: any) => ({ ...p, timezone: e.target.value }))} />
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

        <Button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending} className="w-full" data-testid="button-save-settings">
          {updateMut.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
