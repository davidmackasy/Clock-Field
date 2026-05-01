import { useState, useRef, useCallback, useEffect } from "react";
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
  AlertCircle, CheckCircle2, Clock, X, ArrowLeft, Building2,
  Home, ChevronLeft, ZoomIn, ExternalLink,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getAreaCategories, getRooms, getItems, buildStepTitle, CUSTOM_OPTION,
} from "@/lib/scheduled-field-note-options";

// ─── Types ────────────────────────────────────────────────────────────────────
type Template = {
  id: string; name: string; description: string; clientId: string | null;
  templateType: string; frequency: string; requiredBeforeClockOut: boolean;
  status: string; introText: string; outroText: string;
  sectionCount: number; stepCount: number; assignmentCount: number;
  clientName?: string | null; createdAt: string; updatedAt: string;
};
type Section = { id: string; title: string; description: string; sortOrder: number; steps: Step[] };
type Step = {
  id: string; title: string; description: string; referenceImageUrl: string | null;
  areaCategory: string | null; areaName: string | null; itemType: string | null;
  customAreaName: string | null; customItemType: string | null;
  isRequired: boolean; sortOrder: number; sectionId: string;
  submission?: StepSubmission | null;
};
type Assignment = {
  id: string; templateId: string; cleanerId: string; clientId: string | null; status: string;
  templateName: string; cleanerName: string; clientName: string | null; createdAt: string;
};
type Submission = {
  id: string; templateId: string; assignmentId: string; cleanerId: string;
  clientId: string | null; submissionDate: string; status: string;
  startedAt: string; completedAt: string | null; totalSteps: number; completedSteps: number;
  publicId: string | null; publicEnabled: boolean;
  templateName: string; cleanerName: string; clientName: string | null;
};
type StepSubmission = { id: string; stepId: string; submittedImageUrl: string; submittedAt: string };
type FullTemplate = Template & { sections: Section[] };
type FullSubmission = Submission & { template: any; sections: Section[]; stepSubmissions: StepSubmission[]; cleanerName: string; clientName: string | null };
type Cleaner = { id: string; firstName: string; lastName: string; email: string };
type Client = { id: string; name: string };
type LightboxImage = { src: string; label: string; sublabel?: string };

const SUB_TABS = [
  { id: "templates", label: "Templates", icon: ClipboardList },
  { id: "assignments", label: "Assignments", icon: Users },
  { id: "submissions", label: "Submissions", icon: BarChart2 },
  { id: "reports", label: "Reports", icon: FileText },
];

