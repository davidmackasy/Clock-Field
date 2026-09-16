import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCompanyInstant } from "@/lib/timezone";
import {
  MapPin, User, Calendar, ChevronRight, CheckCircle, Search, Eye, X,
  ChevronLeft, ChevronRight as ChevronRightIcon, Link, Copy, ExternalLink,
  Star, Shield, MessageSquare, Quote, Share2, Download, Pencil, Plus, Trash2, Camera,
  AlertTriangle, Zap, Maximize2,
} from "lucide-react";

function fmt(iso: string, timezone: string) {
  return formatCompanyInstant(iso, timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDate(d: string) {
  const [year, month, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

const MAX_PHOTO_DIM = 1800;
const JPEG_QUALITY = 0.80;
function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_PHOTO_DIM || height > MAX_PHOTO_DIM) {
          if (width >= height) { height = Math.round((height / width) * MAX_PHOTO_DIM); width = MAX_PHOTO_DIM; }
          else { width = Math.round((width / height) * MAX_PHOTO_DIM); height = MAX_PHOTO_DIM; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function StarDisplay({ value }: { value: number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
      ))}
    </div>
  );
}

interface LightboxPhoto { id: string; caption?: string }
interface LightboxState { photos: LightboxPhoto[]; idx: number; groupLabel: string; section: string; subArea: string }

function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const [idx, setIdx] = useState(state.idx);
  const photo = state.photos[idx];
  const total = state.photos.length;

  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(total - 1, i + 1));

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={0}
      data-testid="lightbox-overlay"
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
        onClick={onClose}
        data-testid="button-lightbox-close"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="absolute top-4 left-4 text-left">
        <p className="text-white/60 text-xs font-medium uppercase tracking-wide">{state.groupLabel}</p>
        <p className="text-white/80 text-sm font-semibold">{state.section} · {state.subArea}</p>
      </div>
      <div className="flex items-center gap-3 w-full max-w-4xl px-16" onClick={e => e.stopPropagation()}>
        <button
          className="p-2 text-white/60 hover:text-white disabled:opacity-20 transition-colors rounded-full hover:bg-white/10 shrink-0"
          onClick={prev}
          disabled={idx === 0}
          data-testid="button-lightbox-prev"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <img
            src={`/api/work-submission-photos/${photo.id}/image`}
            alt={photo.caption || ""}
            className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>
        <button
          className="p-2 text-white/60 hover:text-white disabled:opacity-20 transition-colors rounded-full hover:bg-white/10 shrink-0"
          onClick={next}
          disabled={idx === total - 1}
          data-testid="button-lightbox-next"
        >
          <ChevronRightIcon className="w-7 h-7" />
        </button>
      </div>
      <div className="absolute bottom-5 text-center space-y-1">
        {total > 1 && <p className="text-white/50 text-xs">{idx + 1} / {total}</p>}
        {photo.caption && <p className="text-white/70 text-sm">{photo.caption}</p>}
      </div>
    </div>
  );
}

