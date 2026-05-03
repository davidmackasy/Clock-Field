import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UpgradeModal, parsePlanLimitError, type UpgradeReason } from "@/components/upgrade-modal";
import { EmployeeAttendanceModal } from "@/components/employee-attendance-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { parseApiError } from "@/lib/parse-error";
import {
  Plus, Search, Mail, Phone, DollarSign, KeyRound, UserCheck, UserX, RefreshCw, Copy, Users,
  Calendar, Clock, CheckCircle2, AlertCircle, FileText, Upload, Download, Trash2, Eye, Pencil,
  GraduationCap, Award, Loader2, X, Briefcase, FileIcon, Image as ImageIcon, FileType,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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

type AccessCredentials = { employeeId: string; tempPin: string };

type Shift = {
  id: string;
  employeeId: string;
  shiftDate: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  shiftLabel?: string;
};

type TimeEntry = {
  id: string;
  employeeId: string;
  clockInAt: string;
  clockOutAt?: string;
  workedMinutes?: number;
  status: string;
  flags?: string[];
};

type RecurringSchedule = {
  id: string;
  employeeId: string;
  repeatFrequency: string;
  repeatDays: string[];
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: string;
};

type EmployeeDocument = {
  id: string;
  employeeId: string;
  name: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  notes?: string | null;
  uploadedBy: string;
  uploadedAt: string;
};

type TrainingSummaryItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  isRequired: boolean;
  totalModules: number;
  completedModules: number;
  progressPct: number;
  isCompleted: boolean;
  status: "not_started" | "in_progress" | "completed";
  certificate: { certificateCode: string; issuedAt: string } | null;
};

const DOCUMENT_CATEGORIES = [
  { value: "id", label: "ID / Identification" },
  { value: "certification", label: "Certification" },
  { value: "contract", label: "Contract" },
  { value: "tax", label: "Tax Form" },
  { value: "resume", label: "Resume" },
  { value: "other", label: "Other" },
];

function statusBadge(emp: Employee) {
  if (!emp.loginEnabled) return <Badge variant="outline" className="text-xs">Profile Only</Badge>;
  if (emp.accountStatus === "pending_activation") return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending Activation</Badge>;
  if (emp.accountStatus === "active") return <Badge variant="default" className="text-xs">Active</Badge>;
  if (emp.accountStatus === "disabled") return <Badge variant="destructive" className="text-xs">Disabled</Badge>;
  return <Badge variant="outline" className="text-xs">{emp.accountStatus || "Unknown"}</Badge>;
}

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function fileIconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileType;
  return FileIcon;
}

function categoryLabel(value: string) {
  return DOCUMENT_CATEGORIES.find(c => c.value === value)?.label || value;
}

