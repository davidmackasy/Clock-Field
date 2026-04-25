import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Package, MapPin, Camera, CheckCircle, Plus, Clock, RefreshCw, AlertTriangle, XCircle } from "lucide-react";
import { Link } from "wouter";

const STATUSES = [
  { value: "running_low", label: "Running Low", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "out_of_stock", label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "damaged", label: "Damaged", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "needs_replacement", label: "Needs Replacement", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "in_stock", label: "In Stock / OK", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "refilled", label: "Refilled", color: "bg-blue-100 text-blue-700 border-blue-200" },
];

const CATEGORIES = [
  "Chemicals", "Paper Products", "PPE", "Tools", "Equipment",
  "Linens / Rags", "Washroom Supplies", "Floor Supplies", "Waste Supplies", "Other"
];

const UPDATE_TYPES: Record<string, string> = {
  running_low: "reported_low",
  out_of_stock: "reported_out",
  damaged: "reported_damaged",
  needs_replacement: "reported_damaged",
  in_stock: "status_changed",
  refilled: "refilled",
};

const MAX_DIM = 1800;
const JPEG_Q = 0.80;

function statusInfo(value: string) {
  return STATUSES.find(s => s.value === value) || { label: value, color: "bg-gray-100 text-gray-600 border-gray-200" };
}