// ─── Lightbox Modal ───────────────────────────────────────────────────────────
function LightboxModal({ images, initialIndex = 0, onClose }: {
  images: LightboxImage[]; initialIndex?: number; onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const img = images[idx];
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) setIdx(i => i - 1);
      if (e.key === "ArrowRight" && idx < images.length - 1) setIdx(i => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, images.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
        <img src={img.src} alt={img.label} className="w-full max-h-[80vh] object-contain rounded-lg" />
        <button onClick={onClose} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
          <X className="w-4 h-4" />
        </button>
        {images.length > 1 && idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {images.length > 1 && idx < images.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg p-4">
          <p className="text-white text-sm font-medium">{img.label}</p>
          {img.sublabel && <p className="text-white/70 text-xs mt-0.5">{img.sublabel}</p>}
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-4 right-4 text-white/60 text-xs">{idx + 1} / {images.length}</div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
      type === "residential" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"
    )}>
      {type === "residential" ? <Home className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
      {type === "residential" ? "Residential" : "Commercial"}
    </span>
  );
}

// ─── Step Dialog (Enhanced with Dropdowns) ────────────────────────────────────
function StepDialog({ open, onClose, onSave, initial, templateId, sectionId, templateType }: {
  open: boolean; onClose: () => void; templateId: string; sectionId: string;
  templateType: string; onSave: (data: any) => void; initial?: Step | null;
}) {
  const [areaCategory, setAreaCategory] = useState(initial?.areaCategory || "");
  const [areaName, setAreaName] = useState(initial?.areaName || "");
  const [itemType, setItemType] = useState(initial?.itemType || "");
  const [customAreaName, setCustomAreaName] = useState(initial?.customAreaName || "");
  const [customItemType, setCustomItemType] = useState(initial?.customItemType || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [refImg, setRefImg] = useState<string | null>(initial?.referenceImageUrl || null);
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const { fileRef, handleFile, trigger } = useImageCapture(setRefImg);

  const rooms = areaCategory ? getRooms(templateType, areaCategory) : [];
  const items = areaCategory ? getItems(templateType, areaCategory) : [];
  const effectiveArea = areaName === CUSTOM_OPTION ? customAreaName : areaName;
  const effectiveItem = itemType === CUSTOM_OPTION ? customItemType : itemType;

  useEffect(() => {
    if (!titleManuallyEdited) {
      const generated = buildStepTitle(effectiveArea, effectiveItem);
      if (generated) setTitle(generated);
    }
  }, [effectiveArea, effectiveItem, titleManuallyEdited]);

  const handleAreaCategoryChange = (val: string) => {
    setAreaCategory(val);
    setAreaName(""); setItemType(""); setCustomAreaName(""); setCustomItemType("");
    if (!titleManuallyEdited) setTitle("");
  };

  const isValid = title.trim() && areaCategory;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      title: title.trim(), description: desc,
      areaCategory, areaName: effectiveArea || areaName, itemType: effectiveItem || itemType,
      customAreaName: areaName === CUSTOM_OPTION ? customAreaName : null,
      customItemType: itemType === CUSTOM_OPTION ? customItemType : null,
      referenceImageUrl: refImg, isRequired, templateId, sectionId,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit Step" : "Add Step"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">

          {/* Area Category */}
          <div>
            <Label>Area Category <span className="text-destructive">*</span></Label>
            <Select value={areaCategory} onValueChange={handleAreaCategoryChange}>
              <SelectTrigger className="mt-1" data-testid="select-area-category">
                <SelectValue placeholder="Select area…" />
              </SelectTrigger>
              <SelectContent>
                {getAreaCategories(templateType).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Room / Area */}
          {areaCategory && (
            <div>
              <Label>Room / Area</Label>
              <Select value={areaName} onValueChange={setAreaName}>
                <SelectTrigger className="mt-1" data-testid="select-area-name">
                  <SelectValue placeholder="Select room…" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  <SelectItem value={CUSTOM_OPTION}>{CUSTOM_OPTION}</SelectItem>
                </SelectContent>
              </Select>
              {areaName === CUSTOM_OPTION && (
                <Input className="mt-1.5" placeholder="Enter custom room name" value={customAreaName} onChange={e => setCustomAreaName(e.target.value)} data-testid="input-custom-area" />
              )}
            </div>
          )}

          {/* Item / Surface */}
          {areaCategory && (
            <div>
              <Label>Item / Surface</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger className="mt-1" data-testid="select-item-type">
                  <SelectValue placeholder="Select item…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  <SelectItem value={CUSTOM_OPTION}>{CUSTOM_OPTION}</SelectItem>
                </SelectContent>
              </Select>
              {itemType === CUSTOM_OPTION && (
                <Input className="mt-1.5" placeholder="Enter custom item name" value={customItemType} onChange={e => setCustomItemType(e.target.value)} data-testid="input-custom-item" />
              )}
            </div>
          )}

          {/* Step Title (auto-generated, editable) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Step Title <span className="text-destructive">*</span></Label>
              {!titleManuallyEdited && title && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Auto-generated</span>
              )}
            </div>
            <Input
              data-testid="input-step-title"
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleManuallyEdited(true); }}
              placeholder="e.g. Women's Washroom - Sink"
            />
          </div>

          {/* Instruction */}
          <div>
            <Label>Instruction (optional)</Label>
            <Textarea
              data-testid="input-step-description"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Additional guidance for the cleaner"
              className="mt-1" rows={2}
            />
          </div>

          {/* Reference Photo (9:16) */}
          <div>
            <Label>Reference Photo (optional)</Label>
            <div className="mt-1">
              {refImg ? (
                <div className="relative rounded-xl overflow-hidden border mx-auto" style={{ width: 160, aspectRatio: "9/16" }}>
                  <img src={refImg} alt="reference" className="absolute inset-0 w-full h-full object-cover" />
                  <button onClick={() => setRefImg(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 p-2">
                    <p className="text-white text-[10px] text-center">Reference</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={trigger}
                  data-testid="button-add-ref-photo"
                  className="mx-auto flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  style={{ width: 160, aspectRatio: "9/16" }}
                >
                  <ImagePlus className="w-7 h-7" />
                  <span className="text-xs text-center px-2">Upload reference photo<br />(9:16 recommended)</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </div>

          {/* Required toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Required step</p>
              <p className="text-xs text-muted-foreground">Cleaner must complete before finishing</p>
            </div>
            <Switch data-testid="switch-step-required" checked={isRequired} onCheckedChange={setIsRequired} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-step" onClick={handleSave} disabled={!isValid}>Save Step</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step Card (Grid item in section) ─────────────────────────────────────────
function StepCard({ step, idx, onEdit, onDelete, onClickImage }: {
  step: Step; idx: number; onEdit: (s: Step) => void;
  onDelete: (id: string) => void; onClickImage: (src: string, label: string) => void;
}) {
  return (
    <div className="border rounded-xl overflow-hidden bg-card hover:border-primary/30 hover:shadow-sm transition-all flex flex-col" data-testid={`card-step-${step.id}`}>
      {/* Reference photo - 9:16 */}
      <div
        className={cn("relative bg-muted flex-shrink-0", step.referenceImageUrl && "cursor-pointer")}
        style={{ aspectRatio: "9/16" }}
        onClick={() => step.referenceImageUrl && onClickImage(step.referenceImageUrl, step.title)}
      >
        {step.referenceImageUrl ? (
          <>
            <img src={step.referenceImageUrl} alt="Reference" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <ZoomIn className="w-8 h-8 text-white drop-shadow" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="w-8 h-8 text-muted-foreground/25" />
          </div>
        )}
        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm border text-[10px] font-bold flex items-center justify-center">
          {idx + 1}
        </div>
        {!step.isRequired && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] bg-background/80 backdrop-blur-sm border px-1.5 py-0.5 rounded-full font-medium">Optional</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-2.5 flex flex-col flex-1">
        <p className="text-xs font-semibold line-clamp-2 flex-1">{step.title}</p>
        {step.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{step.description}</p>}
        {step.areaCategory && (
          <p className="text-[10px] text-muted-foreground/70 mt-1">{step.areaCategory}</p>
        )}
        <div className="flex gap-1 mt-2 pt-2 border-t">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(step)} data-testid={`button-edit-step-${step.id}`}><Edit2 className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(step.id)} data-testid={`button-delete-step-${step.id}`}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ section, sectionIndex, onEditStep, onAddStep, onDeleteStep, onUpdateSection, onDeleteSection, onClickImage, templateType }: {
  section: Section; sectionIndex: number; templateType: string;
  onEditStep: (s: Step) => void; onAddStep: () => void;
  onDeleteStep: (id: string) => void; onUpdateSection: (data: any) => void;
  onDeleteSection: () => void; onClickImage: (src: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [collapsed, setCollapsed] = useState(false);
  const save = () => { onUpdateSection({ title }); setEditing(false); };
  const steps = (section.steps || []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/40">
        {editing ? (
          <Input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 h-7 text-sm" autoFocus
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            onBlur={save}
          />
        ) : (
          <span className="flex-1 font-semibold text-sm">{section.title}</span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(!editing)} data-testid={`button-edit-section-${section.id}`}><Edit2 className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDeleteSection} data-testid={`button-delete-section-${section.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)} data-testid={`button-collapse-section-${section.id}`}>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {steps.map((step, idx) => (
              <StepCard
                key={step.id}
                step={step}
                idx={idx}
                onEdit={onEditStep}
                onDelete={onDeleteStep}
                onClickImage={onClickImage}
              />
            ))}
            {/* Add step card */}
            <button
              onClick={onAddStep}
              data-testid={`button-add-step-section-${section.id}`}
              className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors p-4 min-h-[120px]"
              style={{ aspectRatio: "9/16" }}
            >
              <Plus className="w-6 h-6" />
              <span className="text-xs text-center">Add Step</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template Builder ─────────────────────────────────────────────────────────
function TemplateBuilder({ template, onBack }: { template: FullTemplate; onBack: () => void }) {
  const { toast } = useToast();
  const [editingStep, setEditingStep] = useState<{ step?: Step; sectionId: string } | null>(null);
  const [addingSectionTitle, setAddingSectionTitle] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [editingTemplateInfo, setEditingTemplateInfo] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: template.name, description: template.description,
    templateType: template.templateType || "commercial",
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

  const sections = (template.sections || []).sort((a, b) => a.sortOrder - b.sortOrder);
  const totalSteps = sections.reduce((acc, s) => acc + (s.steps?.length || 0), 0);
  const currentType = templateForm.templateType || "commercial";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {lightbox && (
        <LightboxModal
          images={[{ src: lightbox.src, label: lightbox.label, sublabel: "Reference Photo" }]}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-templates"><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-lg truncate">{template.name}</h2>
            <TypeBadge type={currentType} />
            <StatusBadge status={template.status} />
          </div>
          <p className="text-xs text-muted-foreground">{totalSteps} step{totalSteps !== 1 ? "s" : ""} · {sections.length} section{sections.length !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditingTemplateInfo(true)} data-testid="button-edit-template-info">
          <Edit2 className="w-3.5 h-3.5 mr-1.5" />Settings
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, si) => (
          <SectionCard
            key={section.id}
            section={section}
            sectionIndex={si}
            templateType={currentType}
            onEditStep={(step) => setEditingStep({ step, sectionId: section.id })}
            onAddStep={() => setEditingStep({ sectionId: section.id })}
            onDeleteStep={(id) => deleteStep.mutate(id)}
            onUpdateSection={(data) => updateSection.mutate({ id: section.id, data })}
            onClickImage={(src, label) => setLightbox({ src, label })}
            onDeleteSection={() => {
              if (section.steps?.length) {
                toast({ title: "Delete steps first", variant: "destructive" });
              } else {
                deleteSection.mutate(section.id);
              }
            }}
          />
        ))}

        {addingSectionTitle ? (
          <div className="flex gap-2 items-center border rounded-xl p-3 bg-muted/30">
            <Input
              data-testid="input-section-title"
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              placeholder="Section title (e.g. Kitchen, Washrooms)"
              className="flex-1" autoFocus
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

      {/* Template Settings Dialog */}
      <Dialog open={editingTemplateInfo} onOpenChange={setEditingTemplateInfo}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Template Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Template Name</Label>
                <Input data-testid="input-template-name" value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Template Type</Label>
                <Select value={templateForm.templateType} onValueChange={v => setTemplateForm(f => ({ ...f, templateType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commercial"><span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />Commercial</span></SelectItem>
                    <SelectItem value="residential"><span className="flex items-center gap-2"><Home className="w-3.5 h-3.5" />Residential</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={templateForm.description} onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={2} />
              </div>
              <div className="col-span-2">
                <Label>Location / Client (optional)</Label>
                <Select value={templateForm.clientId || "none"} onValueChange={v => setTemplateForm(f => ({ ...f, clientId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-template-client"><SelectValue placeholder="No specific location" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific location</SelectItem>
                    {(clients || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Intro Text</Label>
                <Textarea value={templateForm.introText} onChange={e => setTemplateForm(f => ({ ...f, introText: e.target.value }))} className="mt-1" rows={2} placeholder="Shown to cleaner before starting" />
              </div>
              <div className="col-span-2">
                <Label>Outro Text</Label>
                <Textarea value={templateForm.outroText} onChange={e => setTemplateForm(f => ({ ...f, outroText: e.target.value }))} className="mt-1" rows={2} placeholder="Shown after completing" />
              </div>
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
          templateType={currentType}
          initial={editingStep.step}
          onSave={(data) => {
            if (editingStep.step) updateStep.mutate({ id: editingStep.step.id, data });
            else addStep.mutate({ sectionId: editingStep.sectionId, data });
          }}
        />
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
  const [newType, setNewType] = useState("commercial");
  const [search, setSearch] = useState("");

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
      setShowCreateDialog(false); setNewName(""); setNewType("commercial");
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

  const filtered = (templates || []).filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold">Checklist Templates</h3>
          <p className="text-sm text-muted-foreground">Build reusable photo checklists for your team</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-template">
          <Plus className="w-4 h-4 mr-2" />New Template
        </Button>
      </div>

      <div className="relative">
        <Input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search templates…" className="pl-8"
          data-testid="input-search-templates"
        />
        <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">🔍</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "No matching templates" : "No templates yet"}</p>
          <p className="text-sm mt-1">Create your first photo checklist template</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(t => (
            <div
              key={t.id}
              data-testid={`card-template-${t.id}`}
              className="group border rounded-xl p-4 bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer flex flex-col gap-3"
              onClick={() => setSelectedTemplateId(t.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateTemplate.mutate(t.id)} data-testid={`button-duplicate-template-${t.id}`} title="Duplicate"><Copy className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTemplate.mutate(t.id)} data-testid={`button-delete-template-${t.id}`} title="Delete"><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <TypeBadge type={t.templateType || "commercial"} />
                <StatusBadge status={t.status} />
                {t.requiredBeforeClockOut && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-2.5 h-2.5" />Clock-out
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                <span>{t.sectionCount} section{t.sectionCount !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{t.stepCount} step{t.stepCount !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span className="capitalize">{t.frequency}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t.assignmentCount} assignment{t.assignmentCount !== 1 ? "s" : ""}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Checklist Template</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Template Name</Label>
              <Input data-testid="input-new-template-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Daily Clean Walkthrough" className="mt-1"
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createTemplate.mutate({ name: newName.trim(), templateType: newType }); }}
              />
            </div>
            <div>
              <Label>Template Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="mt-1" data-testid="select-new-template-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial"><span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />Commercial</span></SelectItem>
                  <SelectItem value="residential"><span className="flex items-center gap-2"><Home className="w-3.5 h-3.5" />Residential</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button data-testid="button-confirm-create-template" onClick={() => createTemplate.mutate({ name: newName.trim(), templateType: newType })} disabled={!newName.trim() || createTemplate.isPending}>
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
  const [search, setSearch] = useState("");

  const { data: assignments, isLoading } = useQuery<Assignment[]>({ queryKey: ["/api/admin/scheduled-field-notes/assignments"] });
  const { data: templates } = useQuery<Template[]>({ queryKey: ["/api/admin/scheduled-field-notes/templates"] });
  const { data: cleaners } = useQuery<Cleaner[]>({ queryKey: ["/api/employees"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const activeTemplates = (templates || []).filter(t => t.status === "active");

  const createAssignment = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/scheduled-field-notes/assignments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/assignments"] });
      setShowCreate(false); setForm({ templateId: "", cleanerId: "", clientId: "" });
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

  const filtered = (assignments || []).filter(a =>
    !search || [a.templateName, a.cleanerName, a.clientName || ""].some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold">Assignments</h3>
          <p className="text-sm text-muted-foreground">Assign checklist templates to cleaners</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-assignment">
          <Plus className="w-4 h-4 mr-2" />Assign Template
        </Button>
      </div>

      <div className="relative">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assignments…" className="pl-8" />
        <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">🔍</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "No matching assignments" : "No assignments yet"}</p>
          <p className="text-sm mt-1">Assign a template to a cleaner to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(a => (
            <div key={a.id} data-testid={`card-assignment-${a.id}`} className="border rounded-xl p-4 bg-card flex flex-col gap-3">
              <div>
                <p className="font-semibold text-sm line-clamp-1">{a.templateName}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" />{a.cleanerName}
                </p>
                {a.clientName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />{a.clientName}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={a.status} />
              </div>
              <p className="text-[11px] text-muted-foreground">Assigned {format(parseISO(a.createdAt), "MMM d, yyyy")}</p>
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline" size="sm" className="flex-1 text-xs"
                  onClick={() => updateAssignment.mutate({ id: a.id, data: { status: a.status === "active" ? "inactive" : "active" } })}
                  data-testid={`button-toggle-assignment-${a.id}`}
                >
                  {a.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteAssignment.mutate(a.id)} data-testid={`button-delete-assignment-${a.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
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
                <SelectContent>{activeTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cleaner</Label>
              <Select value={form.cleanerId} onValueChange={v => setForm(f => ({ ...f, cleanerId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-assignment-cleaner"><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                <SelectContent>{(cleaners || []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
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

// ─── Cleaner History View ─────────────────────────────────────────────────────
function CleanerHistoryView({ cleanerName, submissions, onViewSubmission, onBack }: {
  cleanerName: string; submissions: Submission[];
  onViewSubmission: (id: string) => void; onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const sorted = [...submissions]
    .filter(s => {
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.templateName.toLowerCase().includes(q) || (s.clientName || "").toLowerCase().includes(q) || s.submissionDate.includes(q);
      }
      return true;
    })
    .sort((a, b) => b.submissionDate.localeCompare(a.submissionDate));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h3 className="font-semibold">{cleanerName}</h3>
          <p className="text-sm text-muted-foreground">{submissions.length} submission{submissions.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by template, date, location…" className="pl-8" />
          <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">🔍</span>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!sorted.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No matching submissions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(s => (
            <div
              key={s.id}
              data-testid={`card-submission-${s.id}`}
              className="border rounded-xl p-4 bg-card hover:border-primary/20 hover:shadow-sm cursor-pointer transition-all flex flex-col gap-3"
              onClick={() => onViewSubmission(s.id)}
            >
              <div>
                <p className="font-semibold text-sm line-clamp-1">{s.templateName}</p>
                {s.clientName && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" />{s.clientName}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={s.status} />
              </div>
              <div>
                <p className="text-sm font-medium">{format(parseISO(s.submissionDate), "MMMM d, yyyy")}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {s.startedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Started {format(parseISO(s.startedAt), "h:mm a")}</span>}
                  {s.completedAt && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />Done {format(parseISO(s.completedAt), "h:mm a")}</span>}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{s.completedSteps}/{s.totalSteps}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className={cn("h-full rounded-full transition-all", s.status === "completed" ? "bg-green-500" : "bg-primary")} style={{ width: s.totalSteps ? `${Math.round((s.completedSteps / s.totalSteps) * 100)}%` : "0%" }} />
                </div>
              </div>
              <div className="flex justify-end pt-1 border-t">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submissions Tab ──────────────────────────────────────────────────────────
function SubmissionsTab({ onViewSubmission }: { onViewSubmission: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedCleaner, setSelectedCleaner] = useState<{ id: string; name: string } | null>(null);

  const { data: submissions, isLoading } = useQuery<Submission[]>({ queryKey: ["/api/admin/scheduled-field-notes/submissions"] });

  if (selectedCleaner) {
    const cleanerSubs = (submissions || []).filter(s => s.cleanerId === selectedCleaner.id);
    return (
      <CleanerHistoryView
        cleanerName={selectedCleaner.name}
        submissions={cleanerSubs}
        onViewSubmission={onViewSubmission}
        onBack={() => setSelectedCleaner(null)}
      />
    );
  }

  // Group by cleaner
  const cleanerMap = new Map<string, { id: string; name: string; subs: Submission[] }>();
  for (const s of (submissions || [])) {
    if (!cleanerMap.has(s.cleanerId)) {
      cleanerMap.set(s.cleanerId, { id: s.cleanerId, name: s.cleanerName, subs: [] });
    }
    cleanerMap.get(s.cleanerId)!.subs.push(s);
  }
  const cleanerCards = Array.from(cleanerMap.values())
    .map(c => ({
      ...c,
      latestDate: c.subs.reduce((m, s) => s.submissionDate > m ? s.submissionDate : m, ""),
      completed: c.subs.filter(s => s.status === "completed").length,
      templates: [...new Set(c.subs.map(s => s.templateName))],
    }))
    .filter(c => {
      if (filterStatus !== "all") {
        if (filterStatus === "completed" && c.completed === 0) return false;
        if (filterStatus === "in_progress" && c.completed === c.subs.length) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.templates.some(t => t.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => b.latestDate.localeCompare(a.latestDate));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Submissions</h3>
        <p className="text-sm text-muted-foreground">Review completed checklists — click a cleaner to see their history</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input data-testid="input-search-submissions" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by cleaner or template…" className="pl-8" />
          <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">🔍</span>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Has Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !cleanerCards.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No submissions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cleanerCards.map(c => (
            <div
              key={c.id}
              className="border rounded-xl p-4 bg-card hover:border-primary/20 hover:shadow-md cursor-pointer transition-all flex flex-col gap-3"
              onClick={() => setSelectedCleaner({ id: c.id, name: c.name })}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.subs.length} submission{c.subs.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Templates:</p>
                <p className="text-xs font-medium line-clamp-2 mt-0.5">{c.templates.join(", ")}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>{c.completed} completed</span>
                <span>Latest: {c.latestDate ? format(parseISO(c.latestDate), "MMM d") : "—"}</span>
              </div>
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
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const { data: sub, isLoading } = useQuery<FullSubmission>({
    queryKey: ["/api/admin/scheduled-field-notes/submissions", submissionId],
    queryFn: () => fetch(`/api/admin/scheduled-field-notes/submissions/${submissionId}`, { credentials: "include" }).then(r => r.json()),
  });

  const generateLink = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/scheduled-field-notes/submissions/${submissionId}/generate-link`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/submissions", submissionId] });
      navigator.clipboard.writeText(`${window.location.origin}${data.url}`).catch(() => {});
      toast({ title: "Public link generated & copied" });
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

  const openLightbox = (images: LightboxImage[], index: number) => setLightbox({ images, index });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {lightbox && <LightboxModal images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}

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
        <div className="w-full bg-muted rounded-full h-2">
          <div className={cn("h-full rounded-full", sub.status === "completed" ? "bg-green-500" : "bg-primary")} style={{ width: sub.totalSteps ? `${Math.round((sub.completedSteps / sub.totalSteps) * 100)}%` : "0%" }} />
        </div>
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
          <div className="flex items-center gap-2">
            {sub.publicEnabled && publicUrl ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl).catch(() => {}); toast({ title: "Link copied" }); }} data-testid="button-copy-public-link">
                  <Copy className="w-3.5 h-3.5 mr-1.5" />Copy
                </Button>
                <Button size="sm" variant="outline" asChild data-testid="button-open-public-link">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1.5" />Open</a>
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => disableLink.mutate()} data-testid="button-disable-public-link">
                  <Link2Off className="w-3.5 h-3.5 mr-1.5" />Disable
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => generateLink.mutate()} disabled={generateLink.isPending} data-testid="button-generate-public-link">
                {generateLink.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                Generate Link
              </Button>
            )}
          </div>
        </div>
        {sub.publicEnabled && publicUrl && (
          <p className="text-xs text-muted-foreground truncate">{publicUrl}</p>
        )}
      </div>

      {/* Photo Grid by Section */}
      {(sub.sections || []).sort((a, b) => a.sortOrder - b.sortOrder).map(section => {
        const steps = (section.steps || []).sort((a, b) => a.sortOrder - b.sortOrder);
        const sectionImages: LightboxImage[] = steps.flatMap(step => {
          const imgs: LightboxImage[] = [];
          if (step.referenceImageUrl) imgs.push({ src: step.referenceImageUrl, label: step.title, sublabel: "Reference Photo" });
          if (step.submission?.submittedImageUrl) imgs.push({ src: step.submission.submittedImageUrl, label: step.title, sublabel: `Submitted ${format(parseISO(step.submission.submittedAt), "h:mm a")}` });
          return imgs;
        });

        return (
          <div key={section.id}>
            <h4 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground mb-3">{section.title}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {steps.map((step, idx) => {
                const refImgIndex = sectionImages.findIndex(i => i.label === step.title && i.sublabel === "Reference Photo");
                const subImgIndex = sectionImages.findIndex(i => i.label === step.title && i.sublabel?.startsWith("Submitted"));
                return (
                  <div key={step.id} data-testid={`card-step-submission-${step.id}`} className="border rounded-xl overflow-hidden bg-card">
                    {/* Step header */}
                    <div className="px-3 py-2 border-b">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold", step.submission ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
                          {step.submission ? "✓" : idx + 1}
                        </div>
                        <p className="text-xs font-semibold flex-1 line-clamp-1">{step.title}</p>
                        {!step.isRequired && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 rounded-full">Optional</span>}
                      </div>
                    </div>
                    {/* Reference photo */}
                    {step.referenceImageUrl ? (
                      <div
                        className="relative cursor-pointer group"
                        style={{ aspectRatio: "9/16" }}
                        onClick={() => openLightbox(sectionImages, refImgIndex >= 0 ? refImgIndex : 0)}
                      >
                        <img src={step.referenceImageUrl} alt="Reference" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-2">
                          <p className="text-white text-[10px]">Reference</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center bg-muted/30 text-muted-foreground/40" style={{ aspectRatio: "9/16" }}>
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                    {/* Submitted photo */}
                    {step.submission?.submittedImageUrl ? (
                      <div
                        className="relative cursor-pointer group border-t"
                        style={{ aspectRatio: "9/16" }}
                        onClick={() => openLightbox(sectionImages, subImgIndex >= 0 ? subImgIndex : 0)}
                      >
                        <img src={step.submission.submittedImageUrl} alt="Submitted" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-2">
                          <p className="text-white text-[10px]">Submitted</p>
                          <p className="text-white/70 text-[9px]">{format(parseISO(step.submission.submittedAt), "h:mm a")}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center bg-muted/20 text-muted-foreground/30 border-t" style={{ aspectRatio: "9/16" }}>
                        <div className="text-center">
                          <Camera className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-[9px]">Not submitted</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ onViewSubmission }: { onViewSubmission: (id: string) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  const { data: submissions, isLoading } = useQuery<Submission[]>({
    queryKey: ["/api/admin/scheduled-field-notes/submissions"],
  });

  const generateLink = useMutation({
    mutationFn: (id: string) => {
      setGeneratingId(id);
      return apiRequest("POST", `/api/admin/scheduled-field-notes/submissions/${id}/generate-link`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/submissions"] });
      navigator.clipboard.writeText(`${window.location.origin}${data.url}`).catch(() => {});
      toast({ title: "Link generated & copied" });
      setGeneratingId(null);
    },
    onError: () => setGeneratingId(null),
  });

  const disableLink = useMutation({
    mutationFn: (id: string) => {
      setDisablingId(id);
      return apiRequest("PATCH", `/api/admin/scheduled-field-notes/submissions/${id}/disable-link`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-field-notes/submissions"] });
      toast({ title: "Link disabled" });
      setDisablingId(null);
    },
    onError: () => setDisablingId(null),
  });

  const completed = (submissions || []).filter(s => s.status === "completed");
  const filtered = completed.filter(s =>
    !search || [s.templateName, s.cleanerName, s.clientName || ""].some(str => str.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.submissionDate.localeCompare(a.submissionDate));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Client Reports</h3>
        <p className="text-sm text-muted-foreground">Generate and manage shareable public report links</p>
      </div>

      <div className="relative">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…" className="pl-8" />
        <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">🔍</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "No matching reports" : "No completed checklists yet"}</p>
          <p className="text-sm mt-1">Completed submissions will appear here for sharing with clients</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => {
            const publicUrl = s.publicId ? `${window.location.origin}/public/scheduled-field-notes/${s.publicId}` : null;
            return (
              <div key={s.id} data-testid={`card-report-${s.id}`} className="border rounded-xl p-4 bg-card flex flex-col gap-3">
                <div className="cursor-pointer" onClick={() => onViewSubmission(s.id)}>
                  <p className="font-semibold text-sm line-clamp-1">{s.templateName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3" />{s.cleanerName}
                  </p>
                  {s.clientName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />{s.clientName}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{format(parseISO(s.submissionDate), "MMMM d, yyyy")}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={s.status} />
                  {s.publicEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <Link2 className="w-2.5 h-2.5" />Link Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted border px-2 py-0.5 rounded-full">No Link</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 pt-2 border-t">
                  {s.publicEnabled && publicUrl ? (
                    <>
                      <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={() => { navigator.clipboard.writeText(publicUrl).catch(() => {}); toast({ title: "Link copied" }); }} data-testid={`button-copy-link-${s.id}`}>
                        <Copy className="w-3 h-3 mr-2" />Copy Link
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-xs justify-start" asChild>
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 mr-2" />Open Report</a>
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-xs justify-start text-destructive hover:text-destructive" onClick={() => disableLink.mutate(s.id)} disabled={disablingId === s.id} data-testid={`button-disable-link-${s.id}`}>
                        {disablingId === s.id ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Link2Off className="w-3 h-3 mr-2" />}Disable Link
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="w-full text-xs" onClick={() => generateLink.mutate(s.id)} disabled={generatingId === s.id} data-testid={`button-generate-link-${s.id}`}>
                      {generatingId === s.id ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Link2 className="w-3 h-3 mr-2" />}Generate Link
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="w-full text-xs justify-start text-muted-foreground" onClick={() => onViewSubmission(s.id)}>
                    <Eye className="w-3 h-3 mr-2" />View Submission
                  </Button>
                </div>
              </div>
            );
          })}
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
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeSubTab === "templates" && <TemplatesTab />}
        {activeSubTab === "assignments" && <AssignmentsTab />}
        {activeSubTab === "submissions" && !viewingSubmissionId && <SubmissionsTab onViewSubmission={handleViewSubmission} />}
        {activeSubTab === "reports" && <ReportsTab onViewSubmission={handleViewSubmission} />}
      </div>
    </div>
  );
}
