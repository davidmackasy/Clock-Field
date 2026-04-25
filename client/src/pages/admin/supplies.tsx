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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Package, Plus, Filter, X, Camera, MapPin, Tag, Clock,
  CheckCircle, AlertTriangle, XCircle, Wrench, RefreshCw,
  ChevronRight, Pencil, Archive, Image as ImageIcon,
  ShoppingCart, DollarSign, TrendingUp, Layers, RotateCcw,
  Building2, ArrowRight, History, BoxSelect, PackageCheck, Truck,
  User, Ban, ClipboardCheck, PackageSearch
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
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
  { value: "fulfilled", label: "Fulfilled", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "partially_fulfilled", label: "Partially Fulfilled", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "ordered", label: "Ordered", color: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "not_needed", label: "Not Needed", color: "bg-gray-100 text-gray-500 border-gray-200" },
];

const INV_STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_stock: { label: "In Stock", color: "bg-green-100 text-green-700 border-green-200" },
  running_low: { label: "Running Low", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  out_of_stock: { label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-200" },
};

const MAX_DIM = 1800;
const JPEG_Q = 0.80;

type TabKey = "overview" | "inventory" | "location-expenses" | "requests" | "purchase-history";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusInfo(value: string) {
  return STATUSES.find(s => s.value === value) || { label: value, color: "bg-gray-100 text-gray-600 border-gray-200" };
}

function StatusBadge({ status }: { status: string }) {
  const info = statusInfo(status);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${info.color}`}>{info.label}</span>;
}

function InvStatusBadge({ status }: { status: string }) {
  const info = INV_STATUS_MAP[status] || { label: status, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${info.color}`}>{info.label}</span>;
}

