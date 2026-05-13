import { useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Camera, CheckCircle2, Edit3, Trash2, Plus, Loader2, Sparkles,
  FileText, ChevronRight, MapPin, LayoutGrid, Ruler, ClipboardList, Send,
  AlertTriangle, ThumbsUp, RefreshCw, X, Eye, Download, Building2,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type MeasStatus = "ai_estimated" | "needs_confirmation" | "confirmed" | "edited" | "rejected";

type Measurement = {
  id: string; photoId: string; walkId: string; label: string;
  measurementType: string; aiEstimatedValue: string | null; confirmedValue: string | null;
  unit: string; confidenceScore: string | null; status: MeasStatus; notes: string | null;
  createdAt: string; updatedAt: string | null;
};

type Photo = {
  id: string; walkId: string; imageBase64: string; areaName: string | null;
  notes: string | null; transcript: string | null; aiAnalysisJson: string | null;
  createdAt: string;
};

type Walk = {
  id: string; companyId: string; clientId: string | null; submissionId: string | null; title: string;
  siteType: string; status: string; notes: string | null;
  totalEstimatedSqft: string | null; totalConfirmedSqft: string | null;
  summaryJson: string | null; createdByUserId: string; createdAt: string; updatedAt: string | null;
  photos: Photo[]; measurements: Measurement[];
};

const SITE_TYPES = [
  { value: "commercial", label: "Commercial Office" },
  { value: "restaurant", label: "Restaurant / Food Service" },
  { value: "retail", label: "Retail Store" },
  { value: "medical", label: "Medical / Healthcare" },
  { value: "industrial", label: "Industrial / Warehouse" },
  { value: "residential", label: "Residential" },
  { value: "post_construction", label: "Post-Construction" },
  { value: "school", label: "School / Educational" },
  { value: "gym", label: "Gym / Fitness" },
  { value: "other", label: "Other" },
];

const TABS = [
  { id: "details", label: "Details", icon: Building2 },
  { id: "capture", label: "Capture", icon: Camera },
  { id: "measurements", label: "Measurements", icon: Ruler },
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "export", label: "Export", icon: Send },
];

const STATUS_COLORS: Record<MeasStatus, string> = {
  ai_estimated:     "bg-blue-50 text-blue-700 border-blue-200",
  needs_confirmation: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed:        "bg-green-50 text-green-700 border-green-200",
  edited:           "bg-purple-50 text-purple-700 border-purple-200",
  rejected:         "bg-red-50 text-red-500 border-red-200",
};

const CONFIDENCE_LABEL = (c: string | null) => {
  const v = parseFloat(c || "0");
  if (v >= 0.85) return { label: "High", color: "text-green-600" };
  if (v >= 0.65) return { label: "Medium", color: "text-amber-600" };
  return { label: "Low", color: "text-red-500" };
};

// ─── Measurement Row ──────────────────────────────────────────────────────────

