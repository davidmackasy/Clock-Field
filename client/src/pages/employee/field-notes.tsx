import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  NotebookPen, Plus, Camera, Mic, Clock,
  MapPin, ChevronRight, Loader2, Sparkles
} from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";

type Session = {
  id: string;
  title: string | null;
  locationName: string | null;
  sessionType: string;
  status: string;
  aiStatus: string;
  aiSummary: string | null;
  startedAt: string;
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

export default function EmployeeFieldNotes() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
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
      navigate(`/employee/field-notes/capture?sessionId=${session.id}&return=/employee/field-notes`);
    },
    onError: () => toast({ title: "Failed to start session", variant: "destructive" }),
  });

  function dayLabel(iso: string) {
    const d = parseISO(iso);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMM d, yyyy");
  }

  function sessionLabel(type: string) {
    return SESSION_TYPES.find(t => t.value === type)?.label ?? type;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold">Field Notes</h1>
        </div>
        <Button
          data-testid="button-new-field-note-employee"
          size="sm"
          onClick={() => setStartOpen(true)}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <NotebookPen className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No field notes yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Document your next jobsite with photos and voice</p>
            <Button className="mt-4 gap-1.5" onClick={() => setStartOpen(true)}>
              <Plus className="w-4 h-4" /> Start Session
            </Button>
          </div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              data-testid={`card-field-note-${s.id}`}
              className="rounded-xl border bg-card p-4 flex items-start justify-between gap-2 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/employee/field-notes/session/${s.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.title || sessionLabel(s.sessionType)}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[s.status] ?? ""}`}>
                    {s.status === "processing" && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                    {s.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {s.locationName && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.locationName}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />{dayLabel(s.startedAt)} · {format(parseISO(s.startedAt), "h:mm a")}
                  </span>
                </div>
                {s.aiSummary && s.status === "ready" && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">"{s.aiSummary}"</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        data-testid="fab-new-field-note"
        onClick={() => setStartOpen(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        <Camera className="w-6 h-6" />
      </button>

      {/* Start dialog */}
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
                <SelectTrigger data-testid="select-session-type-employee">
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
                <SelectTrigger data-testid="select-session-location-employee">
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
                data-testid="input-session-title-employee"
                placeholder="e.g. Morning inspection"
                value={newSession.title}
                onChange={e => setNewSession(s => ({ ...s, title: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-start-session-employee"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate({
                sessionType: newSession.sessionType,
                locationId: newSession.locationId || null,
                title: newSession.title || null,
              })}
              className="gap-1.5"
            >
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
