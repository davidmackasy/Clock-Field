import { useState, useRef } from "react";
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
import { Plus, MapPin, Trash2, Camera, CheckCircle, Clock, ChevronRight, Image, AlertCircle } from "lucide-react";

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

function photoToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
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
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const items: PhotoItem[] = [];
    for (const f of files) {
      if (f.size > 3 * 1024 * 1024) continue;
      const dataUrl = await photoToDataUrl(f);
      items.push({ preview: dataUrl, dataUrl });
    }
    onAdd(items);
    if (ref.current) ref.current.value = "";
  };
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={disabled} onClick={() => ref.current?.click()}>
        <Camera className="w-3 h-3 mr-1" /> {label}
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
  const [activeSub, setActiveSub] = useState<any>(null);
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

  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/work-submissions/${activeSub.id}`, { status: "submitted" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-submissions", activeSub.id] });
      setActiveSub(null);
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

            {/* Work items list */}
            {detailLoading ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No work items yet. Add your first area.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.section}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.subArea}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {item.photos?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Image className="w-3 h-3" />{item.photos.length}
                        </span>
                      )}
                      <button
                        onClick={() => deleteItemMut.mutate(item.id)}
                        disabled={deleteItemMut.isPending}
                        data-testid={`button-delete-item-${item.id}`}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
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
            pastSubs.map((sub: any) => (
              <Card
                key={sub.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openDetail(sub)}
                data-testid={`card-submission-${sub.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{sub.workDate}</p>
                      <Badge
                        variant={sub.status === "submitted" ? "default" : "secondary"}
                        className="text-[10px] capitalize"
                      >
                        {sub.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{sub.locationName || "No location"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))
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
    </div>
  );
}
