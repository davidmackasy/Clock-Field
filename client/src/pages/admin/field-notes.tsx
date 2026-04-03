import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  NotebookPen, Plus, Search, Camera, Mic, Clock,
  MapPin, User, ChevronRight, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Filter, Images
} from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";

type Session = {
  id: string;
  title: string | null;
  locationId: string | null;
  locationName: string | null;
  createdByUserId: string;
  createdByName: string;
  sessionType: string;
  status: string;
  aiStatus: string;
  aiSummary: string | null;
  startedAt: string;
  endedAt: string | null;
};

const SESSION_TYPES = [
  { value: "site_visit", label: "Site Visit" },
  { value: "inspection", label: "Inspection" },
  { value: "pre_clean", label: "Pre-Clean" },
  { value: "post_clean", label: "Post-Clean" },
  { value: "damage_report", label: "Damage Report" },
  { value: "maintenance", label: "Maintenance" },
];

const STATUS_COLORS: Record<string, string> = {
  recording: "bg-red-100 text-red-700 border-red-200",
  uploading: "bg-yellow-100 text-yellow-700 border-yellow-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  ready: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-gray-100 text-gray-600 border-gray-200",
};

function groupByDate(sessions: Session[]) {
  const groups: Record<string, Session[]> = {};
  for (const s of sessions) {
    const d = parseISO(s.startedAt);
    const key = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMMM d, yyyy");
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

export default function AdminFieldNotes() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [startOpen, setStartOpen] = useState(false);
  const [newSession, setNewSession] = useState({ sessionType: "site_visit", locationId: "", title: "" });

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["/api/field-notes"],
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const startMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/field-notes/sessions", data),
    onSuccess: async (res) => {
      const session = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/field-notes"] });
      setStartOpen(false);
      navigate(`/admin/field-notes/capture?sessionId=${session.id}`);
    },
    onError: () => toast({ title: "Failed to start session", variant: "destructive" }),
  });

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (s.title ?? "").toLowerCase().includes(q) ||
      (s.locationName ?? "").toLowerCase().includes(q) ||
      s.createdByName.toLowerCase().includes(q) ||
      (s.aiSummary ?? "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchType = filterType === "all" || s.sessionType === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const grouped = groupByDate(filtered);

  function sessionLabel(s: Session) {
    return SESSION_TYPES.find(t => t.value === s.sessionType)?.label ?? s.sessionType;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-4 md:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-none">Field Notes</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Photo + voice documentation</p>
          </div>
        </div>
        <Button data-testid="button-new-field-note" onClick={() => setStartOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New Session
        </Button>
      </div>

      <div className="px-4 md:px-6 py-3 border-b flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-testid="input-search-field-notes"
            className="pl-8 h-8 text-sm"
            placeholder="Search notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-filter-status" className="h-8 w-32 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="recording">Recording</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger data-testid="select-filter-type" className="h-8 w-36 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SESSION_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <NotebookPen className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No field notes yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Start a new session to document a jobsite</p>
            <Button className="mt-4 gap-1.5" onClick={() => setStartOpen(true)}>
              <Plus className="w-4 h-4" /> Start First Session
            </Button>
          </div>
        ) : (
          Object.entries(grouped).map(([date, list]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{date}</p>
              <div className="space-y-2">
                {list.map(s => (
                  <div
                    key={s.id}
                    data-testid={`card-field-note-${s.id}`}
                    className="rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/admin/field-notes/session/${s.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {s.title || sessionLabel(s)}
                          </span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[s.status] ?? ""}`}>
                            {s.status === "processing" && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                            {s.status}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sessionLabel(s)}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {s.locationName && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {s.locationName}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {s.createdByName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(s.startedAt), "h:mm a")}
                          </span>
                        </div>
                        {s.aiSummary && s.status === "ready" && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{s.aiSummary}"</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4" /> Start Field Note Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Session Type</Label>
              <Select
                value={newSession.sessionType}
                onValueChange={v => setNewSession(s => ({ ...s, sessionType: v }))}
              >
                <SelectTrigger data-testid="select-session-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Location (optional)</Label>
              <Select
                value={newSession.locationId || "none"}
                onValueChange={v => setNewSession(s => ({ ...s, locationId: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="select-session-location">
                  <SelectValue placeholder="Select location…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific location</SelectItem>
                  {locations.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Title (optional)</Label>
              <Input
                data-testid="input-session-title"
                placeholder="e.g. Main lobby inspection"
                value={newSession.title}
                onChange={e => setNewSession(s => ({ ...s, title: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-start-session"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate({
                sessionType: newSession.sessionType,
                locationId: newSession.locationId || null,
                title: newSession.title || null,
              })}
              className="gap-1.5"
            >
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Start Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
