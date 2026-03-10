import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Mail, Phone, DollarSign, KeyRound, UserCheck, UserX, RefreshCw, Copy, Users, Calendar, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hourlyRate?: string;
  isActive: boolean;
  loginEnabled?: boolean;
  accountStatus?: string;
  employeeId?: string;
  position?: string;
};

type AccessCredentials = {
  employeeId: string;
  tempPin: string;
};

type Shift = {
  id: string;
  shiftDate: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  shiftLabel?: string;
};

type TimeEntry = {
  id: string;
  clockInAt: string;
  clockOutAt?: string;
  workedMinutes?: number;
  status: string;
  flags?: string[];
};

type RecurringSchedule = {
  id: string;
  repeatFrequency: string;
  repeatDays: string[];
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: string;
};

function statusBadge(emp: Employee) {
  if (!emp.loginEnabled) return <Badge variant="outline" className="text-xs">Profile Only</Badge>;
  if (emp.accountStatus === "pending_activation") return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending Activation</Badge>;
  if (emp.accountStatus === "active") return <Badge variant="default" className="text-xs">Active</Badge>;
  if (emp.accountStatus === "disabled") return <Badge variant="destructive" className="text-xs">Disabled</Badge>;
  return <Badge variant="outline" className="text-xs">{emp.accountStatus || "Unknown"}</Badge>;
}