export default function AdminEmployees() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [credDialog, setCredDialog] = useState<AccessCredentials | null>(null);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", hourlyRate: "", position: "" });
  const [editData, setEditData] = useState<Partial<Employee>>({});
  const [attendanceModalEmployee, setAttendanceModalEmployee] = useState<Employee | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>(null);
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [profileMode, setProfileMode] = useState<"view" | "edit">("view");
  const [uploadOpen, setUploadOpen] = useState(false);

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
        isActive: selectedEmployee.isActive,
      });
      setActiveTab("profile");
      setProfileMode("view");
    }
  }, [selectedEmployee?.id]);

  const { data: allShifts } = useQuery<Shift[]>({ queryKey: ["/api/shifts"] });
  const { data: allRecurringSchedules } = useQuery<RecurringSchedule[]>({ queryKey: ["/api/recurring-schedules"] });
  const { data: allTimeEntries } = useQuery<TimeEntry[]>({ queryKey: ["/api/time-entries"] });

  const shifts = allShifts?.filter(s => s.employeeId === selectedEmployee?.id);
  const recurringSchedules = allRecurringSchedules?.filter(s => s.employeeId === selectedEmployee?.id);
  const timeEntries = allTimeEntries?.filter(e => e.employeeId === selectedEmployee?.id);

  // Lazy queries — only fetch when their tab is active
  const { data: documents, isLoading: documentsLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ["/api/employees", selectedEmployee?.id, "documents"],
    enabled: !!selectedEmployee && activeTab === "documents",
  });

  const { data: trainingSummary, isLoading: trainingLoading } = useQuery<TrainingSummaryItem[]>({
    queryKey: ["/api/employees", selectedEmployee?.id, "training"],
    enabled: !!selectedEmployee && activeTab === "training",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      const res = await apiRequest("PATCH", `/api/employees/${selectedEmployee?.id}`, data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setSelectedEmployee(updated);
      setProfileMode("view");
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
      const limitReason = parsePlanLimitError(err);
      if (limitReason) {
        setOpen(false);
        setUpgradeReason(limitReason);
      } else {
        const { title, description } = parseApiError(err);
        toast({ title, description, variant: "error" } as any);
      }
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

  const uploadDocumentMutation = useMutation({
    mutationFn: async (payload: { name: string; category: string; mimeType: string; sizeBytes: number; fileData: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/employees/${selectedEmployee?.id}/documents`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", selectedEmployee?.id, "documents"] });
      setUploadOpen(false);
      toast({ title: "Document uploaded" });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await apiRequest("DELETE", `/api/employees/${selectedEmployee?.id}/documents/${docId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", selectedEmployee?.id, "documents"] });
      toast({ title: "Document deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => (employees || []).filter(e =>
    `${e.firstName} ${e.lastName} ${e.email || ""} ${e.employeeId || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [employees, search]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  // Fetch a document with file data and open it in a new tab (view) or trigger download
  const openDocument = async (doc: EmployeeDocument, asDownload: boolean) => {
    try {
      const res = await apiRequest("GET", `/api/employees/${selectedEmployee?.id}/documents/${doc.id}`);
      const full = await res.json();
      const byteString = atob(full.fileData);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
      const blob = new Blob([bytes], { type: full.mimeType });
      const url = URL.createObjectURL(blob);
      if (asDownload) {
        const a = document.createElement("a");
        a.href = url;
        a.download = full.name || "document";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      // Revoke after a delay so the new tab/download has time to load
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err: any) {
      toast({ title: "Could not open document", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveProfile = () => {
    const rateRaw = editData.hourlyRate;
    let hourlyRate: number | null;
    if (rateRaw === "" || rateRaw === undefined || rateRaw === null) {
      hourlyRate = null;
    } else {
      const n = Number(rateRaw);
      if (isNaN(n)) {
        toast({ title: "Invalid hourly rate", description: "Please enter a valid number or leave it blank.", variant: "destructive" });
        return;
      }
      hourlyRate = n;
    }
    updateMutation.mutate({ ...editData, hourlyRate: hourlyRate as any });
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
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
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
              className="cursor-pointer hover-elevate active-elevate-2 transition-all border-border/60 group"
              onClick={() => setSelectedEmployee(emp)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-11 h-11 flex-shrink-0 ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all">
                    <AvatarFallback className="bg-primary/10 text-sm font-medium">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" data-testid={`text-employee-name-${emp.id}`}>
                          {emp.firstName} {emp.lastName}
                        </p>
                        {emp.position && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {emp.position}
                          </p>
                        )}
                      </div>
                      {statusBadge(emp)}
                    </div>
                    {emp.employeeId && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-1.5">{emp.employeeId}</p>
                    )}
                    <div className="mt-1.5 space-y-0.5">
                      {emp.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                        </div>
                      )}
                      {emp.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                          <p className="text-xs text-muted-foreground">{emp.phone}</p>
                        </div>
                      )}
                      {emp.hourlyRate && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                          <p className="text-xs text-muted-foreground">${emp.hourlyRate}/hr</p>
                        </div>
                      )}
                    </div>
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
      )}

      <Sheet open={!!selectedEmployee} onOpenChange={(v) => !v && setSelectedEmployee(null)}>
        <SheetContent className="sm:max-w-2xl w-full p-0">
          {selectedEmployee && (
            <div className="flex flex-col h-full overflow-hidden">
              <SheetHeader className="p-4 sm:p-6 border-b">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="w-12 h-12 sm:w-14 sm:h-14">
                    <AvatarFallback className="bg-primary/10 text-base sm:text-lg font-semibold">
                      {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg sm:text-xl truncate">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedEmployee.employeeId && (
                        <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
                          {selectedEmployee.employeeId}
                        </code>
                      )}
                      {statusBadge(selectedEmployee)}
                      {selectedEmployee.position && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">• {selectedEmployee.position}</span>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="border-b">
                  <ScrollArea className="w-full">
                    <TabsList className="w-full justify-start h-12 bg-transparent gap-4 sm:gap-6 px-4 sm:px-6 rounded-none">
                      <TabsTrigger value="profile" data-testid="tab-profile" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 whitespace-nowrap">Profile</TabsTrigger>
                      <TabsTrigger value="schedule" data-testid="tab-schedule" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 whitespace-nowrap">Schedule</TabsTrigger>
                      <TabsTrigger value="attendance" data-testid="tab-attendance" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 whitespace-nowrap">Attendance</TabsTrigger>
                      <TabsTrigger value="documents" data-testid="tab-documents" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 whitespace-nowrap">Documents</TabsTrigger>
                      <TabsTrigger value="training" data-testid="tab-training" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 whitespace-nowrap">Training</TabsTrigger>
                    </TabsList>
                  </ScrollArea>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 sm:p-6">

                    {/* ── Profile tab ─────────────────────────────────────── */}
                    <TabsContent value="profile" className="mt-0 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Personal Information</h3>
                        {profileMode === "view" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid="button-edit-profile"
                            onClick={() => setProfileMode("edit")}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid="button-cancel-edit-profile"
                            onClick={() => {
                              setEditData({
                                firstName: selectedEmployee.firstName,
                                lastName: selectedEmployee.lastName,
                                email: selectedEmployee.email || "",
                                phone: selectedEmployee.phone || "",
                                position: selectedEmployee.position || "",
                                hourlyRate: selectedEmployee.hourlyRate || "",
                                isActive: selectedEmployee.isActive,
                              });
                              setProfileMode("view");
                            }}
                          >
                            <X className="w-3.5 h-3.5 mr-1.5" />
                            Cancel
                          </Button>
                        )}
                      </div>

                      {profileMode === "view" ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ProfileField label="First Name" value={selectedEmployee.firstName} testId="text-profile-firstName" />
                            <ProfileField label="Last Name" value={selectedEmployee.lastName} testId="text-profile-lastName" />
                          </div>
                          <ProfileField label="Email" value={selectedEmployee.email || "—"} testId="text-profile-email" />
                          <ProfileField label="Phone" value={selectedEmployee.phone || "—"} testId="text-profile-phone" />
                          <ProfileField label="Position" value={selectedEmployee.position || "—"} testId="text-profile-position" />
                          <ProfileField
                            label="Hourly Rate"
                            value={selectedEmployee.hourlyRate ? `$${selectedEmployee.hourlyRate}/hr` : "—"}
                            testId="text-profile-rate"
                          />
                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                            <div>
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Active Status</Label>
                              <p className="text-sm mt-1">
                                {selectedEmployee.isActive ? "Currently active" : "Inactive"}
                              </p>
                            </div>
                            <Badge variant={selectedEmployee.isActive ? "default" : "outline"}>
                              {selectedEmployee.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>First Name</Label>
                              <Input
                                data-testid="input-edit-firstName"
                                value={editData.firstName || ""}
                                onChange={(e) => setEditData((p) => ({ ...p, firstName: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Last Name</Label>
                              <Input
                                data-testid="input-edit-lastName"
                                value={editData.lastName || ""}
                                onChange={(e) => setEditData((p) => ({ ...p, lastName: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              data-testid="input-edit-email"
                              type="email"
                              value={editData.email || ""}
                              onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                              data-testid="input-edit-phone"
                              value={editData.phone || ""}
                              onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Position</Label>
                            <Input
                              data-testid="input-edit-position"
                              value={editData.position || ""}
                              onChange={(e) => setEditData((p) => ({ ...p, position: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Hourly Rate ($)</Label>
                            <Input
                              data-testid="input-edit-rate"
                              type="number"
                              step="0.01"
                              value={editData.hourlyRate || ""}
                              onChange={(e) => setEditData((p) => ({ ...p, hourlyRate: e.target.value }))}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                            <div className="space-y-0.5">
                              <Label>Active Status</Label>
                              <p className="text-xs text-muted-foreground">Is this employee currently active?</p>
                            </div>
                            <Switch
                              data-testid="switch-edit-active"
                              checked={editData.isActive}
                              onCheckedChange={(checked) => setEditData((p) => ({ ...p, isActive: checked }))}
                            />
                          </div>
                          <Button
                            className="w-full"
                            data-testid="button-save-profile"
                            onClick={handleSaveProfile}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── Schedule tab (preserved) ─────────────────────────── */}
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

                    {/* ── Attendance tab (preserved) ───────────────────────── */}
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

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid="button-view-full-attendance"
                        onClick={() => setAttendanceModalEmployee(selectedEmployee)}
                      >
                        View Full Attendance
                      </Button>

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

                    {/* ── Documents tab (NEW) ──────────────────────────────── */}
                    <TabsContent value="documents" className="mt-0 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Documents
                        </h3>
                        <Button
                          size="sm"
                          data-testid="button-upload-document"
                          onClick={() => setUploadOpen(true)}
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Upload
                        </Button>
                      </div>

                      {documentsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : !documents?.length ? (
                        <div className="border border-dashed rounded-lg p-8 text-center">
                          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Upload IDs, certifications, contracts, and other employee files.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {documents.map((doc) => {
                            const Icon = fileIconFor(doc.mimeType);
                            return (
                              <div
                                key={doc.id}
                                data-testid={`row-document-${doc.id}`}
                                className="flex items-center gap-3 p-3 border rounded-lg bg-card hover-elevate transition-all"
                              >
                                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" data-testid={`text-document-name-${doc.id}`}>{doc.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                      {categoryLabel(doc.category)}
                                    </Badge>
                                    <span>{formatBytes(doc.sizeBytes)}</span>
                                    <span>•</span>
                                    <span>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                                  </div>
                                  {doc.notes && (
                                    <p className="text-xs text-muted-foreground/80 mt-1 truncate">{doc.notes}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    data-testid={`button-view-document-${doc.id}`}
                                    onClick={() => openDocument(doc, false)}
                                    title="View"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    data-testid={`button-download-document-${doc.id}`}
                                    onClick={() => openDocument(doc, true)}
                                    title="Download"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    data-testid={`button-delete-document-${doc.id}`}
                                    onClick={() => {
                                      if (confirm(`Delete "${doc.name}"? This cannot be undone.`)) {
                                        deleteDocumentMutation.mutate(doc.id);
                                      }
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── Training tab (NEW, read-only) ────────────────────── */}
                    <TabsContent value="training" className="mt-0 space-y-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        Training Progress
                      </h3>

                      {trainingLoading ? (
                        <div className="space-y-2">
                          {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
                        </div>
                      ) : !trainingSummary?.length ? (
                        <div className="border border-dashed rounded-lg p-8 text-center">
                          <GraduationCap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No training assigned</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Assign training from the Training Hub. Published company-wide courses appear here automatically.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 border rounded-lg bg-muted/30 text-center">
                              <p className="text-2xl font-bold" data-testid="text-training-total">{trainingSummary.length}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">Courses</p>
                            </div>
                            <div className="p-3 border rounded-lg bg-muted/30 text-center">
                              <p className="text-2xl font-bold text-green-600" data-testid="text-training-completed">
                                {trainingSummary.filter(t => t.certificate).length}
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase">Completed</p>
                            </div>
                            <div className="p-3 border rounded-lg bg-muted/30 text-center">
                              <p className="text-2xl font-bold text-primary" data-testid="text-training-in-progress">
                                {trainingSummary.filter(t => t.status === "in_progress").length}
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase">In Progress</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {trainingSummary.map((course) => {
                              const passed = course.certificate !== null;
                              const effectivePct = passed ? 100 : course.progressPct;
                              return (
                                <div
                                  key={course.id}
                                  data-testid={`row-training-${course.id}`}
                                  className="p-3 border rounded-lg bg-card space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium" data-testid={`text-training-title-${course.id}`}>{course.title}</p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {course.category && (
                                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{course.category}</Badge>
                                        )}
                                        {course.isRequired && (
                                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Required</Badge>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                          {course.completedModules}/{course.totalModules} modules
                                        </span>
                                      </div>
                                    </div>
                                    {passed ? (
                                      <Badge variant="default" className="text-[10px] h-5 gap-1 bg-green-600 hover:bg-green-600">
                                        <Award className="w-3 h-3" /> Certified
                                      </Badge>
                                    ) : course.status === "in_progress" ? (
                                      <Badge variant="secondary" className="text-[10px] h-5">In Progress</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] h-5">Not Started</Badge>
                                    )}
                                  </div>
                                  <Progress value={effectivePct} className="h-1.5" />
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{effectivePct}% complete</span>
                                    {course.certificate && (
                                      <span className="font-mono text-[10px]">
                                        Cert {course.certificate.certificateCode} · {format(new Date(course.certificate.issuedAt), "MMM d, yyyy")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </TabsContent>

                  </div>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Document Upload Dialog */}
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={(payload) => uploadDocumentMutation.mutate(payload)}
        isUploading={uploadDocumentMutation.isPending}
      />

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

      {attendanceModalEmployee && (
        <EmployeeAttendanceModal
          employee={attendanceModalEmployee}
          entries={allTimeEntries || []}
          shifts={allShifts || []}
          onClose={() => setAttendanceModalEmployee(null)}
        />
      )}

      <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
    </div>
  );
}

function ProfileField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium" data-testid={testId}>{value}</p>
    </div>
  );
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  onUpload,
  isUploading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpload: (payload: { name: string; category: string; mimeType: string; sizeBytes: number; fileData: string; notes?: string }) => void;
  isUploading: boolean;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setFile(null);
      setName("");
      setCategory("other");
      setNotes("");
    }
  }, [open]);

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (f && !name) setName(f.name);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "Choose a file", variant: "destructive" });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 30MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is a data URL: "data:<mime>;base64,<data>"
      const base64 = result.split(",")[1] || "";
      onUpload({
        name: name.trim() || file.name,
        category,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        fileData: base64,
        notes: notes.trim() || undefined,
      });
    };
    reader.onerror = () => {
      toast({ title: "Could not read file", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a file to this employee's profile. Maximum size 30MB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>File</Label>
            <Input
              type="file"
              data-testid="input-document-file"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              required
            />
            {file && (
              <p className="text-xs text-muted-foreground">{file.name} · {formatBytes(file.size)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              data-testid="input-document-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Driver's License"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-document-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              data-testid="textarea-document-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Expiration date, reference info..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading || !file} data-testid="button-confirm-upload">
              {isUploading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-1.5" />Upload</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