function StatusBadge({ status }: { status: string }) {
  const info = statusInfo(status);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${info.color}`}>{info.label}</span>;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string | null;
      if (!dataUrl) { reject(new Error("Failed to read file")); return; }
      const img = new window.Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", JPEG_Q));
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Image compression failed"));
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

export default function EmployeeSupplies() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/employee/supplies"] });
  const { data: locationData } = useQuery<any[]>({ queryKey: ["/api/locations"] });
  const [selectedLocationKey, setSelectedLocationKey] = useState<string>("");
  const [openSupplyId, setOpenSupplyId] = useState<string | null>(null);
  const [showRequestNew, setShowRequestNew] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const locations: { locationId: string | null; locationName: string | null; items: any[] }[] = data?.locations || [];
  const hasMultipleLocations = locations.length > 1;

  const activeLocation = selectedLocationKey
    ? locations.find(l => (l.locationId || "__none__") === selectedLocationKey)
    : locations[0];

  const supplies: any[] = activeLocation?.items || [];

  const openSupply = openSupplyId ? supplies.find(s => s.id === openSupplyId) || data?.allSupplies?.find((s: any) => s.id === openSupplyId) : null;

  // Find location details (address, etc.)
  const locationDetail = locationData?.find((l: any) => l.id === activeLocation?.locationId);

  return (
    <div className="pb-24 space-y-4 max-w-lg mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center gap-2">
        <Link href="/employee/profile">
          <button className="p-1 rounded-full hover:bg-muted transition-colors" data-testid="button-back-profile">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold" data-testid="text-supplies-title">Supplies</h1>
          <p className="text-xs text-muted-foreground">View and report supply status</p>
        </div>
        <Button size="sm" onClick={() => setShowRequestNew(true)} data-testid="button-request-new-supply">
          <Plus className="w-4 h-4 mr-1" />Request
        </Button>
      </div>

      {/* Location selector (only if multiple) */}
      {hasMultipleLocations && (
        <div className="px-4">
          <Select value={selectedLocationKey} onValueChange={setSelectedLocationKey}>
            <SelectTrigger className="w-full" data-testid="select-employee-location">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map(l => (
                <SelectItem key={l.locationId || "__none__"} value={l.locationId || "__none__"}>
                  {l.locationName || "All Locations"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Location Header Card */}
      {activeLocation?.locationName && (
        <div className="px-4">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" data-testid="text-location-name">{activeLocation.locationName}</p>
                {locationDetail?.address && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{locationDetail.address}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {supplies.length} supply item{supplies.length !== 1 ? "s" : ""} assigned
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="px-4 grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : supplies.length === 0 ? (
        <div className="px-4 flex flex-col items-center justify-center py-12 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No supplies assigned yet</p>
          <p className="text-xs text-muted-foreground mt-1">Your manager will assign supplies here</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowRequestNew(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Request a Supply
          </Button>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-2.5">
          {supplies.map((s: any) => (
            <button
              key={s.id}
              className="text-left rounded-xl border bg-background hover:shadow-md transition-shadow active:scale-[0.99] overflow-hidden"
              onClick={() => { setOpenSupplyId(s.id); setSubmitted(false); }}
              data-testid={`card-supply-${s.id}`}
            >
              <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                {s.imageData ? (
                  <img src={s.imageData} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-7 h-7 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold truncate leading-tight">{s.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.category}</p>
                <div className="mt-1.5">
                  <StatusBadge status={s.status} />
                </div>
                {s.quantityLabel && (
                  <p className="text-[10px] text-muted-foreground mt-1">{s.quantityLabel}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Supply detail sheet */}
      {openSupply && (
        <SupplyUpdateSheet
          supply={openSupply}
          submitted={submitted}
          onSubmitted={() => setSubmitted(true)}
          onClose={() => setOpenSupplyId(null)}
        />
      )}

      {/* Request new supply dialog */}
      {showRequestNew && (
        <RequestNewSupplyDialog
          activeLocationId={activeLocation?.locationId || null}
          activeLocationName={activeLocation?.locationName || null}
          onClose={() => setShowRequestNew(false)}
        />
      )}
    </div>
  );
}

// ─── Supply Update Sheet ──────────────────────────────────────────────────────
function SupplyUpdateSheet({ supply, submitted, onSubmitted, onClose }: {
  supply: any; submitted: boolean; onSubmitted: () => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  // Fetch supply detail with updates (including admin notes)
  const { data: detail } = useQuery<any>({
    queryKey: ["/api/employee/supplies", supply.id],
    enabled: !!supply.id,
  });

  const adminUpdates = detail?.updates?.filter((u: any) => u.updatedByRole === "admin") || [];

  const mut = useMutation({
    mutationFn: async () => {
      const updateType = UPDATE_TYPES[status] || "reported_concern";
      const res = await apiRequest("POST", `/api/supplies/${supply.id}/updates`, {
        updateType,
        note: note || null,
        photoData: photo,
        newStatus: status || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/supplies"] });
      onSubmitted();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
    } catch {
      toast({ title: "Photo upload failed", description: "Please try a different image.", variant: "destructive" });
    }
  };

  return (
    <Sheet open={true} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[90vh] overflow-y-auto" data-testid="sheet-supply-update">
        <SheetHeader className="text-left mb-4">
          <SheetTitle>{supply.name}</SheetTitle>
          <SheetDescription>{supply.category}{supply.locationName ? ` · ${supply.locationName}` : ""}</SheetDescription>
        </SheetHeader>

        {/* Supply image */}
        {supply.imageData && (
          <div className="w-full h-40 rounded-xl overflow-hidden mb-4 bg-muted">
            <img src={supply.imageData} alt={supply.name} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Quantity info */}
        {supply.quantityLabel && (
          <div className="bg-muted/50 rounded-lg px-3 py-2 mb-4 text-xs text-muted-foreground">
            Quantity: <span className="font-medium text-foreground">{supply.quantityLabel}</span>
          </div>
        )}

        {/* Admin notes / response messages */}
        {adminUpdates.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Updates</p>
            {adminUpdates.slice(0, 3).map((u: any) => (
              <div key={u.id} className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <RefreshCw className="w-3 h-3 text-blue-500" />
                  <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">Admin response</span>
                  <span className="text-[10px] text-blue-500 ml-auto">{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
                {u.note && <p className="text-xs text-blue-800 dark:text-blue-300">{u.note}</p>}
              </div>
            ))}
          </div>
        )}

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="text-base font-semibold">Supply update submitted</p>
            <p className="text-sm text-muted-foreground">Your manager has been notified.</p>
            <Button className="mt-2 w-full" onClick={onClose} data-testid="button-close-submitted">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current status</p>
              <StatusBadge status={supply.status} />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Report Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 h-11 text-sm" data-testid="select-update-status">
                  <SelectValue placeholder="What's the issue?" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Note (optional)</Label>
              <Textarea
                className="mt-1 resize-none text-sm"
                rows={3}
                placeholder="Describe the issue — e.g. 'Only a little left', 'Bottle is leaking'…"
                value={note}
                onChange={e => setNote(e.target.value)}
                data-testid="textarea-supply-note"
              />
            </div>

            {/* Photo */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Photo (optional)</Label>
              <div className="mt-1 flex gap-2 items-start flex-wrap">
                <Button variant="outline" size="sm" className="h-10" onClick={() => imgRef.current?.click()} data-testid="button-add-supply-photo">
                  <Camera className="w-4 h-4 mr-1.5" />{photo ? "Change Photo" : "Take / Upload Photo"}
                </Button>
                {photo && (
                  <div className="w-20 h-14 rounded-lg overflow-hidden border border-border">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <input ref={imgRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImg} />
              </div>
            </div>

            <Button
              className="w-full h-11 text-sm font-semibold"
              disabled={!status || mut.isPending}
              onClick={() => mut.mutate()}
              data-testid="button-submit-supply-update"
            >
              {mut.isPending ? "Submitting…" : "Submit Update"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Request New Supply Dialog ────────────────────────────────────────────────
function RequestNewSupplyDialog({ activeLocationId, activeLocationName, onClose }: {
  activeLocationId: string | null; activeLocationName: string | null; onClose: () => void;
}) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", category: "", note: "", urgency: "normal" });
  const [imgData, setImgData] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/employee/supply-requests", {
        name: form.name,
        category: form.category || undefined,
        note: form.note || undefined,
        urgency: form.urgency,
        locationId: activeLocationId || undefined,
        locationName: activeLocationName || undefined,
        imageData: imgData || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/supplies"] });
      setSubmitted(true);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setImgData(await compressImage(file)); }
    catch { toast({ title: "Photo upload failed", variant: "destructive" }); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request New Supply</DialogTitle>
          <DialogDescription>
            {activeLocationName ? `For ${activeLocationName}` : "Request a supply item from your manager"}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="text-base font-semibold">Request submitted!</p>
            <p className="text-sm text-muted-foreground">Your manager will review your request.</p>
            <Button className="mt-2 w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Optional photo */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => imgRef.current?.click()}
              >
                {imgData ? <img src={imgData} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-muted-foreground/40" />}
              </div>
              <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()}>
                <Camera className="w-3.5 h-3.5 mr-1.5" />{imgData ? "Change Photo" : "Add Photo (optional)"}
              </Button>
              <input ref={imgRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImg} />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Supply Name *</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Mop head, All Pink cleaner…"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-request-supply-name"
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category (optional)</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-request-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Urgency</Label>
              <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-request-urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reason / Note (optional)</Label>
              <Textarea
                className="mt-1 resize-none text-sm"
                rows={3}
                placeholder="e.g. Need a new mop head. Current one is damaged. Can be found at Walmart."
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                data-testid="textarea-request-note"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                disabled={!form.name || mut.isPending}
                onClick={() => mut.mutate()}
                data-testid="button-submit-supply-request"
              >
                {mut.isPending ? "Submitting…" : "Submit Request"}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
