import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChevronLeft, Package, MapPin, Camera, CheckCircle } from "lucide-react";
import { Link } from "wouter";

const STATUSES = [
  { value: "running_low", label: "Running Low", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "out_of_stock", label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "damaged", label: "Damaged", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "needs_replacement", label: "Needs Replacement", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "in_stock", label: "In Stock / OK", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "refilled", label: "Refilled", color: "bg-blue-100 text-blue-700 border-blue-200" },
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
  const [selectedLocationKey, setSelectedLocationKey] = useState<string>("");
  const [openSupplyId, setOpenSupplyId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const locations: { locationId: string | null; locationName: string | null; items: any[] }[] = data?.locations || [];
  const hasMultipleLocations = locations.length > 1;

  const activeLocation = selectedLocationKey
    ? locations.find(l => (l.locationId || "__none__") === selectedLocationKey)
    : locations[0];

  const supplies: any[] = activeLocation?.items || [];

  const openSupply = openSupplyId ? supplies.find(s => s.id === openSupplyId) || data?.allSupplies?.find((s: any) => s.id === openSupplyId) : null;

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/employee/profile">
          <button className="p-1 rounded-full hover:bg-muted transition-colors" data-testid="button-back-profile">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-supplies-title">Supplies</h1>
          <p className="text-xs text-muted-foreground">View and report supply status</p>
        </div>
      </div>

      {/* Location selector (only if multiple) */}
      {hasMultipleLocations && (
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Location</Label>
          <Select value={selectedLocationKey} onValueChange={setSelectedLocationKey}>
            <SelectTrigger className="mt-1" data-testid="select-employee-location">
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

      {/* Location label (single location) */}
      {!hasMultipleLocations && activeLocation?.locationName && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          <span>{activeLocation.locationName}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : supplies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No supplies for this location</p>
          <p className="text-xs text-muted-foreground mt-1">Your manager will add supplies here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {supplies.map((s: any) => (
            <button
              key={s.id}
              className="w-full text-left rounded-xl border bg-background hover:shadow-md transition-shadow active:scale-[0.99] overflow-hidden"
              onClick={() => { setOpenSupplyId(s.id); setSubmitted(false); }}
              data-testid={`card-supply-${s.id}`}
            >
              <div className="flex gap-3 p-3.5 items-center">
                <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {s.imageData ? (
                    <img src={s.imageData} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.category}</p>
                  <div className="mt-1.5">
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Supply update sheet */}
      {openSupply && (
        <SupplyUpdateSheet
          supply={openSupply}
          submitted={submitted}
          onSubmitted={() => setSubmitted(true)}
          onClose={() => setOpenSupplyId(null)}
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