function fmtCurrency(v: number) {
  return v.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminSupplies() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [showAddSupplyToLocation, setShowAddSupplyToLocation] = useState(false);

  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: TrendingUp },
    { key: "inventory", label: "Inventory", icon: Layers },
    { key: "location-expenses", label: "Location Expenses", icon: Building2 },
    { key: "requests", label: "Requests", icon: Package },
    { key: "purchase-history", label: "Purchase History", icon: History },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 md:px-6 pt-4 pb-24 md:pb-6 overflow-x-hidden space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold" data-testid="text-supplies-title">Supply Management</h1>
          <p className="text-sm text-muted-foreground">Inventory tracking and location expense management</p>
        </div>
        <div className="flex-shrink-0">
          {tab === "location-expenses" && (
            <Button size="sm" onClick={() => setShowAddSupplyToLocation(true)} data-testid="button-add-supply-to-location">
              <Plus className="w-4 h-4 mr-1.5" />Add Supply to Location
            </Button>
          )}
          {tab === "inventory" && (
            <Button size="sm" onClick={() => setShowAddInventory(true)} data-testid="button-add-inventory-item">
              <Plus className="w-4 h-4 mr-1.5" />Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === "overview" && <OverviewTab locations={locations} onAddSupplyToLocation={() => setShowAddSupplyToLocation(true)} />}
      {tab === "inventory" && (
        <InventoryTab
          locations={locations}
          showAdd={showAddInventory}
          onCloseAdd={() => setShowAddInventory(false)}
        />
      )}
      {tab === "location-expenses" && (
        <LocationExpensesTab
          locations={locations}
          showAdd={showAddSupplyToLocation}
          onCloseAdd={() => setShowAddSupplyToLocation(false)}
          onAdd={() => setShowAddSupplyToLocation(true)}
        />
      )}
      {tab === "requests" && (
        <RequestsTab
          locations={locations}
          showAdd={showAddSupply}
          onCloseAdd={() => setShowAddSupply(false)}
        />
      )}
      {tab === "purchase-history" && <PurchaseHistoryTab />}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ locations, onAddSupplyToLocation }: { locations: any[]; onAddSupplyToLocation: () => void }) {
  const { data: ov, isLoading } = useQuery<any>({ queryKey: ["/api/supplies/inventory-overview"] });

  if (isLoading) return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  if (!ov) return null;

  const locationName = (id: string) => locations.find(l => l.id === id)?.name || id;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Items</p>
              <Layers className="w-4 h-4 text-muted-foreground/50" />
            </div>
            <p className="text-2xl font-bold" data-testid="stat-total-items">{ov.totalItems}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium uppercase tracking-wide">Out of Stock</p>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400" data-testid="stat-out-of-stock">{ov.outOfStock}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium uppercase tracking-wide">Running Low</p>
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{ov.runningLow}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium uppercase tracking-wide">Inventory Value</p>
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{fmtCurrency(ov.totalInventoryValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wide">Total Spent</p>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(ov.totalSpent)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-orange-700 dark:text-orange-400 font-medium uppercase tracking-wide">Open Requests</p>
              <Package className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{ov.pendingRequests}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Location Expenses + Recent Purchases side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Locations */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />Top Locations by Spend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {ov.locationExpenseSummary?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No location expenses yet</p>
            ) : ov.locationExpenseSummary?.map((l: any) => (
              <div key={l.locationId} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{locationName(l.locationId)}</span>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">{l.count} item{l.count !== 1 ? "s" : ""}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{fmtCurrency(l.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />Recent Purchases
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {ov.recentPurchases?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No purchases yet</p>
            ) : ov.recentPurchases?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.inventoryItemName}</p>
                  <p className="text-[11px] text-muted-foreground">{p.quantityAdded} units · {fmtDate(p.purchaseDate)}</p>
                </div>
                <span className="text-sm font-semibold text-blue-700 flex-shrink-0">{fmtCurrency(parseFloat(p.totalCost))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Status Snapshot */}
      {ov.items?.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />Inventory Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {ov.items.filter((i: any) => i.status !== "in_stock").map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imageData ? <img src={item.imageData} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground/50" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">{item.currentQuantity} in stock</p>
                  </div>
                  <InvStatusBadge status={item.status} />
                </div>
              ))}
              {ov.items.filter((i: any) => i.status !== "in_stock").length === 0 && (
                <div className="flex items-center gap-2 text-emerald-700 py-2">
                  <CheckCircle className="w-4 h-4" />
                  <p className="text-sm font-medium">All items are in stock</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────
function InventoryTab({ locations, showAdd, onCloseAdd }: { locations: any[]; showAdd: boolean; onCloseAdd: () => void }) {
  const [restockItem, setRestockItem] = useState<any | null>(null);
  const [assignItem, setAssignItem] = useState<any | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [filterCat, setFilterCat] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");

  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/supplies/inventory"] });

  const filtered = items.filter(i => {
    if (filterCat !== "__all__" && i.category !== filterCat) return false;
    if (filterStatus !== "__all__" && i.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="flex-1 min-w-[110px] max-w-[180px] h-8 text-xs" data-testid="select-inv-filter-category">
            <Tag className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="flex-1 min-w-[110px] max-w-[160px] h-8 text-xs" data-testid="select-inv-filter-status">
            <Filter className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="running_low">Running Low</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        {(filterCat !== "__all__" || filterStatus !== "__all__") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2 shrink-0" onClick={() => { setFilterCat("__all__"); setFilterStatus("__all__"); }}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Layers className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No inventory items found</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first item to start tracking inventory</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item: any) => (
            <div
              key={item.id}
              className="rounded-xl border bg-background shadow-sm hover:shadow-md transition-shadow"
              data-testid={`card-inventory-${item.id}`}
            >
              <div className="flex gap-3 p-3">
                <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.imageData ? (
                    <img src={item.imageData} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <InvStatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground">{item.currentQuantity} in stock</span>
                    <span>·</span>
                    <span>{fmtCurrency(parseFloat(item.unitPrice))} / unit</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    Value: {fmtCurrency(parseFloat(item.unitPrice) * item.currentQuantity)}
                  </div>
                </div>
              </div>
              <div className="flex border-t divide-x">
                <button
                  className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors flex items-center justify-center gap-1 rounded-bl-xl"
                  onClick={() => setEditItem(item)}
                  data-testid={`button-edit-inventory-${item.id}`}
                >
                  <Pencil className="w-3 h-3" />Edit
                </button>
                <button
                  className="flex-1 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors flex items-center justify-center gap-1"
                  onClick={() => setRestockItem(item)}
                  data-testid={`button-restock-${item.id}`}
                >
                  <PackageCheck className="w-3 h-3" />Restock
                </button>
                <button
                  className="flex-1 py-2 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors flex items-center justify-center gap-1 rounded-br-xl"
                  onClick={() => setAssignItem(item)}
                  data-testid={`button-assign-${item.id}`}
                >
                  <ArrowRight className="w-3 h-3" />Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddInventoryItemDialog open={showAdd} onClose={onCloseAdd} />
      {restockItem && <RestockDialog item={restockItem} onClose={() => setRestockItem(null)} />}
      {assignItem && <AssignToLocationDialog item={assignItem} locations={locations} onClose={() => setAssignItem(null)} />}
      {editItem && <EditInventoryItemDialog item={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}

// ─── Add Inventory Item Dialog ────────────────────────────────────────────────
function AddInventoryItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", category: "", unitPrice: "", currentQuantity: "0",
    lowStockThreshold: "2", supplierName: "", notes: "",
  });
  const [imgData, setImgData] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/supplies/inventory", { ...form, imageData: imgData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory-overview"] });
      toast({ title: "Inventory item added" });
      setForm({ name: "", category: "", unitPrice: "", currentQuantity: "0", lowStockThreshold: "2", supplierName: "", notes: "" });
      setImgData(null);
      onClose();
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
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Inventory Item</DialogTitle>
          <DialogDescription>Track a new supply item in your inventory.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => imgRef.current?.click()}
            >
              {imgData ? <img src={imgData} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-muted-foreground/50" />}
            </div>
            <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()} data-testid="button-upload-inv-photo">
              <Camera className="w-3.5 h-3.5 mr-1.5" />{imgData ? "Change Photo" : "Add Photo"}
            </Button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImg} />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name *</Label>
            <Input className="mt-1" placeholder="e.g. All-Purpose Cleaner" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-inv-name" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category *</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-inv-category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Unit Price ($)</Label>
              <Input className="mt-1" type="number" min="0" step="0.01" placeholder="0.00" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} data-testid="input-inv-price" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Initial Qty</Label>
              <Input className="mt-1" type="number" min="0" placeholder="0" value={form.currentQuantity} onChange={e => setForm(f => ({ ...f, currentQuantity: e.target.value }))} data-testid="input-inv-qty" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Low Stock Threshold</Label>
            <Input className="mt-1" type="number" min="1" placeholder="2" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} data-testid="input-inv-threshold" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Supplier (optional)</Label>
            <Input className="mt-1" placeholder="Supplier name" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes (optional)</Label>
            <Textarea className="mt-1 resize-none text-sm" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={!form.name || !form.category || mut.isPending} onClick={() => mut.mutate()} data-testid="button-save-inv-item">
              {mut.isPending ? "Saving…" : "Add Item"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Inventory Item Dialog ───────────────────────────────────────────────
function EditInventoryItemDialog({ item, onClose }: { item: any; onClose: () => void }) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: item.name, category: item.category, unitPrice: item.unitPrice,
    lowStockThreshold: String(item.lowStockThreshold), supplierName: item.supplierName || "", notes: item.notes || "",
  });
  const [imgData, setImgData] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/supplies/inventory/${item.id}`, {
        ...form, ...(imgData !== null && { imageData: imgData }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory-overview"] });
      toast({ title: "Item updated" });
      onClose();
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
          <DialogTitle>Edit Inventory Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => imgRef.current?.click()}
            >
              {(imgData || item.imageData) ? <img src={imgData || item.imageData} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-muted-foreground/50" />}
            </div>
            <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()}>
              <Camera className="w-3.5 h-3.5 mr-1.5" />Update Photo
            </Button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImg} />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name *</Label>
            <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category *</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Unit Price ($)</Label>
              <Input className="mt-1" type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Low Stock Threshold</Label>
              <Input className="mt-1" type="number" min="1" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</Label>
            <Input className="mt-1" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
            <Textarea className="mt-1 resize-none text-sm" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={!form.name || !form.category || mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending ? "Saving…" : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Restock Dialog ───────────────────────────────────────────────────────────
function RestockDialog({ item, onClose }: { item: any; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    quantityAdded: "", unitPrice: item.unitPrice, supplierName: item.supplierName || "", purchaseDate: new Date().toISOString().split("T")[0], notes: "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/supplies/inventory/${item.id}/restock`, form);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/purchase-history"] });
      toast({ title: "Stock added", description: `New quantity: ${data.newQuantity}` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalCost = form.quantityAdded && form.unitPrice
    ? (parseFloat(form.quantityAdded) * parseFloat(form.unitPrice)).toFixed(2)
    : null;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>Restock — {item.name}</DialogTitle>
          <DialogDescription>Current stock: {item.currentQuantity} units</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quantity to Add *</Label>
              <Input className="mt-1" type="number" min="1" placeholder="e.g. 10" value={form.quantityAdded} onChange={e => setForm(f => ({ ...f, quantityAdded: e.target.value }))} data-testid="input-restock-qty" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Unit Price ($)</Label>
              <Input className="mt-1" type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} data-testid="input-restock-price" />
            </div>
          </div>
          {totalCost && (
            <div className="bg-muted/50 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total Cost</span>
              <span className="text-sm font-bold">{fmtCurrency(parseFloat(totalCost))}</span>
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</Label>
            <Input className="mt-1" placeholder="Supplier name" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Purchase Date</Label>
            <Input className="mt-1" type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes (optional)</Label>
            <Textarea className="mt-1 resize-none text-sm" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={!form.quantityAdded || parseInt(form.quantityAdded) <= 0 || mut.isPending} onClick={() => mut.mutate()} data-testid="button-confirm-restock">
              {mut.isPending ? "Saving…" : "Add Stock"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign to Location Dialog ────────────────────────────────────────────────
function AssignToLocationDialog({ item, locations, onClose }: { item: any; locations: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ locationId: "", quantity: "1", notes: "" });

  const locationName = locations.find(l => l.id === form.locationId)?.name || "";
  const totalCost = form.quantity && item.unitPrice
    ? (parseFloat(form.quantity) * parseFloat(item.unitPrice)).toFixed(2)
    : null;

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/supplies/inventory/${item.id}/assign-location`, {
        locationId: form.locationId, locationName, quantity: form.quantity, notes: form.notes,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/location-expenses"] });
      toast({ title: "Assigned to location", description: `Remaining stock: ${data.newQuantity}` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>Assign to Location — {item.name}</DialogTitle>
          <DialogDescription>Available: {item.currentQuantity} units · {fmtCurrency(parseFloat(item.unitPrice))} / unit</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Location *</Label>
            <Select value={form.locationId} onValueChange={v => setForm(f => ({ ...f, locationId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-assign-location"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quantity *</Label>
            <Input className="mt-1" type="number" min="1" max={item.currentQuantity} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} data-testid="input-assign-qty" />
          </div>
          {totalCost && (
            <div className="bg-muted/50 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Expense to Location</span>
              <span className="text-sm font-bold text-emerald-700">{fmtCurrency(parseFloat(totalCost))}</span>
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes (optional)</Label>
            <Textarea className="mt-1 resize-none text-sm" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              disabled={!form.locationId || !form.quantity || parseInt(form.quantity) <= 0 || mut.isPending}
              onClick={() => mut.mutate()}
              data-testid="button-confirm-assign"
            >
              {mut.isPending ? "Assigning…" : "Assign to Location"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Location Expenses Tab ────────────────────────────────────────────────────
function LocationExpensesTab({ locations, showAdd, onCloseAdd, onAdd }: { locations: any[]; showAdd: boolean; onCloseAdd: () => void; onAdd: () => void }) {
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const { data: locationGroups = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/supplies/location-expenses"] });

  const locationName = (id: string) => locations.find(l => l.id === id)?.name || id;
  const grandTotal = locationGroups.reduce((acc, l) => acc + l.totalExpense, 0);

  return (
    <div className="space-y-4">
      {/* Grand total banner */}
      {locationGroups.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-xl p-4 flex items-center justify-between border border-emerald-200/50">
          <div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wide">Total Supply Spend (All Locations)</p>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{fmtCurrency(grandTotal)}</p>
          </div>
          <DollarSign className="w-8 h-8 text-emerald-400" />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : locationGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No location expenses yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Assign inventory items to locations to start tracking supply expenses</p>
          <Button size="sm" onClick={onAdd} data-testid="button-add-supply-to-location-empty">
            <Plus className="w-4 h-4 mr-1.5" />Add Supply to Location
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {locationGroups.map((group: any) => (
            <button
              key={group.locationId}
              className="w-full text-left rounded-xl border bg-background hover:shadow-md transition-shadow p-4"
              onClick={() => setSelectedLocation(group)}
              data-testid={`card-location-expense-${group.locationId}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{locationName(group.locationId)}</p>
                    <p className="text-[11px] text-muted-foreground">{group.itemCount} assignment{group.itemCount !== 1 ? "s" : ""} · Last: {fmtDate(group.lastActivity)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-base font-bold text-emerald-700">{fmtCurrency(group.totalExpense)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedLocation && (
        <LocationBreakdownSheet
          group={selectedLocation}
          locationName={locationName(selectedLocation.locationId)}
          onClose={() => setSelectedLocation(null)}
        />
      )}

      <AddSupplyToLocationModal
        open={showAdd}
        onClose={onCloseAdd}
        locations={locations}
      />
    </div>
  );
}

// ─── Location Breakdown Sheet ─────────────────────────────────────────────────
function LocationBreakdownSheet({ group, locationName, onClose }: { group: any; locationName: string; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto pb-8">
        <SheetHeader className="pb-3">
          <SheetTitle>{locationName}</SheetTitle>
          <SheetDescription>Supply expense breakdown for this location</SheetDescription>
        </SheetHeader>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 mb-5">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wide">Total Supply Expense</p>
          <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{fmtCurrency(group.totalExpense)}</p>
          <p className="text-[11px] text-emerald-600 mt-1">{group.itemCount} item assignment{group.itemCount !== 1 ? "s" : ""}</p>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Expense History</p>
        <div className="space-y-3">
          {group.entries.map((e: any) => (
            <div key={e.id} className="rounded-xl border p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.inventoryItemName}</p>
                  <p className="text-[11px] text-muted-foreground">{e.category}</p>
                </div>
                <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{fmtCurrency(parseFloat(e.totalExpense))}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{e.quantity} unit{e.quantity !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{fmtCurrency(parseFloat(e.unitPriceAtTime))} / unit</span>
                <span>·</span>
                <span>{fmtDate(e.assignedDate)}</span>
              </div>
              {e.assignedByAdminName && (
                <p className="text-[11px] text-muted-foreground">By {e.assignedByAdminName}</p>
              )}
              {e.notes && <p className="text-[11px] text-muted-foreground italic">{e.notes}</p>}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Requests Tab (cleaner-submitted supply requests) ─────────────────────────
function RequestsTab({ locations, showAdd, onCloseAdd }: { locations: any[]; showAdd: boolean; onCloseAdd: () => void }) {
  const { toast } = useToast();
  const [filterLocation, setFilterLocation] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [fulfillId, setFulfillId] = useState<string | null>(null);

  const { data: allSupplies = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/supplies"] });
  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/supplies", detailId],
    enabled: !!detailId,
  });

  // Requests = supplies that are NOT in-stock inventory-assigned items
  // i.e., either created by employee, or have a concerning status, or no inventoryItemId
  const requests = allSupplies.filter((s: any) => {
    const isInventoryAssigned = s.inventoryItemId && s.status === "in_stock";
    return !isInventoryAssigned;
  });

  const filtered = requests.filter((s: any) => {
    if (filterLocation !== "__all__" && s.locationId !== filterLocation) return false;
    if (filterStatus !== "__all__" && s.status !== filterStatus) return false;
    return true;
  });

  const hasFilters = filterLocation !== "__all__" || filterStatus !== "__all__";
  const openCount = requests.filter((s: any) => !["fulfilled", "not_needed", "resolved"].includes(s.status)).length;

  const statusMut = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/supplies/requests/${id}/status`, { status, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory-overview"] });
      toast({ title: "Request updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fulfillSupply = fulfillId ? requests.find((s: any) => s.id === fulfillId) : null;

  return (
    <div className="space-y-4">
      {/* Open requests count */}
      {openCount > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200/50 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="w-5 h-5 text-orange-500 shrink-0" />
          <p className="text-sm font-medium text-orange-800 dark:text-orange-300">{openCount} open request{openCount !== 1 ? "s" : ""} need attention</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="flex-1 min-w-[110px] max-w-[180px] h-8 text-xs" data-testid="select-filter-location">
            <MapPin className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Locations</SelectItem>
            {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="flex-1 min-w-[110px] max-w-[160px] h-8 text-xs" data-testid="select-filter-status">
            <Filter className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2 shrink-0" onClick={() => { setFilterLocation("__all__"); setFilterStatus("__all__"); }}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Supply list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No requests found</p>
          <p className="text-xs text-muted-foreground mt-1">{hasFilters ? "Try removing filters" : "Cleaner requests will appear here"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s: any) => {
            const isDone = ["fulfilled", "not_needed"].includes(s.status);
            return (
              <div
                key={s.id}
                className={`rounded-xl border bg-background shadow-sm overflow-hidden ${isDone ? "opacity-60" : ""}`}
                data-testid={`card-supply-${s.id}`}
              >
                {/* Card header - clickable for details */}
                <button
                  className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
                  onClick={() => { setDetailId(s.id); setEditMode(false); }}
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {s.imageData ? (
                        <img src={s.imageData} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {s.locationName && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="w-3 h-3" />{s.locationName}
                          </span>
                        )}
                        {s.createdByUserName && s.createdByUserRole === "employee" && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="w-3 h-3" />{s.createdByUserName}
                          </span>
                        )}
                        {s.urgency && s.urgency !== "normal" && (
                          <span className={`text-[11px] font-semibold ${s.urgency === "urgent" ? "text-red-600" : "text-orange-500"}`}>
                            {s.urgency === "urgent" ? "⚠ Urgent" : "High Priority"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Action buttons */}
                {!isDone && (
                  <div className="flex border-t divide-x overflow-x-auto scrollbar-none">
                    <button
                      className="flex-1 min-w-[80px] py-2 text-[11px] font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors flex items-center justify-center gap-1 whitespace-nowrap px-2"
                      onClick={() => setFulfillId(s.id)}
                      data-testid={`button-fulfill-${s.id}`}
                    >
                      <PackageSearch className="w-3 h-3" />Fulfill
                    </button>
                    <button
                      className="flex-1 min-w-[80px] py-2 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors flex items-center justify-center gap-1 whitespace-nowrap px-2"
                      onClick={() => statusMut.mutate({ id: s.id, status: "ordered", note: "Marked as ordered" })}
                      data-testid={`button-ordered-${s.id}`}
                    >
                      <ShoppingCart className="w-3 h-3" />Ordered
                    </button>
                    <button
                      className="flex-1 min-w-[80px] py-2 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors flex items-center justify-center gap-1 whitespace-nowrap px-2"
                      onClick={() => statusMut.mutate({ id: s.id, status: "fulfilled", note: "Resolved by admin" })}
                      data-testid={`button-resolve-${s.id}`}
                    >
                      <ClipboardCheck className="w-3 h-3" />Resolve
                    </button>
                    <button
                      className="flex-1 min-w-[80px] py-2 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-950/20 transition-colors flex items-center justify-center gap-1 whitespace-nowrap px-2"
                      onClick={() => statusMut.mutate({ id: s.id, status: "not_needed" })}
                      data-testid={`button-not-needed-${s.id}`}
                    >
                      <Ban className="w-3 h-3" />Not Needed
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
          onFulfill={() => { setFulfillId(detailId); setDetailId(null); }}
        />
      )}

      {/* Fulfill from inventory dialog */}
      {fulfillId && fulfillSupply && (
        <FulfillFromInventoryDialog
          supply={fulfillSupply}
          locations={locations}
          onClose={() => setFulfillId(null)}
        />
      )}
    </div>
  );
}

// ─── Purchase History Tab ─────────────────────────────────────────────────────
function PurchaseHistoryTab() {
  const { data: purchases = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/supplies/purchase-history"] });
  const [filterItem, setFilterItem] = useState("");

  const filtered = purchases.filter((p: any) =>
    !filterItem || p.inventoryItemName?.toLowerCase().includes(filterItem.toLowerCase())
  );

  const totalSpent = filtered.reduce((acc, p) => acc + (parseFloat(p.totalCost) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Search by item name…"
          className="h-8 text-xs max-w-xs"
          value={filterItem}
          onChange={e => setFilterItem(e.target.value)}
          data-testid="input-filter-purchases"
        />
        {filterItem && (
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setFilterItem("")}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl px-4 py-3 flex items-center justify-between border border-blue-100">
          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">{filtered.length} purchase{filtered.length !== 1 ? "s" : ""}</p>
          <p className="text-sm font-bold text-blue-800 dark:text-blue-300">{fmtCurrency(totalSpent)} total</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No purchase history</p>
          <p className="text-xs text-muted-foreground mt-1">Restock inventory items to see purchase records here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {filtered.map((p: any) => (
            <div key={p.id} className="rounded-xl border bg-background p-3 min-w-0" data-testid={`card-purchase-${p.id}`}>
              <p className="text-xs font-semibold truncate leading-tight">{p.inventoryItemName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.category}</p>
              <div className="mt-2 space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <PackageCheck className="w-3 h-3 shrink-0" />
                  <span>{p.quantityAdded} units · {fmtCurrency(parseFloat(p.unitPrice))} ea</span>
                </div>
                {p.supplierName && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Truck className="w-3 h-3 shrink-0" />
                    <span className="truncate">{p.supplierName}</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">{fmtDate(p.purchaseDate)}</p>
              </div>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mt-2">{fmtCurrency(parseFloat(p.totalCost))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Supply Dialog (unchanged) ────────────────────────────────────────────
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
          <DialogTitle>Add Supply Request</DialogTitle>
          <DialogDescription>Create a new supply item for a location.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
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
            <Textarea className="mt-1 resize-none text-sm" rows={2} placeholder="Any notes about this supply…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
function SupplyDetailSheet({ supplyId, detail, loading, locations, editMode, onEditMode, onClose, onFulfill }: {
  supplyId: string; detail: any; loading: boolean; locations: any[];
  editMode: boolean; onEditMode: (v: boolean) => void; onClose: () => void;
  onFulfill?: () => void;
}) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<"refill" | "replace" | "status" | "note" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [actionPhoto, setActionPhoto] = useState<string | null>(null);
  const actionImgRef = useRef<HTMLInputElement>(null);
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
      setActionOpen(false); setActionNote(""); setActionStatus(""); setActionPhoto(null); setActionType(null);
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
    try { setActionPhoto(await compressImage(file)); }
    catch { toast({ title: "Photo upload failed", variant: "destructive" }); }
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
    try { setEditImg(await compressImage(file)); }
    catch { toast({ title: "Photo upload failed", variant: "destructive" }); }
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

                <div className="grid grid-cols-2 gap-2 mb-5">
                  {onFulfill && (
                    <Button size="sm" variant="outline" className="col-span-2 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { onClose(); setTimeout(onFulfill, 100); }} data-testid="button-action-fulfill">
                      <PackageSearch className="w-3.5 h-3.5 mr-1.5" />Fulfill from Inventory
                    </Button>
                  )}
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

// ─── Add Supply to Location Modal ─────────────────────────────────────────────
function AddSupplyToLocationModal({ open, onClose, locations }: { open: boolean; onClose: () => void; locations: any[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ inventoryItemId: "", locationId: "", employeeId: "", quantity: "1", notes: "" });

  const { data: inventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/supplies/inventory"], enabled: open });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/supplies/company-employees"], enabled: open });

  const selectedItem = inventoryItems.find((i: any) => i.id === form.inventoryItemId);
  const selectedLocation = locations.find(l => l.id === form.locationId);
  const selectedEmployee = employees.find((e: any) => e.id === form.employeeId);
  const qty = parseInt(form.quantity) || 0;
  const unitPrice = selectedItem ? parseFloat(selectedItem.unitPrice) : 0;
  const totalExpense = qty > 0 && unitPrice > 0 ? (qty * unitPrice).toFixed(2) : null;
  const overStock = selectedItem && qty > selectedItem.currentQuantity;

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/supplies/inventory/${form.inventoryItemId}/assign-location`, {
        locationId: form.locationId,
        locationName: selectedLocation?.name || null,
        quantity: form.quantity,
        assignedEmployeeId: (form.employeeId && form.employeeId !== "__none__") ? form.employeeId : null,
        assignedEmployeeName: selectedEmployee && form.employeeId !== "__none__" ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : null,
        notes: form.notes || null,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to assign supply");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/location-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies"] });
      toast({ title: "Supply added to location", description: `Remaining stock: ${data.newQuantity}` });
      setForm({ inventoryItemId: "", locationId: "", employeeId: "", quantity: "1", notes: "" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canSubmit = form.inventoryItemId && form.locationId && qty > 0 && !overStock && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Supply to Location</DialogTitle>
          <DialogDescription>Select an inventory item and assign it to a location.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Inventory item selector */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Inventory Item *</Label>
            <Select value={form.inventoryItemId} onValueChange={v => setForm(f => ({ ...f, inventoryItemId: v, quantity: "1" }))}>
              <SelectTrigger className="mt-1" data-testid="select-add-supply-item">
                <SelectValue placeholder="Select inventory item" />
              </SelectTrigger>
              <SelectContent>
                {inventoryItems.filter((i: any) => i.currentQuantity > 0).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    <span className="flex items-center gap-2">
                      {i.name}
                      <span className="text-[11px] text-muted-foreground">({i.currentQuantity} in stock)</span>
                    </span>
                  </SelectItem>
                ))}
                {inventoryItems.filter((i: any) => i.currentQuantity === 0).map((i: any) => (
                  <SelectItem key={i.id} value={i.id} disabled>
                    {i.name} <span className="text-red-500 text-[11px]">(Out of stock)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Item details after selection */}
          {selectedItem && (
            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium">{selectedItem.category}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">In Stock</span>
                <span className="font-medium">{selectedItem.currentQuantity} units</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Unit Price</span>
                <span className="font-semibold">{fmtCurrency(unitPrice)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Stock Value</span>
                <span className="text-emerald-700 font-semibold">{fmtCurrency(unitPrice * selectedItem.currentQuantity)}</span>
              </div>
            </div>
          )}

          {/* Location selector */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Location *</Label>
            <Select value={form.locationId} onValueChange={v => setForm(f => ({ ...f, locationId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-add-supply-location">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Employee selector (optional) */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Assign to Employee (optional)</Label>
            <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-add-supply-employee">
                <SelectValue placeholder="No specific employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No specific employee</SelectItem>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quantity *</Label>
            <Input
              className={`mt-1 ${overStock ? "border-red-400" : ""}`}
              type="number" min="1"
              max={selectedItem?.currentQuantity || 999}
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              data-testid="input-add-supply-qty"
            />
            {overStock && (
              <p className="text-xs text-red-600 mt-1">Only {selectedItem.currentQuantity} unit{selectedItem.currentQuantity !== 1 ? "s" : ""} available</p>
            )}
          </div>

          {/* Unit price (read-only) + total */}
          {selectedItem && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Unit Price</Label>
                <Input className="mt-1 bg-muted" value={fmtCurrency(unitPrice)} readOnly />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Total Expense</Label>
                <Input className="mt-1 bg-muted font-semibold text-emerald-700" value={totalExpense ? fmtCurrency(parseFloat(totalExpense)) : "—"} readOnly />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Note (optional)</Label>
            <Textarea
              className="mt-1 resize-none text-sm"
              rows={2}
              placeholder="e.g. Dropped off for restroom area"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={!canSubmit} onClick={() => mut.mutate()} data-testid="button-confirm-add-supply">
              {mut.isPending ? "Adding…" : "Add Supply"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fulfill from Inventory Dialog ────────────────────────────────────────────
function FulfillFromInventoryDialog({ supply, locations, onClose }: { supply: any; locations: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ inventoryItemId: "", quantity: String(supply.requestedQuantity || 1), notes: "" });

  const { data: inventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/supplies/inventory"] });

  const selectedItem = inventoryItems.find((i: any) => i.id === form.inventoryItemId);
  const qty = parseInt(form.quantity) || 0;
  const overStock = selectedItem && qty > selectedItem.currentQuantity;
  const locationName = locations.find(l => l.id === supply.locationId)?.name || supply.locationName || "";

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/supplies/inventory/${form.inventoryItemId}/assign-location`, {
        locationId: supply.locationId,
        locationName,
        quantity: form.quantity,
        supplyRequestId: supply.id,
        notes: form.notes || `Fulfilled cleaner request for ${supply.name}`,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fulfill request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/inventory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplies/location-expenses"] });
      toast({ title: "Request fulfilled", description: "Inventory deducted and location expense updated." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canSubmit = form.inventoryItemId && qty > 0 && !overStock && !mut.isPending;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fulfill from Inventory</DialogTitle>
          <DialogDescription>
            Request: {supply.name}
            {supply.locationName && ` · ${supply.locationName}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Request context */}
          <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-3 space-y-1">
            <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">Cleaner Request Details</p>
            <p className="text-xs text-orange-700 dark:text-orange-400">{supply.name} · <StatusBadge status={supply.status} /></p>
            {supply.locationName && <p className="text-xs text-orange-600 dark:text-orange-500">{supply.locationName}</p>}
            {supply.createdByUserName && <p className="text-xs text-orange-600 dark:text-orange-500">Requested by: {supply.createdByUserName}</p>}
          </div>

          {/* Inventory item selector */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Select Inventory Item *</Label>
            <Select value={form.inventoryItemId} onValueChange={v => setForm(f => ({ ...f, inventoryItemId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-fulfill-item">
                <SelectValue placeholder="Choose item to use from inventory" />
              </SelectTrigger>
              <SelectContent>
                {inventoryItems.filter((i: any) => i.currentQuantity > 0).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} <span className="text-muted-foreground text-[11px]">({i.currentQuantity} left)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available</span>
                <span className="font-medium">{selectedItem.currentQuantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit Price</span>
                <span className="font-medium">{fmtCurrency(parseFloat(selectedItem.unitPrice))}</span>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quantity *</Label>
            <Input
              className={`mt-1 ${overStock ? "border-red-400" : ""}`}
              type="number" min="1"
              max={selectedItem?.currentQuantity || 999}
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              data-testid="input-fulfill-qty"
            />
            {overStock && <p className="text-xs text-red-600 mt-1">Only {selectedItem.currentQuantity} units available</p>}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Admin Note (optional)</Label>
            <Textarea
              className="mt-1 resize-none text-sm"
              rows={2}
              placeholder="e.g. Dropped off 2 units today. Check the storage closet."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={!canSubmit} onClick={() => mut.mutate()} data-testid="button-confirm-fulfill">
              {mut.isPending ? "Fulfilling…" : "Fulfill Request"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
