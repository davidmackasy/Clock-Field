import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Trash2, Camera, CheckCircle, Clock, ChevronRight, Image, AlertCircle, Pencil, Zap, X as XIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "lucide-react";

const SECTIONS = ["Washrooms", "Offices", "Floors", "Kitchen", "Stairs", "Common Area", "Reception", "Garbage", "Supplies", "Other"];

const SUB_AREA_SUGGESTIONS: Record<string, string[]> = {
  Washrooms: ["Washroom 1", "Washroom 2", "Sink Area", "Toilet Area", "Mirror Area", "Floor"],
  Offices: ["Office 1", "Office 2", "Boardroom", "Desk Area", "Reception Desk"],
  Floors: ["Main Floor", "2nd Floor", "3rd Floor", "Hallway", "Lobby"],
  Kitchen: ["Counter", "Sink", "Fridge Exterior", "Floor", "Garbage Area", "Microwave"],
  Stairs: ["Stairwell 1", "Stairwell 2", "Handrails", "Landing"],
  "Common Area": ["Lounge", "Waiting Room", "Entrance", "Lobby"],
  Reception: ["Front Desk", "Waiting Area", "Entrance Doors"],
  Garbage: ["Garbage Room", "Recycling Area", "Bin Cleaning"],
  Supplies: ["Supply Closet", "Storage Room"],
  Other: ["General Area", "Special Task"],
};

type PhotoItem = { preview: string; dataUrl: string };

