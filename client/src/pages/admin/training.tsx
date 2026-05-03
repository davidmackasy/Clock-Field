import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, BookOpen, Users, Trophy, Clock, ChevronRight, Pencil, Trash2,
  Globe, Lock, Copy, ExternalLink, Play, FileText, Image, CheckCircle2,
  BarChart3, Loader2, X, GripVertical, Eye, EyeOff, Award, Search,
  ChevronDown, ChevronUp, Upload, AlertCircle, Check, ShieldCheck,
  Sparkles, Wrench, GraduationCap, HeartHandshake,
} from "lucide-react";

type Course = {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnailData: string | null;
  isRequired: boolean;
  isPublished: boolean;
  publicLinkEnabled: boolean;
  publicId: string | null;
  certificateEnabled: boolean;
  estimatedDuration: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  moduleCount?: number;
  assignedCount?: number;
  completedCount?: number;
  modules?: { id: string; title: string; sortOrder: number; completedCount: number }[];
  activeLearners?: { employeeId: string; name: string; initials: string; currentModuleIndex: number }[];
  cohortProgress?: number;
};

type Module = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  youtubeUrl: string | null;
  youtubeEmbedId: string | null;
  lessonText: string | null;
  sortOrder: number;
  isRequired: boolean;
  assets: { id: string; assetData: string; assetType: string; sortOrder: number }[];
};

type CourseDetail = {
  course: Course;
  modules: Module[];
  assignments: any[];
  completions: any[];
  stats: { assigned: number; started: number; completed: number; completionPct: number };
};

type Employee = { id: string; firstName: string; lastName: string; email: string; position: string | null };

const CATEGORIES = ["Onboarding", "Safety", "Cleaning Techniques", "Equipment", "Customer Service", "Compliance", "Leadership", "Other"];

function parseYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const CATEGORY_ICONS: Record<string, any> = {
  Onboarding: GraduationCap,
  Safety: ShieldCheck,
  "Cleaning Techniques": Sparkles,
  Equipment: Wrench,
  "Customer Service": HeartHandshake,
  Compliance: ShieldCheck,
  Leadership: Trophy,
  Other: BookOpen,
};

