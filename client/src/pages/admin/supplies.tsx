import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Package, Plus, Filter, X, Camera, MapPin, Tag, Clock,
  CheckCircle, AlertTriangle, XCircle, Wrench, RefreshCw,
  ChevronRight, Pencil, Archive, Image as ImageIcon
} from "lucide-react";

const CATEGORIES = [
  "Chemicals", "Paper Products", "PPE", "Tools", "Equipment",
  "Linens / Rags", "Washroom Supplies", "Floor Supplies", "Waste Supplies", "Other"
];

const STATUSES = [
  { value: "in_stock", label: "In Stock", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "running_low", label: "Running Low", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "out_of_stock", label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "damaged", label: "Damaged", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "needs_replacement", label: "Needs Replacement", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "refilled", label: "Refilled", color: "bg-blue-100 text-blue-700 border-blue-200" },
];

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

function ActivityIcon({ type }: { type: string }) {
  if (type.includes("refill")) return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
  if (type.includes("replace")) return <Wrench className="w-3.5 h-3.5 text-purple-500" />;
  if (type.includes("out") || type.includes("empty")) return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  if (type.includes("low") || type.includes("concern")) return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />;
  if (type.includes("resolve")) return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function AdminSupplies() {
  const { toast } = useToast();
  const [filterLocation, setFilterLocation] = useState("__all__");
  const [filterCategory, setFilterCategory] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });
  const { data: allSupplies = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/supplies"] });
  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/supplies", detailId],
    enabled: !!detailId,
  });

  const supplies: any[] = allSupplies.filter((s: any) => {
    if (filterLocation !== "__all__" && s.locationId !== filterLocation) return false;
    if (filterCategory !== "__all__" && s.category !== filterCategory) return false;
    if (filterStatus !== "__all__" && s.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: allSupplies.filter((s: any) => s.isActive).length,
    low: allSupplies.filter((s: any) => s.status === "running_low").length,
    out: allSupplies.filter((s: any) => s.status === "out_of_stock").length,
    damaged: allSupplies.filter((s: any) => s.status === "damaged" || s.status === "needs_replacement").length,
  };
  const needsAttention = stats.low + stats.out + stats.damaged;

  const hasFilters = filterLocation !== "__all__" || filterCategory !== "__all__" || filterStatus !== "__all__";

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-supplies-title">Supplies</h1>
          <p className="text-sm text-muted-foreground">Track and manage supplies by location</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-supply">
          <Plus className="w-4 h-4 mr-1.5" />Add Supply
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold mt-1" data-testid="stat-total">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium uppercase tracking-wide">Running Low</p>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-1">{stats.low}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-red-700 dark:text-red-400 font-medium uppercase tracking-wide">Out of Stock</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{stats.out}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-orange-700 dark:text-orange-400 font-medium uppercase tracking-wide">Needs Attention</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">{needsAttention}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-filter-location">
            <MapPin className="w-3 h-3 mr-1 text-muted-foreground" />
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Locations</SelectItem>
            {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-filter-category">
            <Tag className="w-3 h-3 mr-1 text-muted-foreground" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-filter-status">
            <Filter className="w-3 h-3 mr-1 text-muted-foreground" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setFilterLocation("__all__"); setFilterCategory("__all__"); setFilterStatus("__all__"); }}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Supply list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : supplies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No supplies found</p>
          <p className="text-xs text-muted-foreground mt-1">{hasFilters ? "Try removing filters" : "Add your first supply to get started"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {supplies.map((s: any) => (
            <button
              key={s.id}
              className="text-left w-full rounded-xl border bg-background hover:shadow-md transition-shadow active:scale-[0.99] p-0 overflow-hidden"
              onClick={() => { setDetailId(s.id); setEditMode(false); }}
              data-testid={`card-supply-${s.id}`}
            >
              <div className="flex gap-3 p-3">
                <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {s.imageData ? (
                    <img src={s.imageData} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>
                  {s.locationName && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground truncate">{s.locationName}</p>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add supply dialog */}
      <AddSupplyDialog open={showAdd} onClose={() => setShowAdd(false)} locations={locations} />

      {/* Detail sheet */}
      {detailId && (
        <SupplyDetailSheet
          supplyId={detailId}
          detail={detail}
          loading={detailLoading}
          locations={locations}
          editMode={editMode}
          onEditMode={setEditMode}
          onClose={() => { setDetailId(null); setEditMode(false); }}
        />
      )}
    </div>
  );
}

// ─── Add Supply Dialog ────────────────────────────────────────────────────────
function AddSupplyDialog({ open, onClose, locations }: { open: boolean; onClose: () => void; locations: any[] }) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", category: "", locationId: "__none__", locationName: "", description: "", status: "in_stock", quantityLabel: "" });
  const [imgData, setImgData] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const effectiveLocId = form.locationId === "__none__" ? undefined : form.locationId;
      const locName = locations.find(l => l.id === effectiveLocId)?.name || form.locationName;
      const res = await apiRequest("POST", "/api/supplies", { ...form, locationId: effectiveLocId, locationName: locName, imageData: imgData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies"] });
      toast({ title: "Supply added" });
      setForm({ name: "", category: "", locationId: "__none__", locationName: "", description: "", status: "in_stock", quantityLabel: "" });
      setImgData(null);
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await compressImage(file);
      setImgData(data);
    } catch {
      toast({ title: "Photo upload failed", description: "Please try a different image.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Supply</DialogTitle>
          <DialogDescription>Create a new supply item for a location.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => imgRef.current?.click()}
            >
              {imgData ? <img src={imgData} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-muted-foreground/50" />}
            </div>
            <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()} data-testid="button-upload-supply-photo">
              <Camera className="w-3.5 h-3.5 mr-1.5" />{imgData ? "Change Photo" : "Add Photo"}
            </Button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImg} />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name *</Label>
            <Input className="mt-1" placeholder="e.g. Neutral Cleaner" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-supply-name" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category *</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-supply-category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Location</Label>
            <Select value={form.locationId} onValueChange={v => setForm(f => ({ ...f, locationId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-supply-location"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No specific location</SelectItem>
                {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Initial Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description (optional)</Label>
            <Textarea className="mt-1 resize-none text-sm" rows={2} placeholder="Any notes about this supply..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quantity Label (optional)</Label>
            <Input className="mt-1" placeholder="e.g. 2 bottles" value={form.quantityLabel} onChange={e => setForm(f => ({ ...f, quantityLabel: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={!form.name || !form.category || mut.isPending} onClick={() => mut.mutate()} data-testid="button-save-supply">
              {mut.isPending ? "Saving…" : "Add Supply"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Supply Detail Sheet ──────────────────────────────────────────────────────
function SupplyDetailSheet({ supplyId, detail, loading, locations, editMode, onEditMode, onClose }: {
  supplyId: string; detail: any; loading: boolean; locations: any[];
  editMode: boolean; onEditMode: (v: boolean) => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<"refill" | "replace" | "status" | "note" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [actionPhoto, setActionPhoto] = useState<string | null>(null);
  const actionImgRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editForm, setEditForm] = useState<any>(null);
  const [editImg, setEditImg] = useState<string | null>(null);

  const updateMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/supplies/${supplyId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies", supplyId] });
      toast({ title: "Supply updated" });
      onEditMode(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const actMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/supplies/${supplyId}/updates`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies", supplyId] });
      toast({ title: "Update recorded" });
      setActionOpen(false);
      setActionNote("");
      setActionStatus("");
      setActionPhoto(null);
      setActionType(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAction = () => {
    let updateType = "note_added";
    let newStatus: string | undefined;
    if (actionType === "refill") { updateType = "refilled"; newStatus = "in_stock"; }
    else if (actionType === "replace") { updateType = "replaced"; newStatus = "in_stock"; }
    else if (actionType === "status") { updateType = "status_changed"; newStatus = actionStatus; }
    actMut.mutate({ updateType, note: actionNote || null, photoData: actionPhoto, newStatus });
  };

  const handleActionImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setActionPhoto(await compressImage(file));
    } catch {
      toast({ title: "Photo upload failed", description: "Please try a different image.", variant: "destructive" });
    }
  };

  const startEdit = () => {
    if (!detail) return;
    setEditForm({ name: detail.name, category: detail.category, locationId: detail.locationId || "", description: detail.description || "", status: detail.status, quantityLabel: detail.quantityLabel || "" });
    setEditImg(null);
    onEditMode(true);
  };

  const saveEdit = () => {
    if (!editForm) return;
    const locName = locations.find(l => l.id === editForm.locationId)?.name || detail?.locationName;
    updateMut.mutate({ ...editForm, locationName: locName, ...(editImg !== null && { imageData: editImg }) });
  };

  const handleEditImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setEditImg(await compressImage(file));
    } catch {
      toast({ title: "Photo upload failed", description: "Please try a different image.", variant: "destructive" });
    }
  };

  const archiveMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/supplies/${supplyId}`, { isActive: false });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies"] });
      toast({ title: "Supply archived" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const imageToShow = editMode ? (editImg || detail?.imageData) : detail?.imageData;

  return (
    <Sheet open={!!supplyId} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto pb-8" data-testid="sheet-supply-detail">
        {loading || !detail ? (
          <div className="space-y-4 pt-6">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <>
            <SheetHeader className="pb-2">
              <SheetTitle className="flex items-center justify-between">
                <span className="truncate">{detail.name}</span>
                <div className="flex gap-1.5 flex-shrink-0">
                  {!editMode && (
                    <>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={startEdit} data-testid="button-edit-supply"><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => archiveMut.mutate()} data-testid="button-archive-supply"><Archive className="w-3.5 h-3.5" /></Button>
                    </>
                  )}
                </div>
              </SheetTitle>
            </SheetHeader>

            {/* Image */}
            <div className="w-full aspect-video rounded-xl bg-muted overflow-hidden flex items-center justify-center mb-4">
              {imageToShow ? (
                <img src={imageToShow} alt={detail.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-10 h-10 text-muted-foreground/30" />
              )}
            </div>

            {editMode ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
                  <Input className="mt-1" value={editForm?.name || ""} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category</Label>
                  <Select value={editForm?.category || ""} onValueChange={v => setEditForm((f: any) => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Location</Label>
                  <Select value={editForm?.locationId || "__none__"} onValueChange={v => setEditForm((f: any) => ({ ...f, locationId: v === "__none__" ? null : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="No specific location" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No specific location</SelectItem>
                      {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                  <Select value={editForm?.status || ""} onValueChange={v => setEditForm((f: any) => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                  <Textarea className="mt-1 resize-none text-sm" rows={2} value={editForm?.description || ""} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()}>
                    <Camera className="w-3.5 h-3.5 mr-1.5" />{editImg ? "Change Photo" : "Update Photo"}
                  </Button>
                  <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleEditImg} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" disabled={updateMut.isPending} onClick={saveEdit} data-testid="button-save-supply-edit">{updateMut.isPending ? "Saving…" : "Save Changes"}</Button>
                  <Button variant="outline" onClick={() => onEditMode(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                {/* Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <StatusBadge status={detail.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Category</span>
                    <span className="text-xs font-medium">{detail.category}</span>
                  </div>
                  {detail.locationName && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Location</span>
                      <span className="text-xs font-medium">{detail.locationName}</span>
                    </div>
                  )}
                  {detail.quantityLabel && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Quantity</span>
                      <span className="text-xs font-medium">{detail.quantityLabel}</span>
                    </div>
                  )}
                  {detail.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">{detail.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => { setActionType("refill"); setActionOpen(true); }} data-testid="button-action-refill">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Mark Refilled
                  </Button>
                  <Button size="sm" variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { setActionType("replace"); setActionOpen(true); }} data-testid="button-action-replace">
                    <Wrench className="w-3.5 h-3.5 mr-1.5" />Mark Replaced
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setActionType("status"); setActionStatus(detail.status); setActionOpen(true); }} data-testid="button-action-status">
                    <Filter className="w-3.5 h-3.5 mr-1.5" />Change Status
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setActionType("note"); setActionOpen(true); }} data-testid="button-action-note">
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />Add Note
                  </Button>
                </div>

                <Separator className="mb-4" />

                {/* Activity history */}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Activity History</p>
                {(!detail.updates || detail.updates.length === 0) ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {detail.updates.map((u: any) => (
                      <div key={u.id} className="flex gap-2.5">
                        <div className="mt-0.5 flex-shrink-0">
                          <ActivityIcon type={u.updateType} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium capitalize">{u.updateType.replace(/_/g, " ")}</span>
                            {u.employeeName && <span className="text-[11px] text-muted-foreground">by {u.employeeName}</span>}
                            {u.updatedByRole === "admin" && !u.employeeName && <span className="text-[11px] text-muted-foreground">by Admin</span>}
                          </div>
                          {u.note && <p className="text-xs text-muted-foreground mt-0.5">{u.note}</p>}
                          {u.newStatus && u.previousStatus && u.newStatus !== u.previousStatus && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {statusInfo(u.previousStatus).label} → {statusInfo(u.newStatus).label}
                            </p>
                          )}
                          {u.photoData && (
                            <div className="w-24 h-16 rounded-lg overflow-hidden mt-1.5 border border-border">
                              <img src={u.photoData} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(u.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Action sheet */}
            {actionOpen && (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setActionOpen(false)}>
                <div className="bg-background w-full rounded-t-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <p className="font-semibold text-base">
                    {actionType === "refill" ? "Mark as Refilled" : actionType === "replace" ? "Mark as Replaced" : actionType === "status" ? "Change Status" : "Add Note"}
                  </p>
                  {actionType === "status" && (
                    <Select value={actionStatus} onValueChange={setActionStatus}>
                      <SelectTrigger><SelectValue placeholder="Select new status" /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <Textarea
                    placeholder={actionType === "refill" ? "Note about restock (optional)…" : actionType === "replace" ? "Note about replacement (optional)…" : "Note or observation…"}
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="resize-none text-sm"
                    rows={3}
                  />
                  <div>
                    <Button variant="outline" size="sm" onClick={() => actionImgRef.current?.click()}>
                      <Camera className="w-3.5 h-3.5 mr-1.5" />{actionPhoto ? "Change Photo" : "Attach Photo"}
                    </Button>
                    <input ref={actionImgRef} type="file" accept="image/*" className="hidden" onChange={handleActionImg} />
                    {actionPhoto && <img src={actionPhoto} alt="" className="w-24 h-16 rounded-lg object-cover mt-2 border" />}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={actMut.isPending || (actionType === "status" && !actionStatus)} onClick={handleAction} data-testid="button-confirm-action">
                      {actMut.isPending ? "Saving…" : "Confirm"}
                    </Button>
                    <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