function MeasurementRow({ meas, walkId, photoAreaName }: { meas: Measurement; walkId: string; photoAreaName: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(meas.confirmedValue || meas.aiEstimatedValue || "");
  const [editNote, setEditNote] = useState(meas.notes || "");

  const updateMutation = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/jobsite-walks/${walkId}/measurements/${meas.id}`, body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks", walkId] });
      setEditing(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/jobsite-walks/${walkId}/measurements/${meas.id}`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks", walkId] }),
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const conf = CONFIDENCE_LABEL(meas.confidenceScore);
  const displayValue = meas.confirmedValue || meas.aiEstimatedValue || "—";

  if (editing) {
    return (
      <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
        <p className="text-xs font-medium">{meas.label}</p>
        <div className="flex gap-2 items-center">
          <Input
            data-testid={`input-meas-value-${meas.id}`}
            className="h-8 text-sm w-28"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            type="number"
          />
          <span className="text-xs text-muted-foreground">{meas.unit}</span>
        </div>
        <Input
          data-testid={`input-meas-note-${meas.id}`}
          className="h-8 text-xs"
          placeholder="Note (optional)"
          value={editNote}
          onChange={e => setEditNote(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            data-testid={`button-save-meas-${meas.id}`}
            size="sm" className="h-7 text-xs gap-1"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ confirmedValue: editVal, notes: editNote || null, status: "edited" })}
          >
            {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Save
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg p-3 flex items-start gap-3 transition-all", meas.status === "rejected" && "opacity-50")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{photoAreaName}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="font-medium text-sm truncate">{meas.label}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-base font-semibold">{displayValue}</span>
          <span className="text-xs text-muted-foreground">{meas.unit}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[meas.status])}>
            {meas.status.replace("_", " ")}
          </Badge>
          {meas.status === "ai_estimated" && (
            <span className={cn("text-[10px] font-medium", conf.color)}>
              {conf.label} confidence
            </span>
          )}
        </div>
        {meas.notes && <p className="text-[11px] text-muted-foreground mt-1 italic">{meas.notes}</p>}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {meas.status !== "confirmed" && meas.status !== "rejected" && (
          <button
            data-testid={`button-confirm-meas-${meas.id}`}
            title="Confirm"
            className="w-7 h-7 rounded flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"
            onClick={() => updateMutation.mutate({ confirmedValue: displayValue, status: "confirmed" })}
            disabled={updateMutation.isPending}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          data-testid={`button-edit-meas-${meas.id}`}
          title="Edit"
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => setEditing(true)}
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        {meas.status !== "rejected" && (
          <button
            data-testid={`button-reject-meas-${meas.id}`}
            title="Reject"
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => updateMutation.mutate({ status: "rejected" })}
            disabled={updateMutation.isPending}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          data-testid={`button-delete-meas-${meas.id}`}
          title="Delete"
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Photo Card ────────────────────────────────────────────────────────────────

function PhotoCard({ photo, walkId, measurements, onSelect }: {
  photo: Photo; walkId: string; measurements: Measurement[]; onSelect: () => void;
}) {
  const { toast } = useToast();
  const photoMeas = measurements.filter(m => m.photoId === photo.id);
  let analysis: any = {};
  try { analysis = JSON.parse(photo.aiAnalysisJson || "{}"); } catch { }

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/jobsite-walks/${walkId}/photos/${photo.id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks", walkId] });
      toast({ title: "Photo removed." });
    },
    onError: () => toast({ title: "Failed to remove photo", variant: "destructive" }),
  });

  const hasAnalysis = !!photo.aiAnalysisJson;
  const areaLabel = photo.areaName || analysis.area_type || "Unknown Area";

  return (
    <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
      <div className="relative aspect-video bg-muted cursor-pointer" onClick={onSelect}>
        <img src={photo.imageBase64} alt={areaLabel} className="w-full h-full object-cover" />
        {!hasAnalysis && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
              <p className="text-xs">Analyzing…</p>
            </div>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            data-testid={`button-delete-photo-${photo.id}`}
            className="w-6 h-6 rounded bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            onClick={e => { e.stopPropagation(); deleteMutation.mutate(); }}
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            className="w-6 h-6 rounded bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary"
            onClick={e => { e.stopPropagation(); onSelect(); }}
          >
            <Eye className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <p className="font-medium text-sm truncate">{areaLabel}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {hasAnalysis ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200 gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Analyzed
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing
            </Badge>
          )}
          {photoMeas.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{photoMeas.length} measurement{photoMeas.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {analysis.surface_type && (
          <p className="text-[11px] text-muted-foreground mt-1">{analysis.surface_type} · {analysis.floor_condition}</p>
        )}
      </div>
    </div>
  );
}

// ─── Photo Detail Dialog ──────────────────────────────────────────────────────

function PhotoDetailDialog({ photo, walkId, measurements, open, onClose }: {
  photo: Photo | null; walkId: string; measurements: Measurement[]; open: boolean; onClose: () => void;
}) {
  const [editingArea, setEditingArea] = useState(false);
  const [areaName, setAreaName] = useState(photo?.areaName || "");
  const { toast } = useToast();

  const updatePhoto = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/jobsite-walks/${walkId}/photos/${photo?.id}`, body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks", walkId] });
      setEditingArea(false);
      toast({ title: "Updated." });
    },
  });

  if (!photo) return null;
  let analysis: any = {};
  try { analysis = JSON.parse(photo.aiAnalysisJson || "{}"); } catch { }

  const photoMeas = measurements.filter(m => m.photoId === photo.id);
  const areaLabel = photo.areaName || analysis.area_type || "Unknown Area";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            {editingArea ? (
              <div className="flex items-center gap-2 flex-1">
                <Input className="h-7 text-sm flex-1" value={areaName} onChange={e => setAreaName(e.target.value)} />
                <Button size="sm" className="h-7" onClick={() => updatePhoto.mutate({ areaName })}>Save</Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingArea(false)}>Cancel</Button>
              </div>
            ) : (
              <span className="cursor-pointer hover:text-primary" onClick={() => { setAreaName(areaLabel); setEditingArea(true); }}>
                {areaLabel} <Edit3 className="w-3 h-3 inline ml-1 opacity-50" />
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <img src={photo.imageBase64} alt={areaLabel} className="w-full rounded-lg object-cover max-h-64" />

        {photo.aiAnalysisJson ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {analysis.surface_type && (
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Surface</p>
                  <p className="font-medium">{analysis.surface_type}</p>
                </div>
              )}
              {analysis.floor_condition && (
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Condition</p>
                  <p className="font-medium">{analysis.floor_condition}</p>
                </div>
              )}
              {analysis.estimated_cleaning_hours != null && (
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Est. Hours</p>
                  <p className="font-medium">{analysis.estimated_cleaning_hours}h</p>
                </div>
              )}
            </div>

            {Array.isArray(analysis.risks) && analysis.risks.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Risks & Challenges</p>
                <ul className="space-y-1">
                  {analysis.risks.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-amber-500 mt-0.5">•</span>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(analysis.recommended_services) && analysis.recommended_services.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Recommended Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.recommended_services.map((s: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[11px] px-2 py-0.5 bg-green-50 text-green-800 border-green-200">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {photoMeas.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Ruler className="w-3 h-3" /> Measurements ({photoMeas.length})</p>
                <div className="space-y-1.5">
                  {photoMeas.map(m => (
                    <div key={m.id} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-sm", STATUS_COLORS[m.status])}>
                      <span>{m.label}</span>
                      <span className="font-semibold">{m.confirmedValue || m.aiEstimatedValue} {m.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">AI is analyzing this photo…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JobsiteWalkPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [sendToProposalOpen, setSendToProposalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState({ clientName: "", clientEmail: "", clientPhone: "", serviceAddress: "" });
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ title: "", siteType: "commercial", notes: "" });

  const { data: walk, isLoading } = useQuery<Walk>({
    queryKey: ["/api/jobsite-walks", id],
    queryFn: () => fetch(`/api/jobsite-walks/${id}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: (data) => {
      // Refetch every 3s while any photo is still being analyzed
      const photos = (data as any)?.photos ?? [];
      return photos.some((p: Photo) => !p.aiAnalysisJson) ? 3000 : false;
    },
  });

  const updateWalkMutation = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/jobsite-walks/${id}`, body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks", id] });
      setEditingDetails(false);
      toast({ title: "Walk updated." });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const generateSummaryMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/jobsite-walks/${id}/generate-summary`, {}).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks", id] });
      toast({ title: "AI summary generated!" });
      setActiveTab("summary");
    },
    onError: () => toast({ title: "Failed to generate summary", variant: "destructive" }),
  });

  const sendToProposalMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/jobsite-walks/${id}/send-to-proposal`, body).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal created!", description: "Opening Proposal Builder…" });
      setSendToProposalOpen(false);
      navigate(`/admin/proposals/${data.proposal.id}`);
    },
    onError: () => toast({ title: "Failed to create proposal", variant: "destructive" }),
  });

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploadingCount(fileArray.length);

    for (const file of fileArray) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await apiRequest("POST", `/api/jobsite-walks/${id}/photos`, { imageBase64: base64 });
        queryClient.invalidateQueries({ queryKey: ["/api/jobsite-walks", id] });
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }
    setUploadingCount(0);
  }, [id, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 py-3.5 flex items-center gap-3">
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-48 h-5 rounded" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!walk) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Walk not found.</p>
          <Button variant="outline" className="mt-3" onClick={() => navigate("/admin/work-log?tab=field-notes")}>Go Back</Button>
        </div>
      </div>
    );
  }

  let summary: any = {};
  try { summary = JSON.parse(walk.summaryJson || "{}"); } catch { }

  const confirmedMeasurements = walk.measurements.filter(m => m.status !== "rejected");
  const totalSqft = confirmedMeasurements
    .filter(m => m.measurementType === "square_footage")
    .reduce((sum, m) => sum + parseFloat(m.confirmedValue || m.aiEstimatedValue || "0"), 0);
  const pendingCount = walk.measurements.filter(m => m.status === "ai_estimated").length;

  // Map photoId → area name for measurement display
  const photoAreaMap: Record<string, string> = {};
  for (const p of walk.photos) {
    let a: any = {};
    try { a = JSON.parse(p.aiAnalysisJson || "{}"); } catch { }
    photoAreaMap[p.id] = p.areaName || a.area_type || "Unknown Area";
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          data-testid="button-back-to-field-notes"
          onClick={() => navigate("/admin/work-log?tab=field-notes")}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">{walk.title}</h1>
          <p className="text-[11px] text-muted-foreground capitalize">
            {SITE_TYPES.find(t => t.value === walk.siteType)?.label ?? walk.siteType} ·{" "}
            {walk.photos.length} photo{walk.photos.length !== 1 ? "s" : ""} ·{" "}
            {walk.measurements.length} measurement{walk.measurements.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 capitalize",
          walk.status === "complete" ? "bg-green-50 text-green-700 border-green-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
        )}>
          {walk.status}
        </Badge>
      </div>

      {/* Tab Bar */}
      <div className="border-b bg-background flex-shrink-0">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === "measurements" && pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">{pendingCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Details Tab ─────────────────────────────────────────────────── */}
        {activeTab === "details" && (
          <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Walk Information</h2>
                {!editingDetails && (
                  <Button
                    data-testid="button-edit-details"
                    size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => { setDetailsForm({ title: walk.title, siteType: walk.siteType, notes: walk.notes || "" }); setEditingDetails(true); }}
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </Button>
                )}
              </div>

              {editingDetails ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs mb-1 block">Title</Label>
                    <Input
                      data-testid="input-walk-title"
                      value={detailsForm.title}
                      onChange={e => setDetailsForm(f => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Site Type</Label>
                    <Select value={detailsForm.siteType} onValueChange={v => setDetailsForm(f => ({ ...f, siteType: v }))}>
                      <SelectTrigger data-testid="select-site-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SITE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Notes</Label>
                    <Textarea
                      data-testid="input-walk-notes"
                      rows={3}
                      placeholder="Any special instructions or context…"
                      value={detailsForm.notes}
                      onChange={e => setDetailsForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      data-testid="button-save-details"
                      size="sm" disabled={updateWalkMutation.isPending}
                      onClick={() => updateWalkMutation.mutate(detailsForm)}
                    >
                      {updateWalkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Save Changes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingDetails(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {walk.submissionId && (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                      <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-xs text-blue-700 font-medium">Linked from Lead Inbox</span>
                      <button
                        className="ml-auto text-[10px] text-blue-600 underline hover:text-blue-800"
                        onClick={() => window.location.href = "/admin/quote-forms"}
                        data-testid="link-view-lead"
                      >
                        View Lead →
                      </button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-24 flex-shrink-0">Title</span>
                    <span className="font-medium">{walk.title}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-24 flex-shrink-0">Site Type</span>
                    <span>{SITE_TYPES.find(t => t.value === walk.siteType)?.label ?? walk.siteType}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-24 flex-shrink-0">Created</span>
                    <span>{format(parseISO(walk.createdAt), "MMM d, yyyy h:mm a")}</span>
                  </div>
                  {walk.notes && (
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-24 flex-shrink-0">Notes</span>
                      <span className="text-muted-foreground">{walk.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">{walk.photos.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Photos</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">{confirmedMeasurements.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Measurements</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">{totalSqft > 0 ? `${Math.round(totalSqft).toLocaleString()}` : "—"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sq Ft Est.</p>
              </div>
            </div>

            <Button
              data-testid="button-go-to-capture"
              className="w-full gap-2"
              onClick={() => setActiveTab("capture")}
            >
              <Camera className="w-4 h-4" /> Start Capturing Photos
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        )}

        {/* ── Capture Tab ─────────────────────────────────────────────────── */}
        {activeTab === "capture" && (
          <div className="p-4 md:p-6 space-y-4">
            {/* Upload area */}
            <div
              className={cn(
                "rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                "hover:border-primary/50 hover:bg-primary/5"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium text-sm">Add Photos</p>
              <p className="text-xs text-muted-foreground mt-1">Click to take or upload photos — AI will analyze each one</p>
              {uploadingCount > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Uploading {uploadingCount} photo{uploadingCount !== 1 ? "s" : ""}…</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={e => handleFileUpload(e.target.files)}
              data-testid="input-photo-upload"
            />

            {/* Photo grid */}
            {walk.photos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No photos yet — add some above</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {walk.photos.map(photo => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    walkId={walk.id}
                    measurements={walk.measurements}
                    onSelect={() => setSelectedPhoto(photo)}
                  />
                ))}
                <div
                  className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-primary transition-colors min-h-[160px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-xs font-medium">Add More</span>
                </div>
              </div>
            )}

            {walk.photos.length > 0 && (
              <Button
                data-testid="button-go-to-measurements"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setActiveTab("measurements")}
              >
                <Ruler className="w-4 h-4" /> Review Measurements
                {pendingCount > 0 && (
                  <Badge className="ml-1 bg-amber-100 text-amber-700 border-0">{pendingCount} pending</Badge>
                )}
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            )}
          </div>
        )}

        {/* ── Measurements Tab ─────────────────────────────────────────────── */}
        {activeTab === "measurements" && (
          <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
            {/* Summary bar */}
            {walk.measurements.length > 0 && (
              <div className="rounded-xl border bg-card p-4 flex items-center gap-6 flex-wrap">
                <div className="text-center">
                  <p className="text-lg font-bold">{totalSqft > 0 ? `${Math.round(totalSqft).toLocaleString()}` : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Total Sq Ft</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{confirmedMeasurements.filter(m => m.status === "confirmed" || m.status === "edited").length}</p>
                  <p className="text-[11px] text-muted-foreground">Confirmed</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
                  <p className="text-[11px] text-muted-foreground">Needs Review</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-500">{walk.measurements.filter(m => m.status === "rejected").length}</p>
                  <p className="text-[11px] text-muted-foreground">Rejected</p>
                </div>
              </div>
            )}

            {pendingCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <strong>{pendingCount} measurement{pendingCount !== 1 ? "s" : ""}</strong> from AI need{pendingCount === 1 ? "s" : ""} your review. Click the <ThumbsUp className="w-3 h-3 inline" /> to confirm or <Edit3 className="w-3 h-3 inline" /> to edit values.
                </p>
              </div>
            )}

            {walk.measurements.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Ruler className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No measurements yet</p>
                <p className="text-xs mt-1">Add photos and AI will detect measurements automatically</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => setActiveTab("capture")}>
                  <Camera className="w-4 h-4" /> Go to Capture
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {walk.measurements.map(m => (
                  <MeasurementRow
                    key={m.id}
                    meas={m}
                    walkId={walk.id}
                    photoAreaName={photoAreaMap[m.photoId] ?? "Unknown"}
                  />
                ))}
              </div>
            )}

            {walk.measurements.length > 0 && (
              <Button
                data-testid="button-generate-summary"
                className="w-full gap-2"
                disabled={generateSummaryMutation.isPending}
                onClick={() => generateSummaryMutation.mutate()}
              >
                {generateSummaryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate AI Summary
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            )}
          </div>
        )}

        {/* ── Summary Tab ──────────────────────────────────────────────────── */}
        {activeTab === "summary" && (
          <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
            {!walk.summaryJson ? (
              <div className="text-center py-16">
                <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-medium text-muted-foreground">No summary yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Review your measurements then generate an AI summary</p>
                <Button
                  data-testid="button-generate-summary-from-summary-tab"
                  className="mt-4 gap-2"
                  disabled={generateSummaryMutation.isPending || walk.photos.length === 0}
                  onClick={() => generateSummaryMutation.mutate()}
                >
                  {generateSummaryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Summary
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">AI Walkthrough Summary</h2>
                  <Button
                    data-testid="button-regenerate-summary"
                    size="sm" variant="outline" className="h-7 text-xs gap-1"
                    disabled={generateSummaryMutation.isPending}
                    onClick={() => generateSummaryMutation.mutate()}
                  >
                    {generateSummaryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate
                  </Button>
                </div>

                {summary.executive_summary && (
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Overview</p>
                    <p className="text-sm leading-relaxed">{summary.executive_summary}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {summary.total_sqft > 0 && (
                    <div className="rounded-xl border bg-card p-3 text-center">
                      <p className="text-xl font-bold text-primary">{Math.round(summary.total_sqft).toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground">Sq Ft</p>
                    </div>
                  )}
                  {summary.estimated_hours_per_visit && (
                    <div className="rounded-xl border bg-card p-3 text-center">
                      <p className="text-xl font-bold text-primary">{summary.estimated_hours_per_visit}h</p>
                      <p className="text-[11px] text-muted-foreground">Per Visit</p>
                    </div>
                  )}
                  {summary.suggested_frequency && (
                    <div className="rounded-xl border bg-card p-3 text-center">
                      <p className="text-sm font-bold text-primary capitalize">{summary.suggested_frequency}</p>
                      <p className="text-[11px] text-muted-foreground">Frequency</p>
                    </div>
                  )}
                </div>

                {Array.isArray(summary.areas) && summary.areas.length > 0 && (
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Areas Breakdown</p>
                    <div className="space-y-2">
                      {summary.areas.map((a: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                          <div>
                            <p className="font-medium">{a.name}</p>
                            {Array.isArray(a.services) && (
                              <p className="text-[11px] text-muted-foreground">{a.services.slice(0, 2).join(", ")}{a.services.length > 2 ? ` +${a.services.length - 2}` : ""}</p>
                            )}
                          </div>
                          <div className="text-right">
                            {a.sqft > 0 && <p className="font-semibold">{a.sqft.toLocaleString()} sq ft</p>}
                            {a.frequency && <p className="text-[11px] text-muted-foreground capitalize">{a.frequency}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(summary.recommended_services) && summary.recommended_services.length > 0 && (
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recommended Services</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.recommended_services.map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-800 border-green-200">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(summary.special_considerations) && summary.special_considerations.length > 0 && (
                  <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Special Considerations
                    </p>
                    <ul className="space-y-1">
                      {summary.special_considerations.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-amber-800 flex gap-1.5"><span className="mt-0.5">•</span>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  data-testid="button-go-to-export"
                  className="w-full gap-2"
                  onClick={() => setActiveTab("export")}
                >
                  <Send className="w-4 h-4" /> Send to Proposal Builder
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Export Tab ──────────────────────────────────────────────────── */}
        {activeTab === "export" && (
          <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
            <h2 className="font-semibold">Export Options</h2>

            {!walk.summaryJson && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Generate an AI summary first to get the best results in the Proposal Builder.
              </div>
            )}

            {/* Send to Proposal Builder */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Send to Proposal Builder</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a pre-filled proposal with your scope sections, measurements, and pricing structure from this walk.
                  </p>
                </div>
              </div>
              <Button
                data-testid="button-send-to-proposal"
                className="mt-4 w-full gap-2"
                onClick={() => setSendToProposalOpen(true)}
              >
                <Send className="w-4 h-4" /> Create Proposal
              </Button>
            </div>

            {/* Walk report card */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Walk Report</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    View a summary of this jobsite walk including all photos, areas, and measurements.
                  </p>
                </div>
              </div>
              <Button
                data-testid="button-view-walk-report"
                variant="outline"
                className="mt-4 w-full gap-2"
                onClick={() => setActiveTab("summary")}
              >
                <Eye className="w-4 h-4" /> View Summary
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Photo Detail Dialog */}
      <PhotoDetailDialog
        photo={selectedPhoto}
        walkId={walk.id}
        measurements={walk.measurements}
        open={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />

      {/* Send to Proposal Dialog */}
      <Dialog open={sendToProposalOpen} onOpenChange={setSendToProposalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Create Proposal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">Fill in client details to pre-populate the proposal (all optional).</p>
            <div>
              <Label className="text-xs mb-1 block">Client Name</Label>
              <Input data-testid="input-proposal-client-name" placeholder="e.g. Acme Corp" value={proposalForm.clientName} onChange={e => setProposalForm(f => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Client Email</Label>
              <Input data-testid="input-proposal-client-email" type="email" placeholder="client@example.com" value={proposalForm.clientEmail} onChange={e => setProposalForm(f => ({ ...f, clientEmail: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Client Phone</Label>
              <Input data-testid="input-proposal-client-phone" placeholder="(555) 000-0000" value={proposalForm.clientPhone} onChange={e => setProposalForm(f => ({ ...f, clientPhone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Service Address</Label>
              <Input data-testid="input-proposal-service-address" placeholder="123 Main St" value={proposalForm.serviceAddress} onChange={e => setProposalForm(f => ({ ...f, serviceAddress: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendToProposalOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-confirm-create-proposal"
              disabled={sendToProposalMutation.isPending}
              onClick={() => sendToProposalMutation.mutate(proposalForm)}
            >
              {sendToProposalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Create Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