const LEARNER_PALETTE = [
  "bg-rose-400", "bg-amber-400", "bg-sky-400",
  "bg-violet-400", "bg-emerald-400", "bg-pink-400",
];
function colorForLearner(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return LEARNER_PALETTE[h % LEARNER_PALETTE.length];
}
function shortName(s: string) {
  if (!s) return "";
  const w = s.split(/\s+/)[0] ?? s;
  return w.length > 7 ? w.slice(0, 7) : w;
}

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[course.category ?? "Other"] ?? BookOpen;
  const modules = course.modules ?? [];
  const activeLearners = course.activeLearners ?? [];
  const moduleCount = course.moduleCount ?? 0;
  const assignedCount = course.assignedCount ?? 0;
  const cohortProgress = course.cohortProgress ?? 0;
  const totalLearners = assignedCount;

  const MAX_DOTS = 8;
  const displayModules = modules.slice(0, MAX_DOTS);
  const overflow = modules.length - displayModules.length;

  return (
    <div
      className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all group"
      onClick={onClick}
      data-testid={`card-course-${course.id}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors" data-testid={`text-course-title-${course.id}`}>
            {course.title}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {course.category ?? "Uncategorized"} · {moduleCount} module{moduleCount === 1 ? "" : "s"} · {assignedCount} learner{assignedCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-right shrink-0" data-testid={`text-cohort-progress-${course.id}`}>
          <div className="text-2xl font-bold text-foreground leading-none tabular-nums">{cohortProgress}%</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">cohort</div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center flex-wrap gap-1 mt-3">
        {course.isPublished
          ? <Badge className="bg-green-500 text-white text-[10px] h-5 px-1.5">Published</Badge>
          : <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Draft</Badge>}
        {course.isRequired && <Badge className="bg-red-500 text-white text-[10px] h-5 px-1.5">Required</Badge>}
        {course.publicLinkEnabled && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
            <Globe className="w-2.5 h-2.5" />Public
          </Badge>
        )}
        {course.estimatedDuration && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
            <Clock className="w-2.5 h-2.5" />{course.estimatedDuration}
          </Badge>
        )}
      </div>

      {/* Module path */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mt-5 mb-3">
        Module path
      </div>
      {modules.length === 0 ? (
        <div className="py-6 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground" data-testid={`empty-modules-${course.id}`}>
          No modules yet — open to add the first one
        </div>
      ) : (
        <div className="relative px-1 pt-2 pb-1">
          {/* Connecting line */}
          <div className="absolute left-3 right-3 top-[14px] h-[2px] bg-border">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${cohortProgress}%` }}
            />
          </div>
          {/* Checkpoints */}
          <div className="relative flex justify-between items-start gap-1">
            {displayModules.map((m, i) => {
              const pct = totalLearners > 0 ? m.completedCount / totalLearners : 0;
              const isDone = totalLearners > 0 && pct >= 0.95;
              const isActive = pct > 0.1 && pct < 0.95;
              const isLocked = !isDone && !isActive;
              return (
                <div key={m.id} className="flex flex-col items-center gap-1.5 flex-1 min-w-0" data-testid={`module-dot-${m.id}`}>
                  <div className={`relative z-10 h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isDone
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isActive
                      ? "bg-card border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm"
                      : "bg-card border-border text-muted-foreground"
                  }`}>
                    {isDone ? <Check className="w-3.5 h-3.5" /> : isLocked && totalLearners > 0 ? <Lock className="w-3 h-3" /> : i + 1}
                  </div>
                  <div className={`text-[10px] text-center leading-tight truncate w-full ${isLocked ? "text-muted-foreground" : "text-foreground"}`} title={m.title}>
                    {shortName(m.title)}
                  </div>
                  <div className="text-[9px] text-muted-foreground tabular-nums">
                    {m.completedCount}/{totalLearners}
                  </div>
                </div>
              );
            })}
            {overflow > 0 && (
              <div className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 36 }}>
                <div className="relative z-10 h-7 w-7 rounded-full border-2 bg-card border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                  +{overflow}
                </div>
                <div className="text-[10px] text-muted-foreground">more</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-flight learners */}
      {activeLearners.length > 0 ? (
        <div className="mt-5 rounded-lg bg-muted/40 border border-border px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="text-[11px] font-medium text-foreground">Currently in flight</div>
            <div className="ml-auto text-[11px] text-muted-foreground">{activeLearners.length} active</div>
          </div>
          <div className="space-y-1.5">
            {activeLearners.map((l) => {
              const color = colorForLearner(l.employeeId);
              const moduleAt = modules[l.currentModuleIndex];
              const pct = moduleCount > 0 ? (l.currentModuleIndex / moduleCount) * 100 : 0;
              return (
                <div key={l.employeeId} className="flex items-center gap-2.5" data-testid={`learner-flight-${l.employeeId}`}>
                  <div className={`h-6 w-6 rounded-full ${color} text-white text-[10px] font-semibold flex items-center justify-center shrink-0`} title={l.name}>
                    {l.initials}
                  </div>
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div className={`h-full ${color} opacity-80`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums w-14 text-right truncate" title={moduleAt?.title ?? "Done"}>
                    {moduleAt ? shortName(moduleAt.title) : "Done"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : assignedCount === 0 ? (
        <div className="mt-5 rounded-lg bg-muted/30 border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground" data-testid={`empty-learners-${course.id}`}>
          No learners enrolled yet
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-muted/30 border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
          {assignedCount} enrolled · waiting to start
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-muted-foreground hover:text-foreground justify-between pointer-events-none" tabIndex={-1}>
        <span>Walk the path</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function AdminTrainingHub() {
  const { toast } = useToast();
  const [view, setView] = useState<"grid" | "detail">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const thumbnailRef = useRef<HTMLInputElement>(null);

  // Course form state
  const [courseForm, setCourseForm] = useState({
    title: "", description: "", category: "", estimatedDuration: "",
    isRequired: false, publicLinkEnabled: false, certificateEnabled: true,
    thumbnailData: "",
  });

  // Module editing
  const [editingModule, setEditingModule] = useState<Partial<Module> | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const assetRef = useRef<HTMLInputElement>(null);

  const { data: courses = [], isLoading } = useQuery<Course[]>({ queryKey: ["/api/training/courses"] });
  const { data: stats } = useQuery<{ totalCourses: number; totalAssigned: number; totalCompleted: number; totalPending: number }>({
    queryKey: ["/api/training/stats"],
  });
  const { data: detail, isLoading: detailLoading } = useQuery<CourseDetail>({
    queryKey: ["/api/training/courses", selectedId],
    enabled: !!selectedId,
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: assignDialog,
  });

  const createCourseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/training/courses", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/stats"] });
      setCreateOpen(false);
      setCreateStep(1);
      setCourseForm({ title: "", description: "", category: "", estimatedDuration: "", isRequired: false, publicLinkEnabled: false, certificateEnabled: true, thumbnailData: "" });
      setSelectedId(data.id);
      setView("detail");
      toast({ title: "Course created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/training/courses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      toast({ title: "Course updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/training/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/stats"] });
      setView("grid");
      setSelectedId(null);
      setDeleteConfirm(null);
      toast({ title: "Course deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveModuleMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/training/courses/${selectedId}/modules/${data.id}`, data);
      }
      return apiRequest("POST", `/api/training/courses/${selectedId}/modules`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      setModuleDialogOpen(false);
      setEditingModule(null);
      toast({ title: "Module saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: (moduleId: string) => apiRequest("DELETE", `/api/training/courses/${selectedId}/modules/${moduleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      toast({ title: "Module deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: (employeeIds: string[]) => apiRequest("POST", `/api/training/courses/${selectedId}/assign`, { employeeIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/stats"] });
      setAssignDialog(false);
      toast({ title: "Employees assigned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      apiRequest("PATCH", `/api/training/courses/${id}`, { isPublished: publish }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
    },
  });

  const handleThumbnail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCourseForm(f => ({ ...f, thumbnailData: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAssetUploading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      setEditingModule(m => ({
        ...m,
        assets: [...(m?.assets ?? []), { id: `new_${Date.now()}`, assetData: data, assetType: "image", sortOrder: (m?.assets?.length ?? 0) }],
      }));
      setAssetUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const getPublicLink = (publicId: string) => `${window.location.origin}/training/public/${publicId}`;

  const filtered = courses.filter(c => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== "All" && c.category !== filterCategory) return false;
    if (filterStatus === "Published" && !c.isPublished) return false;
    if (filterStatus === "Draft" && c.isPublished) return false;
    if (filterStatus === "Required" && !c.isRequired) return false;
    return true;
  });

  const course = detail?.course;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Training Hub</h1>
          <p className="text-sm text-muted-foreground">Create courses, assign employees, track completions</p>
        </div>
        {view === "grid" && (
          <Button onClick={() => { setCreateOpen(true); setCreateStep(1); }} data-testid="btn-create-course">
            <Plus className="w-4 h-4 mr-1" /> Create Course
          </Button>
        )}
        {view === "detail" && (
          <Button variant="outline" onClick={() => { setView("grid"); setSelectedId(null); }} data-testid="btn-back-courses">
            ← All Courses
          </Button>
        )}
      </div>

      {/* Stats */}
      {view === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Courses", value: stats?.totalCourses ?? courses.length, icon: BookOpen, color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
            { label: "Employees Assigned", value: stats?.totalAssigned ?? 0, icon: Users, color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
            { label: "Completions", value: stats?.totalCompleted ?? 0, icon: Trophy, color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
            { label: "In Progress", value: stats?.totalPending ?? 0, icon: Clock, color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {view === "grid" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-courses" />
            </div>
            <select
              className="h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground"
              value={filterCategory} onChange={e => setFilterCategory(e.target.value)} data-testid="select-filter-category">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)} data-testid="select-filter-status">
              <option value="All">All Status</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
              <option value="Required">Required</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-base font-semibold text-foreground mb-1">No courses yet</p>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">Build your first training course with YouTube videos, text lessons, and quizzes.</p>
              <Button onClick={() => setCreateOpen(true)} data-testid="btn-create-course-empty">
                <Plus className="w-4 h-4 mr-1" /> Create First Course
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {filtered.map(c => (
                <CourseCard key={c.id} course={c} onClick={() => { setSelectedId(c.id); setView("detail"); }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETAIL VIEW ── */}
      {view === "detail" && selectedId && (
        <div className="space-y-6">
          {detailLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !detail || !course ? (
            <p className="text-center text-muted-foreground py-20">Course not found</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: course info + modules */}
              <div className="xl:col-span-2 space-y-4">
                {/* Course header */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold text-foreground">{course.title}</h2>
                        {course.isPublished
                          ? <Badge className="bg-green-500 text-white text-xs">Published</Badge>
                          : <Badge variant="secondary" className="text-xs">Draft</Badge>}
                        {course.isRequired && <Badge className="bg-red-500 text-white text-xs">Required</Badge>}
                      </div>
                      {course.description && <p className="text-sm text-muted-foreground mb-2">{course.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {course.category && <span className="bg-muted px-2 py-0.5 rounded-full">{course.category}</span>}
                        {course.estimatedDuration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.estimatedDuration}</span>}
                        {course.certificateEnabled && <span className="flex items-center gap-1 text-amber-600"><Award className="w-3 h-3" />Certificate</span>}
                        {course.publicLinkEnabled && course.publicId && <span className="flex items-center gap-1 text-blue-600"><Globe className="w-3 h-3" />Public Link</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant={course.isPublished ? "outline" : "default"}
                        size="sm"
                        onClick={() => publishMutation.mutate({ id: course.id, publish: !course.isPublished })}
                        disabled={publishMutation.isPending}
                        data-testid="btn-toggle-publish">
                        {course.isPublished ? <><EyeOff className="w-3.5 h-3.5 mr-1" />Unpublish</> : <><Eye className="w-3.5 h-3.5 mr-1" />Publish</>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setAssignDialog(true)} data-testid="btn-assign-employees">
                        <Users className="w-3.5 h-3.5 mr-1" /> Assign
                      </Button>
                      {course.publicLinkEnabled && course.publicId && (
                        <Button variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(getPublicLink(course.publicId!));
                          toast({ title: "Link copied!" });
                        }} data-testid="btn-copy-public-link">
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => setDeleteConfirm(course.id)} data-testid="btn-delete-course">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Modules */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">Modules ({detail.modules.length})</h3>
                    <Button size="sm" onClick={() => { setEditingModule({ sortOrder: detail.modules.length, isRequired: true, assets: [] }); setModuleDialogOpen(true); }} data-testid="btn-add-module">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Module
                    </Button>
                  </div>
                  {detail.modules.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border rounded-lg">
                      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">No modules yet. Add your first module.</p>
                      <Button size="sm" variant="outline" onClick={() => { setEditingModule({ sortOrder: 0, isRequired: true, assets: [] }); setModuleDialogOpen(true); }}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Module
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detail.modules.map((mod, i) => (
                        <div key={mod.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors" data-testid={`row-module-${mod.id}`}>
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">{mod.title}</span>
                              {mod.isRequired && <Badge variant="outline" className="text-xs h-4">Required</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {mod.youtubeEmbedId && <span className="flex items-center gap-1"><Play className="w-3 h-3 text-red-500" />Video</span>}
                              {mod.lessonText && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />Lesson</span>}
                              {(mod.assets?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Image className="w-3 h-3" />{mod.assets?.length} images</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingModule(mod); setModuleDialogOpen(true); }} data-testid={`btn-edit-module-${mod.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteModuleMutation.mutate(mod.id)} data-testid={`btn-delete-module-${mod.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: stats + completions */}
              <div className="space-y-4">
                {/* Stats */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-4">Completion Stats</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Assigned", value: detail.stats.assigned, color: "bg-blue-500" },
                      { label: "Started", value: detail.stats.started, color: "bg-amber-500" },
                      { label: "Completed", value: detail.stats.completed, color: "bg-green-500" },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-medium text-foreground">{s.value}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.color}`} style={{ width: `${detail.stats.assigned > 0 ? (s.value / detail.stats.assigned) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                    {detail.stats.assigned > 0 && (
                      <div className="pt-2 border-t border-border text-center">
                        <span className="text-2xl font-bold text-foreground">{detail.stats.completionPct}%</span>
                        <p className="text-xs text-muted-foreground">completion rate</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Employee completions */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-4">Employee Progress</h3>
                  {detail.assignments.length === 0 ? (
                    <div className="text-center py-6">
                      <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No employees assigned yet</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => setAssignDialog(true)}>Assign Employees</Button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {detail.assignments.map((a: any) => {
                        const completedModules = detail.completions.filter(c => c.employeeId === a.employeeId).length;
                        const total = detail.modules.length;
                        const pct = total > 0 ? Math.round((completedModules / total) * 100) : 0;
                        return (
                          <div key={a.id} className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {a.employeeName?.charAt(0) ?? "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{a.employeeName}</div>
                              <div className="w-full h-1 bg-muted rounded-full mt-1">
                                <div className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground flex-shrink-0">{pct}%</div>
                            {pct === 100 && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Public learners */}
                {course.publicLinkEnabled && (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-semibold text-foreground mb-3">Public Completions</h3>
                    <div className="text-sm text-muted-foreground">
                      {detail.completions.filter(c => c.publicLearnerId).length} public learner completions
                    </div>
                    {course.publicId && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-1">Public link</div>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{getPublicLink(course.publicId)}</code>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(getPublicLink(course.publicId!)); toast({ title: "Copied!" }); }}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE COURSE DIALOG ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-create-course">
          <DialogHeader>
            <DialogTitle>
              {createStep === 1 ? "Course Details" : createStep === 2 ? "Settings & Options" : "Review & Create"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Step indicator */}
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= createStep ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>

            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>Course Title <span className="text-destructive">*</span></Label>
                  <Input className="mt-1" placeholder="e.g. How to Mop Properly" value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} data-testid="input-course-title" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea className="mt-1" rows={3} placeholder="What will employees learn?" value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} data-testid="input-course-description" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <select className="mt-1 w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground" value={courseForm.category} onChange={e => setCourseForm(f => ({ ...f, category: e.target.value }))} data-testid="select-course-category">
                      <option value="">Select...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Estimated Duration</Label>
                    <Input className="mt-1" placeholder="e.g. 30 min" value={courseForm.estimatedDuration} onChange={e => setCourseForm(f => ({ ...f, estimatedDuration: e.target.value }))} data-testid="input-course-duration" />
                  </div>
                </div>
                <div>
                  <Label>Thumbnail (optional)</Label>
                  <div className="mt-1">
                    {courseForm.thumbnailData ? (
                      <div className="relative w-full h-28 rounded-lg overflow-hidden border border-border">
                        <img src={courseForm.thumbnailData} alt="" className="w-full h-full object-cover" />
                        <Button variant="ghost" size="sm" className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white h-6 w-6 p-0" onClick={() => setCourseForm(f => ({ ...f, thumbnailData: "" }))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="w-full h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors">
                        <input ref={thumbnailRef} type="file" accept="image/*" className="sr-only" onChange={handleThumbnail} />
                        <div className="text-center">
                          <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                          <span className="text-xs text-muted-foreground">Click to upload thumbnail</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-foreground">Required Course</div>
                    <div className="text-xs text-muted-foreground">Employees must complete this course</div>
                  </div>
                  <Switch checked={courseForm.isRequired} onCheckedChange={v => setCourseForm(f => ({ ...f, isRequired: v }))} data-testid="switch-required" />
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-foreground">Issue Certificate</div>
                    <div className="text-xs text-muted-foreground">Generate completion certificate</div>
                  </div>
                  <Switch checked={courseForm.certificateEnabled} onCheckedChange={v => setCourseForm(f => ({ ...f, certificateEnabled: v }))} data-testid="switch-certificate" />
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-foreground">Enable Public Link</div>
                    <div className="text-xs text-muted-foreground">Allow non-employees to access via link</div>
                  </div>
                  <Switch checked={courseForm.publicLinkEnabled} onCheckedChange={v => setCourseForm(f => ({ ...f, publicLinkEnabled: v }))} data-testid="switch-public-link" />
                </div>
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Review your course before creating it. You can add modules and assign employees after creation.</p>
                <div className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Title</span><span className="font-medium">{courseForm.title}</span>
                  </div>
                  {courseForm.category && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Category</span><span>{courseForm.category}</span></div>}
                  {courseForm.estimatedDuration && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Duration</span><span>{courseForm.estimatedDuration}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Required</span><span>{courseForm.isRequired ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Certificate</span><span>{courseForm.certificateEnabled ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Public Link</span><span>{courseForm.publicLinkEnabled ? "Yes" : "No"}</span></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={() => createStep > 1 ? setCreateStep(s => s - 1) : setCreateOpen(false)}>
                {createStep > 1 ? "Back" : "Cancel"}
              </Button>
              {createStep < 3 ? (
                <Button size="sm" onClick={() => setCreateStep(s => s + 1)} disabled={createStep === 1 && !courseForm.title.trim()} data-testid="btn-next-step">
                  Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => createCourseMutation.mutate(courseForm)} disabled={createCourseMutation.isPending} data-testid="btn-create-course-confirm">
                  {createCourseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Create Course
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODULE DIALOG ── */}
      <Dialog open={moduleDialogOpen} onOpenChange={v => { setModuleDialogOpen(v); if (!v) setEditingModule(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-module">
          <DialogHeader>
            <DialogTitle>{editingModule?.id ? "Edit Module" : "Add Module"}</DialogTitle>
          </DialogHeader>
          {editingModule && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Module Title <span className="text-destructive">*</span></Label>
                <Input className="mt-1" placeholder="e.g. Proper Mopping Technique" value={editingModule.title ?? ""} onChange={e => setEditingModule(m => ({ ...m, title: e.target.value }))} data-testid="input-module-title" />
              </div>
              <div>
                <Label>Description</Label>
                <Input className="mt-1" placeholder="Brief module description" value={editingModule.description ?? ""} onChange={e => setEditingModule(m => ({ ...m, description: e.target.value }))} data-testid="input-module-description" />
              </div>

              {/* YouTube */}
              <div>
                <Label>YouTube Video URL (optional)</Label>
                <Input
                  className="mt-1"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={editingModule.youtubeUrl ?? ""}
                  onChange={e => {
                    const url = e.target.value;
                    const embedId = parseYoutubeId(url);
                    setEditingModule(m => ({ ...m, youtubeUrl: url, youtubeEmbedId: embedId ?? undefined }));
                  }}
                  data-testid="input-youtube-url"
                />
                {editingModule.youtubeEmbedId && (
                  <div className="mt-2 aspect-video rounded-lg overflow-hidden border border-border bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${editingModule.youtubeEmbedId}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>

              {/* Lesson text */}
              <div>
                <Label>Lesson Text (optional)</Label>
                <Textarea className="mt-1" rows={5} placeholder="Write lesson content, steps, or instructions..." value={editingModule.lessonText ?? ""} onChange={e => setEditingModule(m => ({ ...m, lessonText: e.target.value }))} data-testid="input-lesson-text" />
              </div>

              {/* Assets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Images / Slides (optional)</Label>
                  <label className="cursor-pointer">
                    <input ref={assetRef} type="file" accept="image/*" className="sr-only" onChange={handleAssetUpload} />
                    <Button variant="outline" size="sm" type="button" onClick={() => assetRef.current?.click()} disabled={assetUploading} data-testid="btn-upload-asset">
                      {assetUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Image className="w-3.5 h-3.5 mr-1" />Add Image</>}
                    </Button>
                  </label>
                </div>
                {(editingModule.assets?.length ?? 0) > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {editingModule.assets?.map((a, i) => (
                      <div key={i} className="relative aspect-video rounded-md overflow-hidden border border-border bg-muted">
                        <img src={a.assetData} alt="" className="w-full h-full object-cover" />
                        <Button
                          variant="ghost" size="sm" className="absolute top-0.5 right-0.5 w-5 h-5 p-0 bg-black/50 hover:bg-black/70 text-white"
                          onClick={() => setEditingModule(m => ({ ...m, assets: m?.assets?.filter((_, idx) => idx !== i) }))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                <Switch checked={editingModule.isRequired ?? true} onCheckedChange={v => setEditingModule(m => ({ ...m, isRequired: v }))} data-testid="switch-module-required" />
                <Label className="cursor-pointer">Required module (must complete to finish course)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModuleDialogOpen(false); setEditingModule(null); }}>Cancel</Button>
            <Button
              onClick={() => saveModuleMutation.mutate(editingModule)}
              disabled={!editingModule?.title?.trim() || saveModuleMutation.isPending}
              data-testid="btn-save-module">
              {saveModuleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN DIALOG ── */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="sm:max-w-md max-h-[80vh]" data-testid="dialog-assign">
          <DialogHeader>
            <DialogTitle>Assign Employees</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-96 space-y-2 py-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              if (selectedEmployees.size === employees.length) setSelectedEmployees(new Set());
              else setSelectedEmployees(new Set(employees.map(e => e.id)));
            }}>
              {selectedEmployees.size === employees.length ? "Deselect All" : "Select All"}
            </Button>
            {employees.map(emp => (
              <label key={emp.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedEmployees.has(emp.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`} data-testid={`checkbox-employee-${emp.id}`}>
                <input type="checkbox" className="sr-only" checked={selectedEmployees.has(emp.id)} onChange={e => {
                  const s = new Set(selectedEmployees);
                  if (e.target.checked) s.add(emp.id); else s.delete(emp.id);
                  setSelectedEmployees(s);
                }} />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedEmployees.has(emp.id) ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {selectedEmployees.has(emp.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="text-sm font-medium">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-muted-foreground">{emp.position ?? emp.email}</div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={() => assignMutation.mutate([...selectedEmployees])} disabled={selectedEmployees.size === 0 || assignMutation.isPending} data-testid="btn-confirm-assign">
              {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Assign {selectedEmployees.size > 0 ? `(${selectedEmployees.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Course</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the course, all modules, assignments, and completion records. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteCourseMutation.mutate(deleteConfirm)} disabled={deleteCourseMutation.isPending} data-testid="btn-confirm-delete">
              {deleteCourseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