export default function AdminEmployees() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [credDialog, setCredDialog] = useState<AccessCredentials | null>(null);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", hourlyRate: "", position: "" });
  const [editData, setEditData] = useState<Partial<Employee>>({});

  const { data: employees, isLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  useEffect(() => {
    if (selectedEmployee) {
      setEditData({
        firstName: selectedEmployee.firstName,
        lastName: selectedEmployee.lastName,
        email: selectedEmployee.email || "",
        phone: selectedEmployee.phone || "",
        position: selectedEmployee.position || "",
        hourlyRate: selectedEmployee.hourlyRate || "",
        isActive: selectedEmployee.isActive
      });
    }
  }, [selectedEmployee]);

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", { employeeId: selectedEmployee?.id }],
    enabled: !!selectedEmployee
  });

  const { data: recurringSchedules } = useQuery<RecurringSchedule[]>({
    queryKey: ["/api/recurring-schedules", { employeeId: selectedEmployee?.id }],
    enabled: !!selectedEmployee
  });

  const { data: timeEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", { employeeId: selectedEmployee?.id }],
    enabled: !!selectedEmployee
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      const res = await apiRequest("PATCH", `/api/employees/${selectedEmployee?.id}`, data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setSelectedEmployee(updated);
      toast({ title: "Employee updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleaned = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        hourlyRate: data.hourlyRate || undefined,
        position: data.position || undefined,
      };
      const res = await apiRequest("POST", "/api/employees", cleaned);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee profile created" });
      setOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", hourlyRate: "", position: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const enableAccessMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/employees/${id}/enable-access`);
      return res.json();
    },
    onSuccess: (data: AccessCredentials) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setCredDialog(data);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/employees/${id}/reset-pin`);
      return res.json();
    },
    onSuccess: (data: { tempPin: string }, id: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      const emp = employees?.find(e => e.id === id);
      setCredDialog({ employeeId: emp?.employeeId || "", tempPin: data.tempPin });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const disableAccessMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/employees/${id}/disable-access`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Login access disabled" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (employees || []).filter(e =>
    `${e.firstName} ${e.lastName} ${e.email || ""} ${e.employeeId || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-employees-title">Employees</h1>
          <p className="text-muted-foreground text-sm mt-1">{employees?.length || 0} team members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee"><Plus className="w-4 h-4 mr-1.5" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input data-testid="input-emp-first" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input data-testid="input-emp-last" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input data-testid="input-emp-email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="worker@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input data-testid="input-emp-phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555-000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Position <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input data-testid="input-emp-position" value={formData.position} onChange={e => setFormData(p => ({ ...p, position: e.target.value }))} placeholder="Cleaner, Supervisor..." />
              </div>
              <div className="space-y-2">
                <Label>Hourly Rate ($) <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input data-testid="input-emp-rate" type="number" step="0.01" value={formData.hourlyRate} onChange={e => setFormData(p => ({ ...p, hourlyRate: e.target.value }))} placeholder="0.00" />
              </div>
              <p className="text-xs text-muted-foreground">
                After creating the profile, you can enable login access from the employee card.
              </p>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-employee">
                {createMutation.isPending ? "Creating..." : "Create Employee Profile"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search-employees" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No employees found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((emp: Employee) => (
            <Card
              key={emp.id}
              data-testid={`card-employee-${emp.id}`}
              className="cursor-pointer hover-elevate transition-shadow"
              onClick={() => setSelectedEmployee(emp)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-sm">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{emp.firstName} {emp.lastName}</p>
                      {statusBadge(emp)}
                    </div>
                    {emp.employeeId && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{emp.employeeId}</p>
                    )}
                    {emp.position && (
                      <p className="text-xs text-muted-foreground mt-0.5">{emp.position}</p>
                    )}
                    {emp.email && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                      </div>
                    )}
                    {emp.phone && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{emp.phone}</p>
                      </div>
                    )}
                    {emp.hourlyRate && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <DollarSign className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">${emp.hourlyRate}/hr</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {!emp.loginEnabled ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      data-testid={`button-enable-access-${emp.id}`}
                      disabled={enableAccessMutation.isPending}
                      onClick={() => enableAccessMutation.mutate(emp.id)}
                    >
                      <UserCheck className="w-3 h-3" />
                      Enable Login Access
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        data-testid={`button-reset-pin-${emp.id}`}
                        disabled={resetPinMutation.isPending}
                        onClick={() => resetPinMutation.mutate(emp.id)}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset PIN
                      </Button>
                      {emp.accountStatus !== "disabled" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                          data-testid={`button-disable-access-${emp.id}`}
                          disabled={disableAccessMutation.isPending}
                          onClick={() => disableAccessMutation.mutate(emp.id)}
                        >
                          <UserX className="w-3 h-3" />
                          Disable Access
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1"
                          data-testid={`button-enable-access-re-${emp.id}`}
                          disabled={enableAccessMutation.isPending}
                          onClick={() => enableAccessMutation.mutate(emp.id)}
                        >
                          <UserCheck className="w-3 h-3" />
                          Re-enable Access
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
}

      <Sheet open={!!selectedEmployee} onOpenChange={(v) => !v && setSelectedEmployee(null)}>
        <SheetContent className="sm:max-w-xl w-full p-0">
          {selectedEmployee && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-6 border-b">
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary/10 text-lg">
                      {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-xl">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedEmployee.employeeId && (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {selectedEmployee.employeeId}
                        </code>
                      )}
                      {statusBadge(selectedEmployee)}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="overview" className="flex-1 flex flex-col">
                <div className="px-6 border-b">
                  <TabsList className="w-full justify-start h-12 bg-transparent gap-6 p-0">
                    <TabsTrigger
                      value="overview"
                      className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0"
                    >
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="schedule"
                      className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0"
                    >
                      Schedule
                    </TabsTrigger>
                    <TabsTrigger
                      value="attendance"
                      className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0"
                    >
                      Attendance
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <TabsContent value="overview" className="mt-0 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input
                            value={editData.firstName}
                            onChange={(e) => setEditData((p) => ({ ...p, firstName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input
                            value={editData.lastName}
                            onChange={(e) => setEditData((p) => ({ ...p, lastName: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editData.email}
                          onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={editData.phone}
                          onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Position</Label>
                        <Input
                          value={editData.position}
                          onChange={(e) => setEditData((p) => ({ ...p, position: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Hourly Rate ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editData.hourlyRate}
                          onChange={(e) => setEditData((p) => ({ ...p, hourlyRate: e.target.value }))}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="space-y-0.5">
                          <Label>Active Status</Label>
                          <p className="text-xs text-muted-foreground">Is this employee currently active?</p>
                        </div>
                        <Switch
                          checked={editData.isActive}
                          onCheckedChange={(checked) => setEditData((p) => ({ ...p, isActive: checked }))}
                        />
                      </div>

                      <Button
                        className="w-full"
                        onClick={() => updateMutation.mutate(editData)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </TabsContent>

                    <TabsContent value="schedule" className="mt-0 space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Recurring Schedules
                        </h3>
                        {!recurringSchedules?.length ? (
                          <p className="text-xs text-muted-foreground py-4 text-center border rounded-md border-dashed">
                            No active recurring schedules
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {recurringSchedules.map((s) => (
                              <Card key={s.id} className="bg-muted/30">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium capitalize">{s.repeatFrequency}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {s.repeatDays.join(", ").toUpperCase()}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-mono">{s.scheduledStartTime} - {s.scheduledEndTime}</p>
                                      <Badge variant="outline" className="text-[10px] h-4 mt-1">
                                        {s.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Upcoming Shifts
                        </h3>
                        {!shifts?.length ? (
                          <p className="text-xs text-muted-foreground py-4 text-center border rounded-md border-dashed">
                            No upcoming shifts found
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {shifts
                              .filter(s => s.status === "scheduled")
                              .slice(0, 10)
                              .map((s) => (
                                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                  <div>
                                    <p className="text-sm font-medium">{format(new Date(s.shiftDate), "EEE, MMM d")}</p>
                                    {s.shiftLabel && <p className="text-xs text-muted-foreground">{s.shiftLabel}</p>}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-mono">
                                      {format(new Date(s.scheduledStartAt), "h:mm a")} - {format(new Date(s.scheduledEndAt), "h:mm a")}
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="attendance" className="mt-0 space-y-6">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 border rounded-lg bg-muted/30 text-center">
                          <p className="text-2xl font-bold">{timeEntries?.filter(e => e.status === "completed").length || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Shifts</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-muted/30 text-center">
                          <p className="text-2xl font-bold text-amber-600">
                            {timeEntries?.filter(e => e.flags?.includes("late_clock_in")).length || 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">Late</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-muted/30 text-center">
                          <p className="text-2xl font-bold text-primary">
                            {timeEntries?.length 
                              ? Math.round((timeEntries.filter(e => !e.flags?.includes("late_clock_in")).length / timeEntries.length) * 100) 
                              : 0}%
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">Rate</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Recent Activity</h3>
                        {!timeEntries?.length ? (
                          <p className="text-xs text-muted-foreground py-4 text-center border rounded-md border-dashed">
                            No attendance history
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {timeEntries.slice(0, 10).map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                <div className="flex items-center gap-3">
                                  {entry.flags?.includes("late_clock_in") ? (
                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                  ) : entry.status === "completed" ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-primary animate-pulse" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{format(new Date(entry.clockInAt), "MMM d, yyyy")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(entry.clockInAt), "h:mm a")} - {entry.clockOutAt ? format(new Date(entry.clockOutAt), "h:mm a") : "Active"}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">
                                    {entry.workedMinutes ? `${Math.floor(entry.workedMinutes / 60)}h ${entry.workedMinutes % 60}m` : "--"}
                                  </p>
                                  {entry.flags?.map(f => (
                                    <Badge key={f} variant="outline" className="text-[9px] h-3.5 px-1 ml-1 bg-amber-50 text-amber-700 border-amber-200">
                                      {f.replace(/_/g, " ")}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!credDialog} onOpenChange={(v) => { if (!v) setCredDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Login Access Enabled
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Give these credentials to the employee. They will be asked to set a new password on first login.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Employee ID</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted rounded px-3 py-2 text-sm font-mono" data-testid="text-cred-employee-id">
                    {credDialog?.employeeId}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => copyToClipboard(credDialog?.employeeId || "", "Employee ID")}
                    data-testid="button-copy-employee-id"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Temporary PIN</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted rounded px-3 py-2 text-sm font-mono tracking-widest" data-testid="text-cred-temp-pin">
                    {credDialog?.tempPin}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => copyToClipboard(credDialog?.tempPin || "", "Temporary PIN")}
                    data-testid="button-copy-temp-pin"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-muted/50 border p-3">
              <p className="text-xs text-muted-foreground">
                The employee logs in at the <strong>Employee</strong> tab on the login page using their Employee ID and this temporary PIN.
              </p>
            </div>
            <Button className="w-full" onClick={() => setCredDialog(null)} data-testid="button-close-credentials">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