interface WorkItemDraft {
  section: string;
  subArea: string;
  notes: string;
  beforePhotos: PhotoItem[];
  afterPhotos: PhotoItem[];
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
          if (width >= height) {
            height = Math.round((height / width) * MAX_PHOTO_DIM);
            width = MAX_PHOTO_DIM;
          } else {
            width = Math.round((width / height) * MAX_PHOTO_DIM);
            height = MAX_PHOTO_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
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

function PhotoGrid({ photos, onRemove, label }: { photos: PhotoItem[]; onRemove: (i: number) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-muted">
            <img src={p.preview} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
            >
              <Trash2 className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddPhotoButton({ onAdd, disabled, label }: { onAdd: (photos: PhotoItem[]) => void; disabled: boolean; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setCompressing(true);
    try {
      const dataUrls = await Promise.all(files.map(f => compressPhoto(f)));
      onAdd(dataUrls.map(dataUrl => ({ preview: dataUrl, dataUrl })));
    } finally {
      setCompressing(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={disabled || compressing} onClick={() => ref.current?.click()}>
        <Camera className="w-3 h-3 mr-1" /> {compressing ? "Processing…" : label}
      </Button>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
    </>
  );
}

export default function EmployeeWorkLog() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [startOpen, setStartOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editDraft, setEditDraft] = useState<{
    notes: string;
    newBeforePhotos: PhotoItem[];
    newAfterPhotos: PhotoItem[];
    removePhotoIds: string[];
  }>({ notes: "", newBeforePhotos: [], newAfterPhotos: [], removePhotoIds: [] });
  const [activeSub, setActiveSub] = useState<any>(null);
  const [serviceSummary, setServiceSummary] = useState("");
  const [detailSub, setDetailSub] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [draft, setDraft] = useState<WorkItemDraft>({
    section: "", subArea: "", notes: "", beforePhotos: [], afterPhotos: [],
  });

  const { data: activeEntry } = useQuery<any>({
    queryKey: ["/api/time-entries/active", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/time-entries/active", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user?.id,
  });
  const { data: locations } = useQuery<any[]>({
    queryKey: ["/api/employee/locations", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/employee/locations", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user?.id && startOpen,
  });
  const { data: submissions, isLoading: subsLoading } = useQuery<any[]>({
    queryKey: ["/api/work-submissions", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/work-submissions", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user?.id,
  });
  const { data: subDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/work-submissions", activeSub?.id],
    enabled: !!activeSub?.id,
    refetchInterval: activeSub?.status === "draft" ? 5000 : false,
  });

  const { data: priorityAlerts } = useQuery<any[]>({
    queryKey: ["/api/priority-alerts/location", activeSub?.locationId],
    queryFn: async () => {
      if (!activeSub?.locationId) return [];
      const res = await fetch(`/api/priority-alerts/location/${activeSub.locationId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeSub?.locationId,
    refetchInterval: 30000,
  });

  const [paLightbox, setPaLightbox] = useState<{ alertId: string; photoIds: string[]; idx: number } | null>(null);

  const createSubMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/work-submissions", data);
      return res.json();
    },
    onSuccess: (sub) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      setActiveSub(sub);
      setStartOpen(false);
      toast({ title: "Work session started!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addItemMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/work-submissions/${activeSub.id}/items`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions", activeSub.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      setAddItemOpen(false);
      setDraft({ section: "", subArea: "", notes: "", beforePhotos: [], afterPhotos: [] });
      toast({ title: "Work item saved!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteItemMut = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/work-submissions/${activeSub.id}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions", activeSub.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
    },
  });

  const updateItemMut = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/work-submissions/${activeSub.id}/items/${itemId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions", activeSub.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      setEditOpen(false);
      setEditItem(null);
      setEditDraft({ notes: "", newBeforePhotos: [], newAfterPhotos: [], removePhotoIds: [] });
      toast({ title: "Work item updated!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const body: any = { status: "submitted" };
      if (serviceSummary.trim()) body.serviceSummary = serviceSummary.trim();
      const res = await apiRequest("PATCH", `/api/work-submissions/${activeSub.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions", activeSub.id] });
      setActiveSub(null);
      setServiceSummary("");
      toast({ title: "Work submitted!", description: "Your work log has been sent for review." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isClocked = !!activeEntry;
  const items = subDetail?.items || [];
  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

  function handleStartWork() {
    if (!selectedLocation) {
      toast({ title: "Select a location first", variant: "destructive" });
      return;
    }
    createSubMut.mutate({ locationId: selectedLocation.id, locationName: selectedLocation.name });
  }

  function handleAddItem() {
    if (!draft.section || !draft.subArea) {
      toast({ title: "Section and area are required", variant: "destructive" });
      return;
    }
    addItemMut.mutate({
      section: draft.section,
      subArea: draft.subArea,
      notes: draft.notes || null,
      beforePhotos: draft.beforePhotos.map(p => p.dataUrl),
      afterPhotos: draft.afterPhotos.map(p => p.dataUrl),
    });
  }

  function openDetail(sub: any) {
    setDetailSub(sub);
    setDetailOpen(true);
  }

  function openEditItem(item: any) {
    setEditItem(item);
    setEditDraft({
      notes: item.notes || "",
      newBeforePhotos: [],
      newAfterPhotos: [],
      removePhotoIds: [],
    });
    setEditOpen(true);
  }

  function handleUpdateItem() {
    if (!editItem) return;
    updateItemMut.mutate({
      itemId: editItem.id,
      data: {
        notes: editDraft.notes || null,
        addBeforePhotos: editDraft.newBeforePhotos.map(p => p.dataUrl),
        addAfterPhotos: editDraft.newAfterPhotos.map(p => p.dataUrl),
        removePhotoIds: editDraft.removePhotoIds,
      },
    });
  }

  // Auto-restore a single open draft when the page loads and no active session is set
  useEffect(() => {
    if (!submissions) return;
    // Only auto-restore if no active session at all yet
    setActiveSub((prev: any) => {
      if (prev) return prev;
      const drafts = submissions.filter((s: any) => s.status === "draft");
      if (drafts.length === 1) return drafts[0];
      return prev;
    });
  }, [submissions]);

  function resumeDraft(sub: any) {
    setActiveSub(sub);
    // Scroll to top so the active session card is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pastSubs = (submissions || []).filter(s => !activeSub || s.id !== activeSub.id);

  return (
    <div className="p-4 pb-28 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Work Log</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Clock-in warning */}
      {!isClocked && !activeSub && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Clock in first</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Please clock in before documenting work.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Draft Session */}
      {activeSub && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Active Session</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {activeSub.locationName || "Location not set"}
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px]">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
            </div>

            {/* Priority Clean Alert(s) */}
            {priorityAlerts && priorityAlerts.length > 0 && (
              <div className="rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700 p-3 space-y-2">
                {priorityAlerts.map((alert: any) => (
                  <div key={alert.id}>
                    <div className="flex items-start gap-2 mb-1.5">
                      <Zap className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">{alert.title}</p>
                        {alert.message && <p className="text-xs text-red-600 dark:text-red-300 mt-0.5 leading-relaxed">{alert.message}</p>}
                      </div>
                    </div>
                    {alert.photos && alert.photos.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {alert.photos.map((p: any, i: number) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPaLightbox({ alertId: alert.id, photoIds: alert.photos.map((x: any) => x.id), idx: i })}
                            className="w-16 h-16 rounded-md overflow-hidden border-2 border-red-300 focus:outline-none focus:ring-2 focus:ring-red-400"
                          >
                            <img src={`/api/priority-alert-photos/${p.id}/image`} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Service Summary field */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Service Summary (optional)</Label>
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={3}
                placeholder="Briefly describe the service — e.g. 'Full office clean completed including washrooms, floors mopped, and supplies restocked.'"
                value={serviceSummary}
                onChange={e => setServiceSummary(e.target.value)}
                data-testid="textarea-service-summary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">This will appear as the intro text on the client's public report.</p>
            </div>

            {/* Work items list */}
            {detailLoading ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No work items yet. Add your first area.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item: any) => {
                  const beforeCount = item.photos?.filter((p: any) => p.photoType === "before").length || 0;
                  const afterCount = item.photos?.filter((p: any) => p.photoType === "after").length || 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-background rounded-lg px-3 py-2.5 border border-border hover:border-primary/40 transition-colors cursor-pointer"
                      onClick={() => openEditItem(item)}
                      data-testid={`card-work-item-${item.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.section}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subArea}</p>
                        {(beforeCount > 0 || afterCount > 0) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {beforeCount > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Image className="w-3 h-3" />Before: {beforeCount}
                              </span>
                            )}
                            {afterCount > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Image className="w-3 h-3" />After: {afterCount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteItemMut.mutate(item.id); }}
                          disabled={deleteItemMut.isPending}
                          data-testid={`button-delete-item-${item.id}`}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setAddItemOpen(true)}
                data-testid="button-add-work-item"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Area
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => submitMut.mutate()}
                disabled={items.length === 0 || submitMut.isPending}
                data-testid="button-submit-work"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {submitMut.isPending ? "Submitting..." : "Submit Work"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Work button — only when clocked in and no active session */}
      {isClocked && !activeSub && (
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={() => setStartOpen(true)}
          data-testid="button-start-work"
        >
          <Plus className="w-5 h-5 mr-2" /> Start Work Session
        </Button>
      )}

      {/* Past Submissions */}
      {pastSubs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">History</h2>
          {subsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            pastSubs.map((sub: any) => {
              const isDraft = sub.status === "draft";
              return (
                <Card
                  key={sub.id}
                  className={`cursor-pointer transition-colors ${isDraft ? "border-amber-300 hover:border-amber-400 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-700" : "hover:border-primary/50"}`}
                  onClick={() => isDraft ? resumeDraft(sub) : openDetail(sub)}
                  data-testid={`card-submission-${sub.id}`}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{sub.workDate}</p>
                        <Badge
                          variant={sub.status === "submitted" ? "default" : "secondary"}
                          className={`text-[10px] capitalize ${isDraft ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : ""}`}
                        >
                          {isDraft ? "Draft — tap to resume" : sub.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{sub.locationName || "No location"}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isDraft ? "text-amber-400" : "text-muted-foreground"}`} />
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {submissions && submissions.length === 0 && !activeSub && !isClocked && (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No work submissions yet.</p>
          <p className="text-xs mt-1">Clock in, then tap the + button to document your work.</p>
        </div>
      )}

      {/* Start Work Dialog */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Start Work Session</DialogTitle>
            <DialogDescription>Select the location you're working at today.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</Label>
              {!locations ? (
                <Skeleton className="h-10 w-full mt-1" />
              ) : locations.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No locations available. Contact your admin.</p>
              ) : (
                <div className="space-y-2 mt-2">
                  {locations.map((loc: any) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setSelectedLocation(loc)}
                      data-testid={`button-location-${loc.id}`}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors text-sm ${
                        selectedLocation?.id === loc.id
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">{loc.name}</p>
                      {loc.address && <p className="text-xs text-muted-foreground mt-0.5">{loc.address}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleStartWork}
              disabled={!selectedLocation || createSubMut.isPending}
              data-testid="button-confirm-start-work"
            >
              {createSubMut.isPending ? "Starting..." : "Start Work"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Work Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={(v) => { setAddItemOpen(v); if (!v) setDraft({ section: "", subArea: "", notes: "", beforePhotos: [], afterPhotos: [] }); }}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Work Area</DialogTitle>
            <DialogDescription>Document what was cleaned or worked on.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Section *</Label>
              <Select value={draft.section} onValueChange={(v) => setDraft(d => ({ ...d, section: v, subArea: "" }))}>
                <SelectTrigger className="mt-1" data-testid="select-section">
                  <SelectValue placeholder="Choose section..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Area / Sub-area *</Label>
              {draft.section && (SUB_AREA_SUGGESTIONS[draft.section]?.length > 0) ? (
                <div className="mt-1 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {SUB_AREA_SUGGESTIONS[draft.section].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDraft(d => ({ ...d, subArea: s }))}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          draft.subArea === s ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="Or type custom area..."
                    value={draft.subArea}
                    onChange={e => setDraft(d => ({ ...d, subArea: e.target.value }))}
                    className="h-9 text-sm"
                    data-testid="input-sub-area"
                  />
                </div>
              ) : (
                <Input
                  placeholder="e.g. Washroom 1, Office 3..."
                  value={draft.subArea}
                  onChange={e => setDraft(d => ({ ...d, subArea: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                  data-testid="input-sub-area"
                />
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this area..."
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                className="mt-1 resize-none text-sm"
                rows={2}
                data-testid="textarea-notes"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Before Photos</Label>
                  <AddPhotoButton
                    label="Add Before"
                    disabled={draft.beforePhotos.length >= 4}
                    onAdd={(photos) => setDraft(d => ({ ...d, beforePhotos: [...d.beforePhotos, ...photos].slice(0, 4) }))}
                  />
                </div>
                {draft.beforePhotos.length > 0 && (
                  <PhotoGrid
                    photos={draft.beforePhotos}
                    label="Before"
                    onRemove={(i) => setDraft(d => ({ ...d, beforePhotos: d.beforePhotos.filter((_, idx) => idx !== i) }))}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">After Photos</Label>
                  <AddPhotoButton
                    label="Add After"
                    disabled={draft.afterPhotos.length >= 4}
                    onAdd={(photos) => setDraft(d => ({ ...d, afterPhotos: [...d.afterPhotos, ...photos].slice(0, 4) }))}
                  />
                </div>
                {draft.afterPhotos.length > 0 && (
                  <PhotoGrid
                    photos={draft.afterPhotos}
                    label="After"
                    onRemove={(i) => setDraft(d => ({ ...d, afterPhotos: d.afterPhotos.filter((_, idx) => idx !== i) }))}
                  />
                )}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleAddItem}
              disabled={addItemMut.isPending}
              data-testid="button-save-work-item"
            >
              {addItemMut.isPending ? "Saving..." : "Save Work Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Work Item Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => {
        setEditOpen(v);
        if (!v) { setEditItem(null); setEditDraft({ notes: "", newBeforePhotos: [], newAfterPhotos: [], removePhotoIds: [] }); }
      }}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work Area</DialogTitle>
            <DialogDescription>
              {editItem?.section} — {editItem?.subArea}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Locked section/area */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Section</Label>
                <div className="mt-1 h-9 px-3 flex items-center rounded-md border border-border bg-muted text-sm text-muted-foreground">{editItem?.section}</div>
              </div>
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Area</Label>
                <div className="mt-1 h-9 px-3 flex items-center rounded-md border border-border bg-muted text-sm text-muted-foreground truncate">{editItem?.subArea}</div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this area..."
                value={editDraft.notes}
                onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                className="mt-1 resize-none text-sm"
                rows={2}
                data-testid="textarea-edit-notes"
              />
            </div>

            {/* Before photos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Before Photos</Label>
                <AddPhotoButton
                  label="Add Before"
                  disabled={false}
                  onAdd={(photos) => setEditDraft(d => ({ ...d, newBeforePhotos: [...d.newBeforePhotos, ...photos] }))}
                />
              </div>
              {/* Existing before photos */}
              {editItem?.photos?.filter((p: any) => p.photoType === "before" && !editDraft.removePhotoIds.includes(p.id)).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved</p>
                  <div className="flex flex-wrap gap-2">
                    {editItem.photos.filter((p: any) => p.photoType === "before" && !editDraft.removePhotoIds.includes(p.id)).map((p: any) => (
                      <div key={p.id} className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-muted">
                        <img src={`/api/work-submission-photos/${p.id}/image`} alt="" className="w-full h-full object-cover" loading="lazy" />
                        <button
                          type="button"
                          onClick={() => setEditDraft(d => ({ ...d, removePhotoIds: [...d.removePhotoIds, p.id] }))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* New before photos */}
              {editDraft.newBeforePhotos.length > 0 && (
                <PhotoGrid
                  photos={editDraft.newBeforePhotos}
                  label="New"
                  onRemove={(i) => setEditDraft(d => ({ ...d, newBeforePhotos: d.newBeforePhotos.filter((_, idx) => idx !== i) }))}
                />
              )}
            </div>

            {/* After photos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">After Photos</Label>
                <AddPhotoButton
                  label="Add After"
                  disabled={false}
                  onAdd={(photos) => setEditDraft(d => ({ ...d, newAfterPhotos: [...d.newAfterPhotos, ...photos] }))}
                />
              </div>
              {/* Existing after photos */}
              {editItem?.photos?.filter((p: any) => p.photoType === "after" && !editDraft.removePhotoIds.includes(p.id)).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved</p>
                  <div className="flex flex-wrap gap-2">
                    {editItem.photos.filter((p: any) => p.photoType === "after" && !editDraft.removePhotoIds.includes(p.id)).map((p: any) => (
                      <div key={p.id} className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-muted">
                        <img src={`/api/work-submission-photos/${p.id}/image`} alt="" className="w-full h-full object-cover" loading="lazy" />
                        <button
                          type="button"
                          onClick={() => setEditDraft(d => ({ ...d, removePhotoIds: [...d.removePhotoIds, p.id] }))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* New after photos */}
              {editDraft.newAfterPhotos.length > 0 && (
                <PhotoGrid
                  photos={editDraft.newAfterPhotos}
                  label="New"
                  onRemove={(i) => setEditDraft(d => ({ ...d, newAfterPhotos: d.newAfterPhotos.filter((_, idx) => idx !== i) }))}
                />
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleUpdateItem}
              disabled={updateItemMut.isPending}
              data-testid="button-save-edit-work-item"
            >
              {updateItemMut.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submission Detail Modal (history) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm mx-auto max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Work Submission</DialogTitle>
            <DialogDescription>
              {detailSub?.workDate} — {detailSub?.locationName || "No location"}
            </DialogDescription>
          </DialogHeader>
          {detailSub && <SubmissionDetail subId={detailSub.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmissionDetail({ subId }: { subId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/work-submissions", subId],
    enabled: !!subId,
  });

  if (isLoading) return <div className="space-y-3 pt-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (!data) return <p className="text-sm text-muted-foreground py-4 text-center">Unable to load details.</p>;

  return (
    <div className="flex-1 overflow-y-auto space-y-4 py-2">
      {!data.items?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">No work items recorded.</p>
      ) : (
        data.items.map((item: any, idx: number) => (
          <div key={item.id} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{item.section}</p>
                <p className="text-xs text-muted-foreground">{item.subArea}</p>
              </div>
              <span className="text-xs text-muted-foreground">#{idx + 1}</span>
            </div>
            {item.notes && <p className="text-xs text-muted-foreground bg-muted rounded p-2">{item.notes}</p>}
            {item.photos?.length > 0 && (
              <div className="space-y-2">
                {["before", "after"].map(type => {
                  const typed = item.photos.filter((p: any) => p.photoType === type);
                  if (!typed.length) return null;
                  return (
                    <div key={type}>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 capitalize">{type} Photos</p>
                      <div className="grid grid-cols-3 gap-1">
                        {typed.map((p: any) => (
                          <img
                            key={p.id}
                            src={`/api/work-submission-photos/${p.id}/image`}
                            alt=""
                            className="w-full h-20 object-cover rounded bg-muted"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}

      {/* Priority Clean Photo Lightbox */}
      {paLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setPaLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/60 hover:text-white p-2" onClick={() => setPaLightbox(null)}>
            <XIcon className="w-6 h-6" />
          </button>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 disabled:opacity-20"
            disabled={paLightbox.idx === 0}
            onClick={e => { e.stopPropagation(); setPaLightbox(prev => prev ? { ...prev, idx: prev.idx - 1 } : null); }}
          >
            <ChevronLeftIcon className="w-8 h-8" />
          </button>
          <img
            src={`/api/priority-alert-photos/${paLightbox.photoIds[paLightbox.idx]}/image`}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 disabled:opacity-20"
            disabled={paLightbox.idx === paLightbox.photoIds.length - 1}
            onClick={e => { e.stopPropagation(); setPaLightbox(prev => prev ? { ...prev, idx: prev.idx + 1 } : null); }}
          >
            <ChevronRightIcon className="w-8 h-8" />
          </button>
          {paLightbox.photoIds.length > 1 && (
            <p className="absolute bottom-6 text-white/60 text-sm">{paLightbox.idx + 1} / {paLightbox.photoIds.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