function PhotoGrid({ photos, label, section, subArea, onPreview }: {
  photos: any[]; label: string; section: string; subArea: string; onPreview: (idx: number) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 italic">No {label.toLowerCase()}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
          {photos.map((p: any, i: number) => (
            <button
              key={p.id}
              className="relative group focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
              onClick={() => onPreview(i)}
              data-testid={`photo-thumb-${p.id}`}
            >
              <img
                src={`/api/work-submission-photos/${p.id}/image`}
                alt={p.caption || ""}
                className="w-full aspect-square object-cover rounded-md bg-muted border border-border"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-md transition-colors flex items-center justify-center">
                <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SubmissionDetailHandle { save: () => Promise<void> }

const SubmissionDetail = forwardRef<SubmissionDetailHandle, {
  subId: string;
  editMode: boolean;
  onSaveComplete: () => void;
}>(function SubmissionDetail({ subId, editMode, onSaveComplete }, ref) {
  const { toast } = useToast();
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // Edit state
  const [editServiceSummary, setEditServiceSummary] = useState("");
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [addedPhotos, setAddedPhotos] = useState<Record<string, Array<{ type: "before" | "after"; dataUrl: string }>>>({});
  const [removedPhotoIds, setRemovedPhotoIds] = useState<Set<string>>(new Set());
  const [uploadTarget, setUploadTarget] = useState<{ itemId: string; type: "before" | "after" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/work-submissions", subId],
    enabled: !!subId,
    staleTime: 30 * 1000,
  });

  // Re-init edit state when entering edit mode or data changes
  useEffect(() => {
    if (editMode && data) {
      setEditServiceSummary(data.serviceSummary || "");
      const notes: Record<string, string> = {};
      (data.items || []).forEach((item: any) => { notes[item.id] = item.notes || ""; });
      setItemNotes(notes);
      setAddedPhotos({});
      setRemovedPhotoIds(new Set());
    }
  }, [editMode, data?.id]);

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!data) return;
      // 1. Update service summary on submission
      await apiRequest("PATCH", `/api/work-submissions/${subId}`, { serviceSummary: editServiceSummary });
      // 2. Update each item's notes + photos
      const items: any[] = data.items || [];
      await Promise.all(items.map(async (item: any) => {
        const newNotes = itemNotes[item.id] !== undefined ? itemNotes[item.id] : (item.notes || "");
        const added = addedPhotos[item.id] || [];
        const addBefore = added.filter(p => p.type === "before").map(p => p.dataUrl);
        const addAfter = added.filter(p => p.type === "after").map(p => p.dataUrl);
        const removeIds = (item.photos || []).filter((p: any) => removedPhotoIds.has(p.id)).map((p: any) => p.id);
        const notesChanged = newNotes !== (item.notes || "");
        if (notesChanged || addBefore.length || addAfter.length || removeIds.length) {
          await apiRequest("PATCH", `/api/admin/work-submissions/${subId}/items/${item.id}`, {
            notes: newNotes || null,
            addBeforePhotos: addBefore,
            addAfterPhotos: addAfter,
            removePhotoIds: removeIds,
          });
        }
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions", subId] });
      toast({ title: "Changes saved", description: "The submission has been updated." });
      onSaveComplete();
    },
  }));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !uploadTarget) return;
    e.target.value = "";
    try {
      const compressed = await Promise.all(files.map(compressPhoto));
      const { itemId, type } = uploadTarget;
      setAddedPhotos(prev => ({
        ...prev,
        [itemId]: [...(prev[itemId] || []), ...compressed.map(dataUrl => ({ type, dataUrl }))],
      }));
    } catch {
      toast({ title: "Photo error", description: "Could not process the selected photo.", variant: "destructive" });
    }
    setUploadTarget(null);
  }

  const openLightbox = (photos: any[], idx: number, groupLabel: string, section: string, subArea: string) => {
    setLightbox({ photos, idx, groupLabel, section, subArea });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pt-2 flex-1 overflow-y-auto">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground py-6 text-center">Could not load submission.</p>;

  // ── View mode ───────────────────────────────────────────────────────────────
  if (!editMode) {
    return (
      <>
        {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
          {/* Service Summary display */}
          {data.serviceSummary && (
            <div className="bg-muted/50 border border-border rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Service Summary</p>
              <p className="text-sm text-muted-foreground italic">{data.serviceSummary}</p>
            </div>
          )}
          {!data.items?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No work items in this submission.</p>
          ) : (
            data.items.map((item: any, idx: number) => {
              const beforePhotos = (item.photos || []).filter((p: any) => p.photoType === "before");
              const afterPhotos = (item.photos || []).filter((p: any) => p.photoType === "after");
              return (
                <div key={item.id} className="border border-border rounded-xl p-3.5 space-y-3 bg-card">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{item.section}</span>
                      <p className="text-sm font-semibold">{item.subArea}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">Item {idx + 1}</span>
                  </div>
                  {item.notes && (
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground italic">{item.notes}</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    <PhotoGrid photos={beforePhotos} label="Before Photos" section={item.section} subArea={item.subArea}
                      onPreview={i => openLightbox(beforePhotos, i, "Before Photos", item.section, item.subArea)} />
                    <PhotoGrid photos={afterPhotos} label="After Photos" section={item.section} subArea={item.subArea}
                      onPreview={i => openLightbox(afterPhotos, i, "After Photos", item.section, item.subArea)} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  return (
    <>
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
      {/* Hidden photo file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
        {/* Service Summary */}
        <div className="border border-primary/30 rounded-xl p-3.5 bg-primary/5 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-primary">Service Summary</Label>
          <Textarea
            value={editServiceSummary}
            onChange={e => setEditServiceSummary(e.target.value)}
            placeholder="Optional intro shown at the top of the client report…"
            rows={3}
            className="text-sm resize-none"
            data-testid="edit-service-summary"
          />
          <p className="text-[10px] text-muted-foreground">This text appears at the top of the public client report before the work sections.</p>
        </div>

        {/* Work items */}
        {!data.items?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No work items in this submission.</p>
        ) : (
          data.items.map((item: any, idx: number) => {
            const existingBefore = (item.photos || []).filter((p: any) => p.photoType === "before" && !removedPhotoIds.has(p.id));
            const existingAfter = (item.photos || []).filter((p: any) => p.photoType === "after" && !removedPhotoIds.has(p.id));
            const newPhotos = addedPhotos[item.id] || [];
            const newBefore = newPhotos.filter(p => p.type === "before");
            const newAfter = newPhotos.filter(p => p.type === "after");

            return (
              <div key={item.id} className="border border-border rounded-xl p-3.5 space-y-3 bg-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{item.section}</span>
                    <p className="text-sm font-semibold">{item.subArea}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">Item {idx + 1}</span>
                </div>

                {/* Editable notes */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes / Observations</Label>
                  <Textarea
                    value={itemNotes[item.id] ?? (item.notes || "")}
                    onChange={e => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Add notes about this area…"
                    rows={2}
                    className="text-sm resize-none"
                    data-testid={`edit-notes-${item.id}`}
                  />
                </div>

                {/* Before photos */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Before Photos</p>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => { setUploadTarget({ itemId: item.id, type: "before" }); fileInputRef.current?.click(); }}
                      data-testid={`add-before-${item.id}`}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {existingBefore.map((p: any) => (
                      <div key={p.id} className="relative group">
                        <img src={`/api/work-submission-photos/${p.id}/image`} alt="" className="w-full aspect-square object-cover rounded-md border border-border" />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setRemovedPhotoIds(prev => new Set([...prev, p.id]))}
                          data-testid={`remove-photo-${p.id}`}
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {newBefore.map((p, i) => (
                      <div key={`new-before-${i}`} className="relative group">
                        <img src={p.dataUrl} alt="" className="w-full aspect-square object-cover rounded-md border-2 border-primary/40" />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setAddedPhotos(prev => ({ ...prev, [item.id]: (prev[item.id] || []).filter(x => x !== p) }))}
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {existingBefore.length === 0 && newBefore.length === 0 && (
                      <p className="col-span-4 text-xs text-muted-foreground/50 italic">No before photos</p>
                    )}
                  </div>
                </div>

                {/* After photos */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">After Photos</p>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => { setUploadTarget({ itemId: item.id, type: "after" }); fileInputRef.current?.click(); }}
                      data-testid={`add-after-${item.id}`}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {existingAfter.map((p: any) => (
                      <div key={p.id} className="relative group">
                        <img src={`/api/work-submission-photos/${p.id}/image`} alt="" className="w-full aspect-square object-cover rounded-md border border-border" />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setRemovedPhotoIds(prev => new Set([...prev, p.id]))}
                          data-testid={`remove-photo-${p.id}`}
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {newAfter.map((p, i) => (
                      <div key={`new-after-${i}`} className="relative group">
                        <img src={p.dataUrl} alt="" className="w-full aspect-square object-cover rounded-md border-2 border-primary/40" />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setAddedPhotos(prev => ({ ...prev, [item.id]: (prev[item.id] || []).filter(x => x !== p) }))}
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {existingAfter.length === 0 && newAfter.length === 0 && (
                      <p className="col-span-4 text-xs text-muted-foreground/50 italic">No after photos</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
});

// ─── Review Popup ──────────────────────────────────────────────────────────────
function ReviewPopup({ subId, onClose }: { subId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [showTestimonial, setShowTestimonial] = useState(false);
  const [testimonialCopied, setTestimonialCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const timezone = timezoneData?.timezone || "UTC";

  const { data: review, isLoading } = useQuery<any>({
    queryKey: ["/api/work-submissions", subId, "review"],
    queryFn: async () => {
      const res = await fetch(`/api/work-submissions/${subId}/review`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!subId,
    staleTime: 0,
  });

  const reviewShareUrl = review?.reviewShortCode
    ? `${window.location.origin}/v/${review.reviewShortCode}`
    : review?.reviewShareToken
    ? `${window.location.origin}/public/reviews/${review.reviewShareToken}`
    : null;

  function buildTestimonialText(r: any) {
    const stars = r.rating ? "★".repeat(r.rating) + "☆".repeat(5 - r.rating) : "";
    const lines = [
      stars && `${stars}`,
      `"${r.reviewText}"`,
      ``,
      `— ${r.clientName}${r.companyName ? `, ${r.companyName}` : ""}`,
      r.locationName ? `📍 ${r.locationName}` : "",
      `📅 Service Date: ${fmtDate(r.workDate)}`,
      r.employeeName ? `👷 Completed by: ${r.employeeName}` : "",
      ``,
      `✅ Verified by ClockField | Submitted through completed service report`,
    ].filter(l => l !== undefined);
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function copyTestimonialText(r: any) {
    try {
      await navigator.clipboard.writeText(buildTestimonialText(r));
      setTestimonialCopied(true);
      setTimeout(() => setTestimonialCopied(false), 2000);
      toast({ title: "Testimonial text copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  async function copyShareLink() {
    if (!reviewShareUrl) return;
    try {
      await navigator.clipboard.writeText(reviewShareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({ title: "Review share link copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  async function downloadCard(r: any) {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      const slug = (r.companyName || r.clientName || "review").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `review-${slug}-${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Card downloaded" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            Client Review
          </DialogTitle>
          <DialogDescription>Verified feedback from the public service report</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !review ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No review found.</p>
        ) : (
          <div className="space-y-4 py-1">
            {/* Review card */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Verified by ClockField</span>
                </div>
                {review.rating && <StarDisplay value={review.rating} />}
              </div>

              <div className="relative">
                <Quote className="w-6 h-6 text-muted-foreground/20 absolute -top-1 -left-1" />
                <p className="text-sm text-foreground leading-relaxed pl-5 italic">"{review.reviewText}"</p>
              </div>

              <div className="pt-1 border-t border-border">
                <p className="text-sm font-semibold">{review.clientName}</p>
                {review.companyName && <p className="text-xs text-muted-foreground">{review.companyName}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Service: {fmtDate(review.workDate)}</span>
                {review.employeeName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{review.employeeName}</span>}
                {review.locationName && <span className="flex items-center gap-1 col-span-2"><MapPin className="w-3 h-3" />{review.locationName}</span>}
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Submitted {fmt(review.submittedAt, timezone)}</span>
              </div>
            </div>

            {/* Share card preview — ref'd for download */}
            {showTestimonial && (
              <div
                ref={cardRef}
                className="rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 space-y-3"
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Social Proof Card</span>
                  {review.rating && <StarDisplay value={review.rating} />}
                </div>
                <p className="text-sm font-medium text-gray-900 leading-relaxed">"{review.reviewText}"</p>
                <div>
                  <p className="text-sm font-bold text-gray-900">{review.clientName}</p>
                  {review.companyName && <p className="text-xs text-gray-500">{review.companyName}</p>}
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {review.locationName && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{review.locationName}</p>}
                  <p className="flex items-center gap-1"><Calendar className="w-3 h-3" />Service date: {fmtDate(review.workDate)}</p>
                  {review.employeeName && <p className="flex items-center gap-1"><User className="w-3 h-3" />Completed by: {review.employeeName}</p>}
                </div>
                <div className="pt-2 border-t border-blue-200 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-600">Verified by ClockField · Submitted through completed service report</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setShowTestimonial(v => !v)}
                data-testid="button-toggle-testimonial"
              >
                <Share2 className="w-4 h-4" />
                {showTestimonial ? "Hide Share Card" : "Generate Share Card"}
              </Button>

              {showTestimonial && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => downloadCard(review)}
                  disabled={isDownloading}
                  data-testid="button-download-card"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? "Downloading..." : "Download Card"}
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => copyTestimonialText(review)}
                  data-testid="button-copy-testimonial"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {testimonialCopied ? "Copied!" : "Copy Review Text"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={copyShareLink}
                  disabled={!reviewShareUrl}
                  data-testid="button-copy-share-link"
                >
                  <Link className="w-3.5 h-3.5" />
                  {linkCopied ? "Copied!" : "Copy Share Link"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminWorkLog() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [detailSub, setDetailSub] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all"); // "all" | "has_review" | "no_review"
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const editRef = useRef<SubmissionDetailHandle>(null);

  // Priority Clean state
  const [paPhotoLightbox, setPaPhotoLightbox] = useState<{ photoIds: string[]; idx: number } | null>(null);
  const [paOpen, setPaOpen] = useState(false);
  const [paTitle, setPaTitle] = useState("Priority Clean Required");
  const [paMessage, setPaMessage] = useState("");
  const [paLocationId, setPaLocationId] = useState("");
  const [paEmployeeId, setPaEmployeeId] = useState("");
  const [paPhotos, setPaPhotos] = useState<Array<{ preview: string; dataUrl: string }>>([]);
  const [paCompressing, setPaCompressing] = useState(false);
  const paFileRef = useRef<HTMLInputElement>(null);
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const timezone = timezoneData?.timezone || "UTC";

  async function handleSaveEdits() {
    if (!editRef.current) return;
    setIsEditSaving(true);
    try {
      await editRef.current.save();
      setEditMode(false);
    } catch (e: any) {
      // error toast shown internally by save()
    } finally {
      setIsEditSaving(false);
    }
  }

  function closeDetail() {
    setDetailSub(null);
    setShareUrl(null);
    setCopied(false);
    setEditMode(false);
  }

  const { data: submissions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/work-submissions"],
    refetchInterval: 30 * 1000,
  });
  const { data: employees } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: allLocations } = useQuery<any[]>({ queryKey: ["/api/locations"] });
  const { data: priorityAlerts, refetch: refetchAlerts } = useQuery<any[]>({
    queryKey: ["/api/priority-alerts"],
    refetchInterval: 60 * 1000,
  });

  const createPaMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/priority-alerts", data);
      return res.json();
    },
    onSuccess: () => {
      refetchAlerts();
      setPaOpen(false);
      setPaTitle("Priority Clean Required");
      setPaMessage("");
      setPaLocationId("");
      setPaEmployeeId("");
      setPaPhotos([]);
      toast({ title: "Priority clean alert created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resolvePaMut = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("PATCH", `/api/priority-alerts/${alertId}`, { status: "resolved" });
      return res.json();
    },
    onSuccess: () => { refetchAlerts(); toast({ title: "Alert resolved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePaMut = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("DELETE", `/api/priority-alerts/${alertId}`);
    },
    onSuccess: () => { refetchAlerts(); toast({ title: "Alert deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handlePaPhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPaCompressing(true);
    try {
      const dataUrls = await Promise.all(files.map(f => compressPhoto(f)));
      setPaPhotos(prev => [...prev, ...dataUrls.map(d => ({ preview: d, dataUrl: d }))]);
    } finally {
      setPaCompressing(false);
      if (paFileRef.current) paFileRef.current.value = "";
    }
  }

  function handleCreatePa() {
    if (!paEmployeeId) { toast({ title: "Employee is required", variant: "destructive" }); return; }
    if (!paTitle.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    createPaMut.mutate({
      assignedEmployeeId: paEmployeeId,
      title: paTitle.trim(),
      message: paMessage.trim() || null,
      locationId: (paLocationId && paLocationId !== "none") ? paLocationId : null,
      photos: paPhotos.map(p => p.dataUrl),
      visibleOnPublicLink: true,
    });
  }

  const markReviewedMut = useMutation({
    mutationFn: async (subId: string) => {
      const res = await apiRequest("PATCH", `/api/work-submissions/${subId}`, { status: "reviewed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      if (detailSub) setDetailSub((prev: any) => ({ ...prev, status: "reviewed" }));
      toast({ title: "Marked as reviewed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateLinkMut = useMutation({
    mutationFn: async (subId: string) => {
      const res = await apiRequest("POST", `/api/work-submissions/${subId}/share`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      const fullUrl = `${window.location.origin}${data.shortUrl || data.url}`;
      setShareUrl(fullUrl);
      if (detailSub) setDetailSub((prev: any) => ({ ...prev, publicShareToken: data.token, publicShareEnabled: true, reportShortCode: data.shortCode }));
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      toast({ title: "Public link ready" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually", variant: "destructive" });
    }
  };

  const empMap: Record<string, string> = {};
  (employees || []).forEach((e: any) => { empMap[e.id] = `${e.firstName} ${e.lastName}`; });

  const filtered = (submissions || []).filter(s => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (reviewFilter === "has_review" && !s.hasReview) return false;
    if (reviewFilter === "no_review" && s.hasReview) return false;
    if (!search) return true;
    const emp = empMap[s.employeeId] || "";
    return emp.toLowerCase().includes(search.toLowerCase()) ||
      (s.locationName || "").toLowerCase().includes(search.toLowerCase()) ||
      s.workDate.includes(search);
  });

  const statusVariant: Record<string, string> = { draft: "secondary", submitted: "default", reviewed: "secondary" };
  const statusColor: Record<string, string> = { reviewed: "text-emerald-600 dark:text-emerald-400" };

  const totalReviews = (submissions || []).filter(s => s.hasReview).length;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Work Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review cleaner work submissions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {totalReviews > 0 && (
            <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
              <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              {totalReviews} review{totalReviews !== 1 ? "s" : ""}
            </Badge>
          )}
          {!isLoading && (
            <Badge variant="outline" className="text-xs">
              {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-red-600 hover:bg-red-700 text-white border-0"
            onClick={() => setPaOpen(true)}
            data-testid="button-report-priority-clean"
          >
            <Zap className="w-3.5 h-3.5" />
            Priority Clean
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee, location, date..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "submitted", "reviewed", "draft"].map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="h-9 capitalize text-xs"
              onClick={() => setStatusFilter(s)}
              data-testid={`button-filter-${s}`}
            >
              {s}
            </Button>
          ))}
          <div className="w-px bg-border self-stretch mx-0.5" />
          <Button
            variant={reviewFilter === "has_review" ? "default" : "outline"}
            size="sm"
            className={`h-9 text-xs gap-1.5 ${reviewFilter === "has_review" ? "" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
            onClick={() => setReviewFilter(v => v === "has_review" ? "all" : "has_review")}
            data-testid="button-filter-has-review"
          >
            <Star className="w-3 h-3" />
            Has Review
          </Button>
        </div>
      </div>

      {/* Open Priority Alerts banner */}
      {priorityAlerts && priorityAlerts.filter(a => a.status === "open").length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {priorityAlerts.filter(a => a.status === "open").length} Open Priority Clean Alert{priorityAlerts.filter(a => a.status === "open").length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-2">
            {priorityAlerts.filter(a => a.status === "open").map((alert: any) => {
              const loc = (allLocations || []).find((l: any) => l.id === alert.locationId);
              const emp = (employees || []).find((e: any) => e.id === alert.assignedEmployeeId);
              return (
                <div key={alert.id} className="bg-white dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-800 p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">{alert.title}</p>
                    {loc && <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{loc.name}</p>}
                    {emp && <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><User className="w-3 h-3" />{emp.firstName} {emp.lastName}</p>}
                    {alert.message && <p className="text-xs text-red-600/80 dark:text-red-400/80 line-clamp-2">{alert.message}</p>}
                    <p className="text-[10px] text-red-400">Created {fmt(alert.createdAt, timezone)}</p>
                    {alert.photos && alert.photos.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {alert.photos.map((p: any, pi: number) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPaPhotoLightbox({ photoIds: alert.photos.map((x: any) => x.id), idx: pi })}
                            className="relative w-12 h-12 rounded-md overflow-hidden border border-red-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-red-400 active:scale-95 transition-transform"
                            data-testid={`pa-admin-photo-${p.id}`}
                          >
                            <img src={`/api/priority-alert-photos/${p.id}/image`} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                              <Maximize2 className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => resolvePaMut.mutate(alert.id)}
                      disabled={resolvePaMut.isPending}
                      data-testid={`button-resolve-alert-${alert.id}`}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deletePaMut.mutate(alert.id)}
                      disabled={deletePaMut.isPending}
                      data-testid={`button-delete-alert-${alert.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submissions list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{submissions?.length === 0 ? "No work submissions yet." : "No results match your search."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub: any) => {
            const empName = empMap[sub.employeeId] || "Unknown Employee";
            return (
              <Card
                key={sub.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => { setDetailSub(sub); setShareUrl(sub.publicShareToken && sub.publicShareEnabled ? (sub.reportShortCode ? `${window.location.origin}/r/${sub.reportShortCode}` : `${window.location.origin}/public/work-report/${sub.publicShareToken}`) : null); }}
                data-testid={`card-submission-${sub.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{empName}</p>
                        <Badge
                          variant={(statusVariant[sub.status] as any) || "secondary"}
                          className={`text-[10px] capitalize ${statusColor[sub.status] || ""}`}
                        >
                          {sub.status}
                        </Badge>
                        {sub.hasReview && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30"
                            data-testid={`badge-review-${sub.id}`}
                          >
                            <Star className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
                            Client Review
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{sub.workDate}</span>
                        {sub.locationName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sub.locationName}</span>}
                        {sub.submittedAt && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Submitted {fmt(sub.submittedAt, timezone)}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Priority Clean Alert Dialog */}
      <Dialog open={paOpen} onOpenChange={v => { setPaOpen(v); if (!v) { setPaTitle("Priority Clean Required"); setPaMessage(""); setPaLocationId(""); setPaEmployeeId(""); setPaPhotos([]); } }}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-600" />
              Report Priority Clean
            </DialogTitle>
            <DialogDescription>Create an urgent clean alert that the selected employee will see when starting their next work session at this location.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location (optional)</Label>
              <Select value={paLocationId} onValueChange={setPaLocationId}>
                <SelectTrigger className="mt-1" data-testid="select-pa-location">
                  <SelectValue placeholder="All locations / unspecified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All locations / unspecified</SelectItem>
                  {(allLocations || []).map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee *</Label>
              <Select value={paEmployeeId} onValueChange={setPaEmployeeId}>
                <SelectTrigger className="mt-1" data-testid="select-pa-employee">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {(employees || []).filter((e: any) => e.role !== "admin").map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alert Title *</Label>
              <Input
                className="mt-1 text-sm"
                value={paTitle}
                onChange={e => setPaTitle(e.target.value)}
                placeholder="Priority Clean Required"
                data-testid="input-pa-title"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instructions / Notes</Label>
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={3}
                value={paMessage}
                onChange={e => setPaMessage(e.target.value)}
                placeholder="Describe what needs special attention — e.g. 'Deep clean the main bathroom. Check under sinks for mold.'"
                data-testid="textarea-pa-message"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Issue Photos (optional)</Label>
              <div className="mt-1.5 space-y-2">
                {paPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {paPhotos.map((p, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                        <img src={p.preview} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPaPhotos(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={paCompressing}
                  onClick={() => paFileRef.current?.click()}
                  data-testid="button-pa-add-photos"
                >
                  <Camera className="w-3 h-3 mr-1" />
                  {paCompressing ? "Processing…" : "Add Issue Photos"}
                </Button>
                <input ref={paFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePaPhotoAdd} />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPaOpen(false)} data-testid="button-pa-cancel">Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCreatePa}
                disabled={createPaMut.isPending || !paTitle.trim()}
                data-testid="button-pa-submit"
              >
                <Zap className="w-4 h-4 mr-1" />
                {createPaMut.isPending ? "Creating..." : "Create Alert"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Popup — rendered on top of the detail dialog */}
      {showReviewPopup && detailSub && (
        <ReviewPopup
          subId={detailSub.id}
          onClose={() => setShowReviewPopup(false)}
        />
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailSub} onOpenChange={(v) => { if (!v && !showReviewPopup) closeDetail(); }}>
        <DialogContent className="max-w-2xl mx-auto max-h-[90vh] flex flex-col gap-4">
          {detailSub && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  Work Submission
                  <Badge
                    variant={(statusVariant[detailSub.status] as any) || "secondary"}
                    className={`text-[10px] capitalize ${statusColor[detailSub.status] || ""}`}
                  >
                    {detailSub.status}
                  </Badge>
                  {detailSub.hasReview && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
                      <Star className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
                      Has Review
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{empMap[detailSub.employeeId] || detailSub.employeeId}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{detailSub.workDate}</span>
                    {detailSub.locationName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{detailSub.locationName}</span>}
                    {detailSub.submittedAt && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Submitted {fmt(detailSub.submittedAt, timezone)}</span>}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <SubmissionDetail
                ref={editRef}
                subId={detailSub.id}
                editMode={editMode}
                onSaveComplete={() => setEditMode(false)}
              />

              <div className="pt-2 border-t shrink-0 space-y-2">
                {editMode ? (
                  /* ── Edit mode footer ─────────────────────────────────────── */
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEditMode(false)}
                      disabled={isEditSaving}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      onClick={handleSaveEdits}
                      disabled={isEditSaving}
                      data-testid="button-save-edits"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isEditSaving ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                ) : (
                  /* ── Normal footer ────────────────────────────────────────── */
                  <>
                    {/* Review button */}
                    {detailSub.hasReview && (
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={() => setShowReviewPopup(true)}
                        data-testid="button-view-review"
                      >
                        <MessageSquare className="w-4 h-4" />
                        View Client Review
                      </Button>
                    )}

                    {/* Share link area */}
                    {shareUrl ? (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-muted rounded-lg px-3 py-2 min-w-0">
                          <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">{shareUrl}</p>
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0 h-9" onClick={copyLink} data-testid="button-copy-link">
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          {copied ? "Copied!" : "Copy"}
                        </Button>
                        <Button variant="outline" size="sm" className="shrink-0 h-9" onClick={() => window.open(shareUrl, "_blank")} data-testid="button-open-link">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => generateLinkMut.mutate(detailSub.id)}
                        disabled={generateLinkMut.isPending}
                        data-testid="button-generate-link"
                      >
                        <Link className="w-4 h-4 mr-2" />
                        {generateLinkMut.isPending ? "Generating..." : "Generate Public Link"}
                      </Button>
                    )}

                    {/* Mark reviewed + Edit submission row */}
                    <div className={`flex gap-2 ${detailSub.status === "submitted" ? "" : ""}`}>
                      {(detailSub.status === "submitted" || detailSub.status === "reviewed") && (
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => setEditMode(true)}
                          data-testid="button-edit-submission"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit Submission
                        </Button>
                      )}
                      {detailSub.status === "submitted" && (
                        <Button
                          className="flex-1"
                          onClick={() => markReviewedMut.mutate(detailSub.id)}
                          disabled={markReviewedMut.isPending}
                          data-testid="button-mark-reviewed"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {markReviewedMut.isPending ? "Marking..." : "Mark as Reviewed"}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Priority Alert Photo Lightbox */}
      {paPhotoLightbox && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center"
          onClick={() => setPaPhotoLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setPaPhotoLightbox(null)}
            data-testid="button-pa-lightbox-close"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-colors"
            disabled={paPhotoLightbox.idx === 0}
            onClick={e => { e.stopPropagation(); setPaPhotoLightbox(p => p ? { ...p, idx: p.idx - 1 } : null); }}
            data-testid="button-pa-lightbox-prev"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <img
            src={`/api/priority-alert-photos/${paPhotoLightbox.photoIds[paPhotoLightbox.idx]}/image`}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-colors"
            disabled={paPhotoLightbox.idx === paPhotoLightbox.photoIds.length - 1}
            onClick={e => { e.stopPropagation(); setPaPhotoLightbox(p => p ? { ...p, idx: p.idx + 1 } : null); }}
            data-testid="button-pa-lightbox-next"
          >
            <ChevronRightIcon className="w-8 h-8" />
          </button>
          {paPhotoLightbox.photoIds.length > 1 && (
            <p className="absolute bottom-6 text-white/60 text-sm">{paPhotoLightbox.idx + 1} / {paPhotoLightbox.photoIds.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
