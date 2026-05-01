import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  ClipboardList, Plus, ChevronRight, Trash2, Edit2, Copy,
  Camera, ImagePlus, CheckSquare, Users, FileText, BarChart2,
  ChevronDown, ChevronUp, Link2, Link2Off, Eye, Loader2,
  GripVertical, AlertCircle, CheckCircle2, Clock, X, ArrowLeft,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type Template = {
  id: string; name: string; description: string; clientId: string | null;
  frequency: string; requiredBeforeClockOut: boolean; status: string;
  introText: string; outroText: string; sectionCount: number; stepCount: number;
  assignmentCount: number; clientName?: string | null; createdAt: string; updatedAt: string;
};

type Section = {
  id: string; title: string; description: string; sortOrder: number;
  steps: Step[];
};

type Step = {
  id: string; title: string; description: string; referenceImageUrl: string | null;
  isRequired: boolean; sortOrder: number; sectionId: string;
  submission?: StepSubmission | null;
};

type Assignment = {
  id: string; templateId: string; cleanerId: string; clientId: string | null;
  status: string; templateName: string; cleanerName: string; clientName: string | null;
  createdAt: string;
};

type Submission = {
  id: string; templateId: string; assignmentId: string; cleanerId: string;
  clientId: string | null; submissionDate: string; status: string;
  startedAt: string; completedAt: string | null; totalSteps: number; completedSteps: number;
  publicId: string | null; publicEnabled: boolean;
  templateName: string; cleanerName: string; clientName: string | null;
};

type StepSubmission = {
  id: string; stepId: string; submittedImageUrl: string; submittedAt: string;
};

type FullTemplate = Template & { sections: Section[]; assignments: Assignment[] };
type FullSubmission = Submission & { template: Template; sections: Section[]; stepSubmissions: StepSubmission[] };

type Cleaner = { id: string; firstName: string; lastName: string; email: string };
type Client = { id: string; name: string };

const SUB_TABS = [
  { id: "templates", label: "Templates", icon: ClipboardList },
  { id: "assignments", label: "Assignments", icon: Users },
  { id: "submissions", label: "Submissions", icon: BarChart2 },
  { id: "reports", label: "Reports", icon: FileText },
];

// ─── Image Helper ─────────────────────────────────────────────────────────────
function useImageCapture(onCapture: (base64: string) => void) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") onCapture(reader.result); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [onCapture]);
  return { fileRef, handleFile, trigger: () => fileRef.current?.click() };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    inactive: "bg-gray-100 text-gray-500 border-gray-200",
    in_progress: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    skipped: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };
  const label: Record<string, string> = {
    active: "Active", inactive: "Inactive", in_progress: "In Progress",
    completed: "Completed", skipped: "Skipped",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", cfg[status] || "bg-gray-100 text-gray-500")}>
      {label[status] || status}
    </span>
  );
}

