import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  NotebookPen, Plus, Search, Camera, Clock,
  MapPin, ChevronRight, Loader2, Images, Sparkles
} from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";

type Session = {
  id: string; title: string | null; locationId: string | null; locationName: string | null;
  createdByUserId: string; createdByName: string; sessionType: string; status: string;
  aiStatus: string; aiSummary: string | null; startedAt: string; endedAt: string | null;
};

const SESSION_TYPES = [
  { value: "site_visit", label: "Site Visit" },
  { value: "inspection", label: "Inspection" },
  { value: "pre_clean", label: "Pre-Clean" },
  { value: "post_clean", label: "Post-Clean" },
  { value: "damage_report", label: "Damage Report" },
  { value: "maintenance", label: "Maintenance" },
];

const STATUS_DOT: Record<string, string> = {
  recording: "bg-red-500 animate-pulse",
  uploading: "bg-yellow-500",
  processing: "bg-blue-500 animate-pulse",
  ready: "bg-green-500",
  failed: "bg-gray-400",
};

const STATUS_BADGE: Record<string, string> = {
  recording: "bg-red-100 text-red-700 border-red-200",
  uploading: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  ready: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-gray-100 text-gray-500",
};

function SessionCard({ s, onClick }: { s: Session; onClick: () => void }) {
  const label = SESSION_TYPES.find(t => t.value === s.sessionType)?.label ?? s.sessionType;
  return (
    <div
      data-testid={`card-field-note-${s.id}`}
      className="rounded-xl border bg-card p-3.5 cursor-pointer hover:shadow-md transition-shadow flex items-start gap-3"
      onClick={onClick}
    >
      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[s.status] ?? "bg-gray-300"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{s.title || label}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[s.status] ?? ""}`}>
            {s.status === "processing" && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
            {s.status}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{label}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{format(parseISO(s.startedAt), "h:mm a")}</span>
          <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" />{s.createdByName}</span>
        </div>
        {s.aiSummary && s.status === "ready" && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">"{s.aiSummary}"</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
    </div>
  );
}

export default function AdminFieldNotes() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [startOpen, setStartOpen] = useState(false);
  const [newSession, setNewSession] = useState({ sessionType: "site_visit", locationId: "", title: "" });

  const { data: sessions = [], isLoading } = useQuery<Session[]>({ queryKey: ["/api/field-notes"] });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const startMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/field-notes/sessions", data),
    onSuccess: async (res) => {
      const session = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes"] });
      setStartOpen(false);
      navigate(`/admin/field-notes/capture?sessionId=${session.id}&return=/admin/field-notes`);
    },
    onError: () => toast({ title: "Failed to start session", variant: "destructive" }),
  });

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || (s.title ?? "").toLowerCase().includes(q) || (s.locationName ?? "").toLowerCase().includes(q)
      || s.createdByName.toLowerCase().includes(q) || (s.aiSummary ?? "").toLowerCase().includes(q);
    return matchSearch && (filterStatus === "all" || s.status === filterStatus) && (filterType === "all" || s.sessionType === filterType);
  });

  // Group by project (locationName) then by date
  const byProject: Record<string, Record<string, Session[]>> = {};
  for (const s of filtered) {
    const proj = s.locationName ?? "No Project";
    const d = parseISO(s.startedAt);
    const dateKey = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
    if (!byProject[proj]) byProject[proj] = {};
    if (!byProject[proj][dateKey]) byProject[proj][dateKey] = [];
    byProject[proj][dateKey].push(s);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-base font-semibold leading-none">Field Notes</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Site documentation · photo + voice</p>
          </div>
        </div>
        <Button data-testid="button-new-field-note" onClick={() => setStartOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New Session
        </Button>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-2.5 border-b flex flex-wrap gap-2 items-center bg-muted/30">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <Input data-testid="input-search-field-notes" className="pl-8 h-7 text-xs" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
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
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : Object.keys(byProject).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <NotebookPen className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No field notes yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Start a session to document your next jobsite</p>
            <Button className="mt-4 gap-1.5" onClick={() => setStartOpen(true)}><Plus className="w-4 h-4" /> Start First Session</Button>
          </div>
        ) : (
          Object.entries(byProject).map(([project, dateGroups]) => (
            <div key={project}>
              {/* Project header */}
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <h2 className="text-sm font-semibold">{project}</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">{Object.values(dateGroups).flat().length} session{Object.values(dateGroups).flat().length !== 1 ? "s" : ""}</span>
              </div>

              <div className="space-y-4 pl-1">
                {Object.entries(dateGroups).map(([date, list]) => (
                  <div key={date}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 pl-1">{date}</p>
                    <div className="space-y-2">
                      {list.map(s => (
                        <SessionCard key={s.id} s={s} onClick={() => navigate(`/admin/field-notes/session/${s.id}`)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Start Session dialog */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="w-4 h-4" /> Start Field Note Session</DialogTitle></DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
            <Button data-testid="button-start-session" disabled={startMutation.isPending}
              onClick={() => startMutation.mutate({ sessionType: newSession.sessionType, locationId: newSession.locationId || null, title: newSession.title || null })}
              className="gap-1.5">
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Start Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
