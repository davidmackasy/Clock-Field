import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  NotebookPen, Plus, Search, Camera, Clock, MapPin,
  ChevronRight, Loader2, User, FileCheck, FileClock, AlertCircle,
  FileText,
} from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type Session = {
  id: string; title: string | null; locationId: string | null; locationName: string | null;
  createdByUserId: string; createdByName: string; createdByRole: string;
  sessionType: string; sessionSubtype: string; status: string; aiStatus: string; aiSummary: string | null;
  startedAt: string; endedAt: string | null; photoCount: number;
};

const SESSION_TYPES = [
  { value: "site_visit", label: "Site Visit" },
  { value: "inspection", label: "Inspection" },
  { value: "pre_clean", label: "Pre-Clean" },
  { value: "post_clean", label: "Post-Clean" },
  { value: "damage_report", label: "Damage Report" },
  { value: "maintenance", label: "Maintenance" },
];

const STATUS_CONFIG: Record<string, { dot: string; badge: string }> = {
  recording: { dot: "bg-red-500 animate-pulse", badge: "bg-red-100 text-red-700 border-red-200" },
  uploading: { dot: "bg-yellow-500 animate-pulse", badge: "bg-yellow-100 text-yellow-700" },
  processing: { dot: "bg-blue-500 animate-pulse", badge: "bg-blue-100 text-blue-700" },
  ready: { dot: "bg-green-500", badge: "bg-green-100 text-green-700 border-green-200" },
  failed: { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-500" },
};

function DocStatusIcon({ aiStatus, status, sessionSubtype }: { aiStatus: string; status: string; sessionSubtype: string }) {
  if (sessionSubtype === "manual_page") {
    return <span className="flex items-center gap-1 text-[10px] text-purple-600 font-medium"><FileText className="w-3 h-3" /> Page</span>;
  }
  if (status === "recording") return <span className="text-[10px] text-muted-foreground">In progress…</span>;
  if (aiStatus === "processing" || status === "processing") return (
    <span className="flex items-center gap-1 text-[10px] text-blue-600"><FileClock className="w-3 h-3" /> Generating…</span>
  );
  if (aiStatus === "done") return (
    <span className="flex items-center gap-1 text-[10px] text-green-600"><FileCheck className="w-3 h-3" /> Doc Ready</span>
  );
  if (aiStatus === "failed") return (
    <span className="flex items-center gap-1 text-[10px] text-orange-500"><AlertCircle className="w-3 h-3" /> AI failed</span>
  );
  return <span className="text-[10px] text-muted-foreground">—</span>;
}

function SessionCard({ s, onClick }: { s: Session; onClick: () => void }) {
  const label = SESSION_TYPES.find(t => t.value === s.sessionType)?.label ?? s.sessionType;
  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.failed;
  const isPage = s.sessionSubtype === "manual_page";

  return (
    <div
      data-testid={`card-field-note-${s.id}`}
      className={cn(
        "group rounded-xl border bg-card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-150 flex flex-col overflow-hidden",
        isPage && "border-purple-100 hover:border-purple-300"
      )}
      onClick={onClick}
    >
      <div className={cn("h-1 w-full", isPage ? "bg-purple-400" : s.status === "ready" ? "bg-green-400" : s.status === "processing" ? "bg-blue-400" : s.status === "recording" ? "bg-red-400" : "bg-gray-200")} />

      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">{s.title || label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1", isPage ? "bg-purple-400" : cfg.dot)} />
        </div>

        <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 min-w-0">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{format(parseISO(s.startedAt), "h:mm a")}</span>
          </span>
          <span className="flex items-center gap-1 min-w-0">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{s.createdByName}</span>
          </span>
          {s.photoCount > 0 && (
            <span className="flex items-center gap-1">
              <Camera className="w-3 h-3 flex-shrink-0" />
              <span>{s.photoCount} photo{s.photoCount !== 1 ? "s" : ""}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 mt-auto pt-1 border-t">
          {isPage ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">Page</Badge>
          ) : (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", cfg.badge)}>
              {s.status === "processing" && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
              {s.status}
            </Badge>
          )}
          <div className="flex-1" />
          <DocStatusIcon aiStatus={s.aiStatus} status={s.status} sessionSubtype={s.sessionSubtype ?? "walkthrough_note"} />
        </div>
      </div>
    </div>
  );
}

type CreateMode = null | "walkthrough";

export default function AdminFieldNotes() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [newSession, setNewSession] = useState({ sessionType: "site_visit", locationId: "", title: "" });

  const { data: sessions = [], isLoading } = useQuery<Session[]>({ queryKey: ["/api/field-notes"] });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const startWalkthroughMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/field-notes/sessions", data).then(r => r.json()),
    onSuccess: async (session) => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes"] });
      setCreateMode(null);
      navigate(`/admin/field-notes/capture?sessionId=${session.id}&return=/admin/field-notes`);
    },
    onError: () => toast({ title: "Failed to start session", variant: "destructive" }),
  });


  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || (s.title ?? "").toLowerCase().includes(q) || (s.locationName ?? "").toLowerCase().includes(q)
      || s.createdByName.toLowerCase().includes(q) || (s.aiSummary ?? "").toLowerCase().includes(q);
    return s.sessionSubtype !== "manual_page" && matchSearch && (filterStatus === "all" || s.status === filterStatus) && (filterType === "all" || s.sessionType === filterType);
  });

  type DateGroup = Record<string, Session[]>;
  type ProjectGroup = Record<string, DateGroup>;
  const byProject: ProjectGroup = {};
  for (const s of filtered) {
    const proj = s.locationName ?? "No Project";
    const d = parseISO(s.startedAt);
    const dateKey = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
    if (!byProject[proj]) byProject[proj] = {};
    if (!byProject[proj][dateKey]) byProject[proj][dateKey] = [];
    byProject[proj][dateKey].push(s);
  }

  const handleCardClick = (s: Session) => {
    if (s.sessionSubtype === "manual_page") {
      navigate(`/admin/field-notes/page/${s.id}`);
    } else {
      navigate(`/admin/field-notes/session/${s.id}`);
    }
  };

  const startWalkthrough = () => {
    startWalkthroughMutation.mutate({
      sessionType: newSession.sessionType,
      locationId: newSession.locationId || null,
      title: newSession.title || null,
      sessionSubtype: "walkthrough_note",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-base font-semibold leading-none">Field Notes</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Walkthroughs · Documents</p>
          </div>
        </div>
        <Button data-testid="button-new-field-note" onClick={() => setCreateMode("walkthrough")} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-2.5 border-b flex flex-wrap gap-2 items-center bg-muted/30">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <Input data-testid="input-search-field-notes" className="pl-8 h-7 text-xs" placeholder="Search by title, project, or person…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-filter-status" className="h-7 w-28 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="recording">Recording</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger data-testid="select-filter-type" className="h-7 w-32 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SESSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : Object.keys(byProject).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <NotebookPen className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No field notes yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Start a walkthrough to capture notes</p>
            <Button className="mt-4 gap-1.5" onClick={() => setCreateMode("walkthrough")}><Plus className="w-4 h-4" /> Create First Note</Button>
          </div>
        ) : (
          Object.entries(byProject).map(([project, dateGroups]) => (
            <div key={project}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <h2 className="text-sm font-bold">{project}</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {Object.values(dateGroups).flat().length} session{Object.values(dateGroups).flat().length !== 1 ? "s" : ""}
                </span>
              </div>
              {Object.entries(dateGroups).map(([date, list]) => (
                <div key={date} className="mb-5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 pl-1">{date}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {list.map(s => (
                      <SessionCard key={s.id} s={s} onClick={() => handleCardClick(s)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* ── Walkthrough setup ────────────────────────────────────────────────── */}
      <Dialog open={createMode === "walkthrough"} onOpenChange={v => !v && setCreateMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-red-500" /> Start Walkthrough Note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Session Type</Label>
              <Select value={newSession.sessionType} onValueChange={v => setNewSession(s => ({ ...s, sessionType: v }))}>
                <SelectTrigger data-testid="select-session-type"><SelectValue /></SelectTrigger>
                <SelectContent>{SESSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Project / Location</Label>
              <Select value={newSession.locationId || "none"} onValueChange={v => setNewSession(s => ({ ...s, locationId: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-session-location"><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific project</SelectItem>
                  {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Title (optional)</Label>
              <Input data-testid="input-session-title" placeholder="e.g. Main lobby walkthrough" value={newSession.title} onChange={e => setNewSession(s => ({ ...s, title: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateMode(null)}>Cancel</Button>
            <Button
              data-testid="button-start-session"
              disabled={startWalkthroughMutation.isPending}
              onClick={startWalkthrough}
              className="flex-1 gap-1.5"
            >
              {startWalkthroughMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Start Capture
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