// ─── Step Form Dialog ─────────────────────────────────────────────────────────
function StepDialog({ open, onClose, onSave, initial, templateId, sectionId }: {
  open: boolean; onClose: () => void; templateId: string; sectionId: string;
  onSave: (data: any) => void; initial?: Step | null;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [refImg, setRefImg] = useState<string | null>(initial?.referenceImageUrl || null);
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true);
  const { fileRef, handleFile, trigger } = useImageCapture(setRefImg);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: desc, referenceImageUrl: refImg, isRequired, templateId, sectionId });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Edit Step" : "Add Step"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Step Title <span className="text-destructive">*</span></Label>
            <Input data-testid="input-step-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Photo of clean floor" className="mt-1" />
          </div>
          <div>
            <Label>Instructions (optional)</Label>
            <Textarea data-testid="input-step-description" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Additional guidance for the cleaner" className="mt-1" rows={2} />
          </div>
          <div>
            <Label>Reference Photo (optional)</Label>
            <div className="mt-1">
              {refImg ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={refImg} alt="reference" className="w-full h-40 object-cover" />
                  <button onClick={() => setRefImg(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <button onClick={trigger} data-testid="button-add-ref-photo" className="w-full border-2 border-dashed rounded-lg h-28 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-xs">Upload reference photo</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Required step</p>
              <p className="text-xs text-muted-foreground">Cleaner must complete this before finishing</p>
            </div>
            <Switch data-testid="switch-step-required" checked={isRequired} onCheckedChange={setIsRequired} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-step" onClick={handleSave} disabled={!title.trim()}>Save Step</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template Builder ─────────────────────────────────────────────────────────
function TemplateBuilder({ template, onBack }: { template: FullTemplate; onBack: () => void }) {
  const { toast } = useToast();
  const [editingStep, setEditingStep] = useState<{ step?: Step; sectionId: string } | null>(null);
  const [addingSectionTitle, setAddingSectionTitle] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [editingTemplateInfo, setEditingTemplateInfo] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: template.name, description: template.description,
    frequency: template.frequency, requiredBeforeClockOut: template.requiredBeforeClockOut,
    introText: template.introText, outroText: template.outroText,
    status: template.status, clientId: template.clientId || "",
  });

  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const refetchTemplate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/templates", template.id] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/templates"] });
  };

  const updateTemplate = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/admin/scheduled-field-notes/templates/${template.id}`, data),
    onSuccess: () => { refetchTemplate(); toast({ title: "Template updated" }); setEditingTemplateInfo(false); },
  });

  const addSection = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/scheduled-field-notes/templates/${template.id}/sections`, { title: newSectionTitle || "New Section" }),
    onSuccess: () => { refetchTemplate(); setAddingSectionTitle(false); setNewSectionTitle(""); },
  });

  const updateSection = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/scheduled-field-notes/sections/${id}`, data),
    onSuccess: () => refetchTemplate(),
  });

  const deleteSection = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/scheduled-field-notes/sections/${id}`),
    onSuccess: () => refetchTemplate(),
  });

  const addStep = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: any }) =>
      apiRequest("POST", `/api/admin/scheduled-field-notes/sections/${sectionId}/steps`, data),
    onSuccess: () => refetchTemplate(),
  });

  const updateStep = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/scheduled-field-notes/steps/${id}`, data),
    onSuccess: () => refetchTemplate(),
  });

  const deleteStep = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/scheduled-field-notes/steps/${id}`),
    onSuccess: () => refetchTemplate(),
  });

  const sections = template.sections || [];
  const totalSteps = sections.reduce((acc, s) => acc + (s.steps?.length || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-templates"><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg truncate">{template.name}</h2>
          <p className="text-xs text-muted-foreground">{totalSteps} step{totalSteps !== 1 ? "s" : ""} · {sections.length} section{sections.length !== 1 ? "s" : ""}</p>
        </div>
        <StatusBadge status={template.status} />
        <Button variant="outline" size="sm" onClick={() => setEditingTemplateInfo(true)} data-testid="button-edit-template-info">
          <Edit2 className="w-3.5 h-3.5 mr-1.5" />Settings
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.sort((a, b) => a.sortOrder - b.sortOrder).map((section, si) => (
          <SectionCard
            key={section.id}
            section={section}
            sectionIndex={si}
            onEditStep={(step) => setEditingStep({ step, sectionId: section.id })}
            onAddStep={() => setEditingStep({ sectionId: section.id })}
            onDeleteStep={(id) => deleteStep.mutate(id)}
            onUpdateSection={(data) => updateSection.mutate({ id: section.id, data })}
            onDeleteSection={() => {
              if (section.steps?.length) {
                toast({ title: "Delete steps first", variant: "destructive" });
              } else {
                deleteSection.mutate(section.id);
              }
            }}
          />
        ))}

        {/* Add Section */}
        {addingSectionTitle ? (
          <div className="flex gap-2 items-center border rounded-xl p-3 bg-muted/30">
            <Input
              data-testid="input-section-title"
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              placeholder="Section title (e.g. Kitchen, Bathrooms)"
              className="flex-1"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") addSection.mutate(); if (e.key === "Escape") setAddingSectionTitle(false); }}
            />
            <Button size="sm" onClick={() => addSection.mutate()} disabled={addSection.isPending} data-testid="button-confirm-add-section">Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingSectionTitle(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full border-dashed" onClick={() => setAddingSectionTitle(true)} data-testid="button-add-section">
            <Plus className="w-4 h-4 mr-2" />Add Section
          </Button>
        )}
      </div>

      {/* Template Info Edit Dialog */}
      <Dialog open={editingTemplateInfo} onOpenChange={setEditingTemplateInfo}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Template Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Template Name</Label>
              <Input data-testid="input-template-name" value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={templateForm.description} onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={templateForm.frequency} onValueChange={v => setTemplateForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="per_visit">Per Visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={templateForm.status} onValueChange={v => setTemplateForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Location / Client (optional)</Label>
              <Select value={templateForm.clientId || "none"} onValueChange={v => setTemplateForm(f => ({ ...f, clientId: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1" data-testid="select-template-client"><SelectValue placeholder="No specific location" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific location</SelectItem>
                  {(clients || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Intro Text (shown to cleaner before starting)</Label>
              <Textarea value={templateForm.introText} onChange={e => setTemplateForm(f => ({ ...f, introText: e.target.value }))} className="mt-1" rows={2} placeholder="Welcome message or instructions" />
            </div>
            <div>
              <Label>Outro Text (shown after completing)</Label>
              <Textarea value={templateForm.outroText} onChange={e => setTemplateForm(f => ({ ...f, outroText: e.target.value }))} className="mt-1" rows={2} placeholder="Thank you message" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Required before clock-out</p>
                <p className="text-xs text-muted-foreground">Block clock-out if checklist is incomplete</p>
              </div>
              <Switch data-testid="switch-required-before-clockout" checked={templateForm.requiredBeforeClockOut} onCheckedChange={v => setTemplateForm(f => ({ ...f, requiredBeforeClockOut: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplateInfo(false)}>Cancel</Button>
            <Button data-testid="button-save-template-settings" onClick={() => updateTemplate.mutate({ ...templateForm, clientId: templateForm.clientId || null })} disabled={updateTemplate.isPending}>
              {updateTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step Edit Dialog */}
      {editingStep && (
        <StepDialog
          open={!!editingStep}
          onClose={() => setEditingStep(null)}
          templateId={template.id}
          sectionId={editingStep.sectionId}
          initial={editingStep.step}
          onSave={(data) => {
            if (editingStep.step) {
              updateStep.mutate({ id: editingStep.step.id, data });
            } else {
              addStep.mutate({ sectionId: editingStep.sectionId, data });
            }
          }}
        />
      )}
    </div>
  );
}

function SectionCard({ section, sectionIndex, onEditStep, onAddStep, onDeleteStep, onUpdateSection, onDeleteSection }: {
  section: Section; sectionIndex: number;
  onEditStep: (step: Step) => void; onAddStep: () => void;
  onDeleteStep: (id: string) => void; onUpdateSection: (data: any) => void;
  onDeleteSection: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [collapsed, setCollapsed] = useState(false);

  const save = () => { onUpdateSection({ title }); setEditing(false); };

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/40">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
        {editing ? (
          <Input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 h-7 text-sm" autoFocus
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            onBlur={save}
          />
        ) : (
          <span className="flex-1 font-medium text-sm">{section.title}</span>
        )}
        <span className="text-xs text-muted-foreground">{(section.steps || []).length} step{(section.steps || []).length !== 1 ? "s" : ""}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(!editing)} data-testid={`button-edit-section-${section.id}`}><Edit2 className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDeleteSection} data-testid={`button-delete-section-${section.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)} data-testid={`button-collapse-section-${section.id}`}>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="divide-y">
          {(section.steps || []).sort((a, b) => a.sortOrder - b.sortOrder).map((step, idx) => (
            <div key={step.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 group" data-testid={`row-step-${step.id}`}>
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{step.title}</span>
                  {!step.isRequired && <Badge variant="outline" className="text-[10px] py-0 h-4">Optional</Badge>}
                  {step.referenceImageUrl && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Camera className="w-3 h-3" />Has photo</span>}
                </div>
                {step.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</p>}
              </div>
              {step.referenceImageUrl && (
                <img src={step.referenceImageUrl} alt="ref" className="w-10 h-10 rounded object-cover border shrink-0" />
              )}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditStep(step)} data-testid={`button-edit-step-${step.id}`}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDeleteStep(step.id)} data-testid={`button-delete-step-${step.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
          <div className="px-4 py-2">
            <Button variant="ghost" size="sm" className="text-xs w-full justify-start text-muted-foreground hover:text-foreground" onClick={onAddStep} data-testid={`button-add-step-section-${section.id}`}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Step
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Templates Tab ─────────────────────────────────────────────────────────────
function TemplatesTab() {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/admin/scheduled-field-notes/templates"],
  });

  const { data: fullTemplate } = useQuery<FullTemplate>({
    queryKey: ["/api/admin/scheduled-field-notes/templates", selectedTemplateId],
    enabled: !!selectedTemplateId,
    queryFn: () => fetch(`/api/admin/scheduled-field-notes/templates/${selectedTemplateId}`, { credentials: "include" }).then(r => r.json()),
  });

  const createTemplate = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/scheduled-field-notes/templates", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/templates"] });
      setShowCreateDialog(false);
      setNewName("");
      setSelectedTemplateId(data.id);
      toast({ title: "Template created" });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/scheduled-field-notes/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const duplicateTemplate = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/scheduled-field-notes/templates/${id}/duplicate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/templates"] });
      toast({ title: "Template duplicated" });
    },
  });

  if (selectedTemplateId && fullTemplate) {
    return <TemplateBuilder template={fullTemplate} onBack={() => setSelectedTemplateId(null)} />;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Checklist Templates</h3>
          <p className="text-sm text-muted-foreground">Build reusable photo checklists for your team</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-template">
          <Plus className="w-4 h-4 mr-2" />New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !templates?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">Create your first photo checklist template</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} data-testid={`card-template-${t.id}`}
              className="group border rounded-xl p-4 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer flex items-start gap-4"
              onClick={() => setSelectedTemplateId(t.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{t.name}</span>
                  <StatusBadge status={t.status} />
                  {t.requiredBeforeClockOut && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />Clock-out required
                    </span>
                  )}
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{t.sectionCount} section{t.sectionCount !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{t.stepCount} step{t.stepCount !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{t.assignmentCount} active assignment{t.assignmentCount !== 1 ? "s" : ""}</span>
                  {t.frequency && <><span>·</span><span className="capitalize">{t.frequency}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateTemplate.mutate(t.id)} data-testid={`button-duplicate-template-${t.id}`} title="Duplicate"><Copy className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTemplate.mutate(t.id)} data-testid={`button-delete-template-${t.id}`} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Checklist Template</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Template Name</Label>
            <Input data-testid="input-new-template-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Post-Clean Walkthrough" className="mt-1"
              onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createTemplate.mutate({ name: newName.trim() }); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button data-testid="button-confirm-create-template" onClick={() => createTemplate.mutate({ name: newName.trim() })} disabled={!newName.trim() || createTemplate.isPending}>
              {createTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────
function AssignmentsTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ templateId: "", cleanerId: "", clientId: "" });

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/admin/scheduled-field-notes/assignments"],
  });
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/admin/scheduled-field-notes/templates"],
  });
  const { data: cleaners } = useQuery<Cleaner[]>({ queryKey: ["/api/employees"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const activeTemplates = (templates || []).filter(t => t.status === "active");

  const createAssignment = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/scheduled-field-notes/assignments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/assignments"] });
      setShowCreate(false);
      setForm({ templateId: "", cleanerId: "", clientId: "" });
      toast({ title: "Assignment created" });
    },
  });

  const updateAssignment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/scheduled-field-notes/assignments/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/assignments"] }),
  });

  const deleteAssignment = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/scheduled-field-notes/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/assignments"] });
      toast({ title: "Assignment removed" });
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Assignments</h3>
          <p className="text-sm text-muted-foreground">Assign checklist templates to cleaners</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-assignment">
          <Plus className="w-4 h-4 mr-2" />Assign Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !assignments?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No assignments yet</p>
          <p className="text-sm mt-1">Assign a template to a cleaner to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} data-testid={`row-assignment-${a.id}`} className="flex items-center gap-3 border rounded-xl px-4 py-3 bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{a.templateName}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm">{a.cleanerName}</span>
                  {a.clientName && <span className="text-xs text-muted-foreground">· {a.clientName}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={a.status} />
                  <span className="text-[11px] text-muted-foreground">Assigned {format(parseISO(a.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateAssignment.mutate({ id: a.id, data: { status: a.status === "active" ? "inactive" : "active" } })} data-testid={`button-toggle-assignment-${a.id}`}>
                  {a.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteAssignment.mutate(a.id)} data-testid={`button-delete-assignment-${a.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Template</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Template</Label>
              <Select value={form.templateId} onValueChange={v => setForm(f => ({ ...f, templateId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-assignment-template"><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {activeTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cleaner</Label>
              <Select value={form.cleanerId} onValueChange={v => setForm(f => ({ ...f, cleanerId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-assignment-cleaner"><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                <SelectContent>
                  {(cleaners || []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Select value={form.clientId || "none"} onValueChange={v => setForm(f => ({ ...f, clientId: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1" data-testid="select-assignment-client"><SelectValue placeholder="Any location" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any location</SelectItem>
                  {(clients || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button data-testid="button-confirm-assignment" onClick={() => createAssignment.mutate({ templateId: form.templateId, cleanerId: form.cleanerId, clientId: form.clientId || null })}
              disabled={!form.templateId || !form.cleanerId || createAssignment.isPending}>
              {createAssignment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Submissions Tab ──────────────────────────────────────────────────────────
function SubmissionsTab({ onViewSubmission }: { onViewSubmission: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: submissions, isLoading } = useQuery<Submission[]>({
    queryKey: ["/api/admin/scheduled-field-notes/submissions"],
  });

  const filtered = (submissions || []).filter(s => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.templateName.toLowerCase().includes(q) || s.cleanerName.toLowerCase().includes(q) || (s.clientName || "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Submissions</h3>
          <p className="text-sm text-muted-foreground">Review completed checklists from your team</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input data-testid="input-search-submissions" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cleaner, template, location…" className="pl-8" />
          <span className="absolute left-2.5 top-2.5 text-muted-foreground">🔍</span>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No submissions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a, b) => b.submissionDate.localeCompare(a.submissionDate)).map(s => (
            <div key={s.id} data-testid={`card-submission-${s.id}`}
              className="flex items-start gap-3 border rounded-xl px-4 py-3 bg-card hover:border-primary/20 hover:shadow-sm cursor-pointer transition-all"
              onClick={() => onViewSubmission(s.id)}
            >
              <div className={cn("w-1 self-stretch rounded-full shrink-0", s.status === "completed" ? "bg-green-400" : "bg-blue-400")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{s.templateName}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.cleanerName}{s.clientName ? ` · ${s.clientName}` : ""} · {format(parseISO(s.submissionDate), "MMM d, yyyy")}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-primary transition-all rounded-full" style={{ width: s.totalSteps ? `${Math.round((s.completedSteps / s.totalSteps) * 100)}%` : "0%" }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{s.completedSteps}/{s.totalSteps}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submission Detail ────────────────────────────────────────────────────────
function SubmissionDetail({ submissionId, onBack }: { submissionId: string; onBack: () => void }) {
  const { toast } = useToast();
  const { data: sub, isLoading } = useQuery<FullSubmission>({
    queryKey: ["/api/admin/scheduled-field-notes/submissions", submissionId],
    queryFn: () => fetch(`/api/admin/scheduled-field-notes/submissions/${submissionId}`, { credentials: "include" }).then(r => r.json()),
  });

  const generateLink = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/scheduled-field-notes/submissions/${submissionId}/generate-link`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/submissions", submissionId] });
      navigator.clipboard.writeText(`${window.location.origin}${data.url}`).catch(() => {});
      toast({ title: "Public link generated & copied to clipboard" });
    },
  });

  const disableLink = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/scheduled-field-notes/submissions/${submissionId}/disable-link`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/submissions", submissionId] });
      toast({ title: "Public link disabled" });
    },
  });

  if (isLoading) return <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  if (!sub) return <div className="p-6 text-center text-muted-foreground">Submission not found</div>;

  const publicUrl = sub.publicId ? `${window.location.origin}/public/scheduled-field-notes/${sub.publicId}` : null;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-submissions"><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg truncate">{sub.templateName}</h2>
          <p className="text-xs text-muted-foreground">{sub.cleanerName}{sub.clientName ? ` · ${sub.clientName}` : ""} · {format(parseISO(sub.submissionDate), "MMMM d, yyyy")}</p>
        </div>
        <StatusBadge status={sub.status} />
      </div>

      {/* Progress */}
      <div className="border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Completion</span>
          <span className="font-medium">{sub.completedSteps}/{sub.totalSteps} steps</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2"><div className="h-full bg-primary rounded-full" style={{ width: sub.totalSteps ? `${Math.round((sub.completedSteps / sub.totalSteps) * 100)}%` : "0%" }} /></div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          {sub.startedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Started {format(parseISO(sub.startedAt), "h:mm a")}</span>}
          {sub.completedAt && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />Completed {format(parseISO(sub.completedAt), "h:mm a")}</span>}
        </div>
      </div>

      {/* Public Link */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium">Client Report Link</p>
            <p className="text-xs text-muted-foreground">Share a public report with the client</p>
          </div>
          {sub.publicEnabled && publicUrl ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl).catch(() => {}); toast({ title: "Link copied" }); }} data-testid="button-copy-public-link">
                <Link2 className="w-3.5 h-3.5 mr-1.5" />Copy Link
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => disableLink.mutate()} data-testid="button-disable-public-link">
                <Link2Off className="w-3.5 h-3.5 mr-1.5" />Disable
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => generateLink.mutate()} disabled={generateLink.isPending} data-testid="button-generate-public-link">
              {generateLink.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
              Generate Link
            </Button>
          )}
        </div>
        {sub.publicEnabled && publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
            <Eye className="w-3 h-3" />{publicUrl}
          </a>
        )}
      </div>

      {/* Sections + Photos */}
      {(sub.sections || []).map(section => (
        <div key={section.id} className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{section.title}</h4>
          {(section.steps || []).map((step, idx) => (
            <div key={step.id} data-testid={`card-step-submission-${step.id}`} className="border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold", step.submission ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
                  {step.submission ? "✓" : idx + 1}
                </div>
                <span className="text-sm font-medium flex-1">{step.title}</span>
                {!step.isRequired && <Badge variant="outline" className="text-[10px] py-0 h-4">Optional</Badge>}
                {!step.submission && <span className="text-xs text-muted-foreground">Not submitted</span>}
              </div>
              {(step.referenceImageUrl || step.submission?.submittedImageUrl) && (
                <div className="grid grid-cols-2 gap-0 divide-x">
                  {step.referenceImageUrl ? (
                    <div className="relative">
                      <img src={step.referenceImageUrl} alt="Reference" className="w-full h-32 object-cover" />
                      <span className="absolute bottom-2 left-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">Reference</span>
                    </div>
                  ) : <div />}
                  {step.submission?.submittedImageUrl ? (
                    <div className="relative">
                      <img src={step.submission.submittedImageUrl} alt="Submitted" className="w-full h-32 object-cover" />
                      <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">Submitted {format(parseISO(step.submission.submittedAt), "h:mm a")}</span>
                    </div>
                  ) : <div className="h-32 flex items-center justify-center bg-muted/20"><Camera className="w-6 h-6 text-muted-foreground/30" /></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ onViewSubmission }: { onViewSubmission: (id: string) => void }) {
  const { data: submissions, isLoading } = useQuery<Submission[]>({
    queryKey: ["/api/admin/scheduled-field-notes/submissions"],
  });

  const withLinks = (submissions || []).filter(s => s.status === "completed");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h3 className="font-semibold">Client Reports</h3>
        <p className="text-sm text-muted-foreground">Manage shareable public report links for completed checklists</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !withLinks.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No completed checklists yet</p>
          <p className="text-sm mt-1">Completed submissions will appear here for sharing with clients</p>
        </div>
      ) : (
        <div className="space-y-2">
          {withLinks.sort((a, b) => b.submissionDate.localeCompare(a.submissionDate)).map(s => (
            <div key={s.id} data-testid={`card-report-${s.id}`}
              className="flex items-center gap-3 border rounded-xl px-4 py-3 bg-card hover:border-primary/20 hover:shadow-sm cursor-pointer transition-all"
              onClick={() => onViewSubmission(s.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{s.templateName}</span>
                  {s.publicEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><Link2 className="w-3 h-3" />Link Active</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted border px-2 py-0.5 rounded-full">No Link</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.cleanerName}{s.clientName ? ` · ${s.clientName}` : ""} · {format(parseISO(s.submissionDate), "MMM d, yyyy")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminScheduledFieldNotes() {
  const [activeSubTab, setActiveSubTab] = useState("templates");
  const [viewingSubmissionId, setViewingSubmissionId] = useState<string | null>(null);

  const handleViewSubmission = (id: string) => {
    setViewingSubmissionId(id);
    setActiveSubTab("submissions");
  };

  if (viewingSubmissionId && activeSubTab === "submissions") {
    return (
      <SubmissionDetail
        submissionId={viewingSubmissionId}
        onBack={() => setViewingSubmissionId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-tabs */}
      <div className="border-b bg-background shrink-0 px-4 md:px-6 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
          {SUB_TABS.map(tab => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveSubTab(tab.id); setViewingSubmissionId(null); }}
                data-testid={`subtab-sfn-${tab.id}`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeSubTab === "templates" && <TemplatesTab />}
        {activeSubTab === "assignments" && <AssignmentsTab />}
        {activeSubTab === "submissions" && !viewingSubmissionId && <SubmissionsTab onViewSubmission={handleViewSubmission} />}
        {activeSubTab === "reports" && <ReportsTab onViewSubmission={handleViewSubmission} />}
      </div>
    </div>
  );
}
