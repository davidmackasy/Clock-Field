import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminBlockEditor } from "@/components/training/admin-block-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import TrainingAIWizard from "@/components/admin/training-ai-wizard";
import {
  Plus, BookOpen, Users, Trophy, Clock, ChevronRight, Pencil, Trash2,
  Globe, Lock, Copy, ExternalLink, Play, FileText, Image, CheckCircle2,
  BarChart3, Loader2, X, GripVertical, Eye, EyeOff, Award, Search,
  ChevronDown, ChevronUp, Upload, AlertCircle, Check, ShieldCheck,
  Sparkles, Wrench, GraduationCap, HeartHandshake, Activity, Mail, XCircle,
} from "lucide-react";

type PublicLearnerRow = {
  id: string;
  name: string;
  email: string;
  startedAt: string;
  completedAt: string | null;
  modulesCompleted: number;
  totalModules: number;
  progressPct: number;
  bestQuizScore: number | null;
  quizPassed: boolean;
  quizAttempts: number;
  certificateId: string | null;
  certificateCode: string | null;
  lastActivity: string;
};

type Course = {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnailData: string | null;
  isRequired: boolean;
  isPublished: boolean;
  publicLinkEnabled: boolean;
  publicId: string | null;
  certificateEnabled: boolean;
  estimatedDuration: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  moduleCount?: number;
  assignedCount?: number;
  completedCount?: number;
  modules?: { id: string; title: string; sortOrder: number; completedCount: number }[];
  activeLearners?: { employeeId: string; name: string; initials: string; currentModuleIndex: number }[];
  cohortProgress?: number;
};

type Module = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  youtubeUrl: string | null;
  youtubeEmbedId: string | null;
  lessonText: string | null;
  sortOrder: number;
  isRequired: boolean;
  assets: { id: string; assetData: string; assetType: string; sortOrder: number }[];
};

type CourseDetail = {
  course: Course;
  modules: Module[];
  assignments: any[];
  completions: any[];
  stats: { assigned: number; started: number; completed: number; completionPct: number };
};

type Employee = { id: string; firstName: string; lastName: string; email: string; position: string | null };

const CATEGORIES = ["Onboarding", "Safety", "Cleaning Techniques", "Equipment", "Customer Service", "Compliance", "Leadership", "Other"];

function parseYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const CATEGORY_ICONS: Record<string, any> = {
  Onboarding: GraduationCap,
  Safety: ShieldCheck,
  "Cleaning Techniques": Sparkles,
  Equipment: Wrench,
  "Customer Service": HeartHandshake,
  Compliance: ShieldCheck,
  Leadership: Trophy,
  Other: BookOpen,
};

const LEARNER_PALETTE = [
  "bg-rose-400", "bg-amber-400", "bg-sky-400",
  "bg-violet-400", "bg-emerald-400", "bg-pink-400",
];
const LEARNER_PALETTE_HEX = [
  "#fb7185", "#fbbf24", "#38bdf8",
  "#a78bfa", "#34d399", "#f472b6",
];
function learnerHash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
function colorForLearner(id: string) {
  return LEARNER_PALETTE[learnerHash(id) % LEARNER_PALETTE.length];
}
function colorHexForLearner(id: string) {
  return LEARNER_PALETTE_HEX[learnerHash(id) % LEARNER_PALETTE_HEX.length];
}
function initialsFromName(name: string) {
  const parts = (name ?? "").trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function ProgressRing({
  progress, color, initials, size = 60,
}: { progress: number; color: string; initials: string; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, progress)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="stroke-muted" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div
        className="absolute inset-[5px] rounded-full flex items-center justify-center text-white text-[13px] font-semibold tracking-wide"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    </div>
  );
}

type RosterLearner = {
  id: string;
  name: string;
  role: string;
  progress: number;
  initials: string;
  color: string;
};

function CohortRoster({
  learners, totalAssigned, totalModules, onAssign,
}: { learners: RosterLearner[]; totalAssigned: number; totalModules: number; onAssign: () => void }) {
  if (totalAssigned === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5" data-testid="card-cohort-roster">
        <h3 className="font-semibold text-foreground mb-1">Cohort Roster</h3>
        <p className="text-xs text-muted-foreground mb-4">No employees assigned yet</p>
        <div className="text-center py-6 border border-dashed border-border rounded-lg">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Assign your first learners to start tracking</p>
          <Button size="sm" variant="outline" onClick={onAssign} data-testid="btn-roster-assign-first">
            Assign Employees
          </Button>
        </div>
      </div>
    );
  }

  const sorted = [...learners].sort((a, b) => b.progress - a.progress);
  const featured = sorted.slice(0, 4);
  const overflow = sorted.slice(4);
  const stackVisible = overflow.slice(0, 5);
  const stackHidden = Math.max(0, overflow.length - stackVisible.length);

  const cohortAvg = sorted.length > 0
    ? Math.round(sorted.reduce((s, l) => s + l.progress, 0) / sorted.length)
    : 0;

  const doneCount = sorted.filter(l => l.progress >= 100).length;
  const inProgressCount = sorted.filter(l => l.progress > 0 && l.progress < 100).length;
  const notStartedCount = Math.max(0, totalAssigned - sorted.length) + sorted.filter(l => l.progress === 0).length;

  return (
    <div className="bg-card border border-border rounded-xl p-5" data-testid="cohort-roster">
      {/* Tiny header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Cohort</div>
        <div className="text-[11px] text-muted-foreground/70">·</div>
        <div className="text-[11px] text-muted-foreground">{totalAssigned} enrolled · {totalModules} module{totalModules === 1 ? "" : "s"}</div>
      </div>

      {/* Featured rings */}
      <div className={`grid gap-3 mb-5 ${featured.length === 1 ? "grid-cols-1" : featured.length === 2 ? "grid-cols-2" : featured.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {featured.map((l) => (
          <div key={l.id} className="flex flex-col items-center text-center" data-testid={`ring-${l.id}`}>
            <ProgressRing progress={l.progress} color={l.color} initials={l.initials} />
            <div className="mt-2 text-[12px] font-medium text-foreground leading-tight truncate w-full" title={l.name}>
              {l.name.split(/\s+/)[0]}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">{l.progress}%</div>
          </div>
        ))}
      </div>

      {/* Stacked overflow */}
      {(overflow.length > 0 || totalAssigned > sorted.length) && (
        <div className="flex items-center gap-3 py-3 border-y border-border">
          <div className="flex -space-x-2">
            {stackVisible.map((l) => (
              <div
                key={l.id}
                className="h-8 w-8 rounded-full ring-2 ring-card flex items-center justify-center text-white text-[10px] font-semibold"
                style={{ backgroundColor: l.color }}
                title={l.name}
                data-testid={`stack-avatar-${l.id}`}
              >
                {l.initials}
              </div>
            ))}
            {stackHidden > 0 && (
              <div className="h-8 w-8 rounded-full ring-2 ring-card bg-muted flex items-center justify-center text-foreground text-[10px] font-semibold">
                +{stackHidden}
              </div>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground leading-tight">
            <div>and {overflow.length} more</div>
            <div className="text-muted-foreground/70">enrolled in this course</div>
          </div>
        </div>
      )}

      {/* Cohort summary */}
      <div className="flex items-end gap-4 mt-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cohort avg</div>
          <div className="text-3xl font-bold text-foreground tabular-nums leading-none mt-1" data-testid="text-cohort-avg">
            {cohortAvg}<span className="text-base text-muted-foreground font-medium">%</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-foreground rounded-full" style={{ width: `${cohortAvg}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 tabular-nums">
            <span data-testid="text-roster-done">{doneCount} done</span>
            <span data-testid="text-roster-inprogress">{inProgressCount} in progress</span>
            <span data-testid="text-roster-notstarted">{notStartedCount} not started</span>
          </div>
        </div>
      </div>

      <Button variant="ghost" size="sm" className="w-full mt-4 h-8 text-muted-foreground hover:text-foreground justify-between" onClick={onAssign} data-testid="btn-manage-cohort">
        <span>Manage cohort</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>

      {/* Full learner list — collapsible to preserve per-employee detail */}
      {sorted.length > 0 && (
        <RosterFullList learners={sorted} />
      )}
    </div>
  );
}

function RosterFullList({ learners }: { learners: RosterLearner[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        data-testid="btn-toggle-full-roster"
      >
        <span>All learners ({learners.length})</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
          {learners.map((l) => (
            <div key={l.id} className="flex items-center gap-3" data-testid={`row-learner-${l.id}`}>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                style={{ backgroundColor: l.color }}
              >
                {l.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{l.name}</div>
                <div className="w-full h-1 bg-muted rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${l.progress >= 100 ? "bg-emerald-500" : ""}`}
                    style={{ width: `${l.progress}%`, backgroundColor: l.progress < 100 ? l.color : undefined }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">{l.progress}%</div>
              {l.progress >= 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function PublicLearnersRoster({
  learners, publicLink, onCopy,
}: { learners: PublicLearnerRow[]; publicLink: string | null; onCopy: () => void }) {
  const passed = learners.filter(l => l.quizPassed).length;
  const inProgress = learners.filter(l => !l.quizPassed && l.modulesCompleted > 0).length;
  return (
    <div className="bg-card border border-border rounded-xl p-5" data-testid="card-public-learners">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-foreground">Public Link Learners</h3>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {learners.length} learner{learners.length === 1 ? "" : "s"} · {passed} passed · {inProgress} in progress
          </div>
        </div>
      </div>

      {publicLink && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Public link</div>
          <div className="flex items-center gap-1">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate" data-testid="text-public-link">{publicLink}</code>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCopy} data-testid="btn-copy-public-link-roster">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <a href={publicLink} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid="btn-open-public-link">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>
      )}

      {learners.length === 0 ? (
        <div className="py-6 border border-dashed border-border rounded-lg text-center" data-testid="empty-public-learners">
          <Globe className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No public learners yet — share the link to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {learners.map(l => {
            const initials = initialsFromName(l.name);
            const color = colorHexForLearner(l.id);
            return (
              <div key={l.id} className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors" data-testid={`row-public-learner-${l.id}`}>
                <div className="flex items-start gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium text-foreground truncate" data-testid={`text-public-learner-name-${l.id}`}>{l.name}</div>
                      {l.quizPassed && <Badge className="bg-emerald-500 text-white text-[10px] h-4 px-1">Passed</Badge>}
                      {l.quizAttempts > 0 && !l.quizPassed && <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-300">Failed</Badge>}
                      {l.certificateId && <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5"><Award className="w-2.5 h-2.5" />Cert</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate" data-testid={`text-public-learner-email-${l.id}`}>{l.email}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold tabular-nums" data-testid={`text-public-learner-progress-${l.id}`}>{l.progressPct}%</div>
                    <div className="text-[10px] text-muted-foreground">{l.modulesCompleted}/{l.totalModules} mods</div>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${l.progressPct}%`, backgroundColor: l.progressPct >= 100 ? "#10b981" : color }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2 flex-wrap">
                  {l.bestQuizScore != null ? (
                    <span className="flex items-center gap-1">
                      {l.quizPassed
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        : <XCircle className="w-3 h-3 text-amber-500" />}
                      Quiz: <span className="font-medium text-foreground tabular-nums">{l.bestQuizScore}%</span>
                      {l.quizAttempts > 1 && <span className="text-muted-foreground">({l.quizAttempts} attempts)</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Quiz: not started</span>
                  )}
                  <span className="ml-auto">Last activity: {relativeTime(l.lastActivity)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function shortName(s: string) {
  if (!s) return "";
  const w = s.split(/\s+/)[0] ?? s;
  return w.length > 7 ? w.slice(0, 7) : w;
}

function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function LiveActivityPulse({
  completions,
  onManage,
}: {
  completions: any[];
  onManage: () => void;
}) {
  const now = new Date();
  const sorted = [...completions]
    .filter((c) => c.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const oneDayMs = 24 * 60 * 60 * 1000;
  const last24h = sorted.filter(
    (c) => now.getTime() - new Date(c.completedAt).getTime() <= oneDayMs,
  );

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayCount = sorted.filter(
    (c) => new Date(c.completedAt).getTime() >= startOfToday,
  ).length;

  // 7-day buckets ending today (oldest -> today)
  const days: { label: string; count: number; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime();
    const dayEnd = dayStart + oneDayMs;
    const count = sorted.filter((c) => {
      const t = new Date(c.completedAt).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = new Date(dayStart);
    days.push({
      label: i === 0 ? "Today" : labels[d.getDay()],
      count,
      isToday: i === 0,
    });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const featured = last24h[0];
  const earlierToday = sorted
    .filter((c) => {
      const t = new Date(c.completedAt).getTime();
      return t >= startOfToday && c !== featured;
    })
    .slice(0, 4);

  if (last24h.length === 0 && todayCount === 0) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="card-pulse">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900 px-5 py-2.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Live activity
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">last 24h</span>
        </div>
        <div className="px-5 py-6 text-center">
          <Activity className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No activity in the last 24 hours.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="card-pulse">
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900 px-5 py-2.5 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Live activity
        </span>
        <span className="ml-auto text-[11px] text-emerald-700/70 dark:text-emerald-400/70">last 24h</span>
      </div>

      {featured && (
        <div className="px-5 pt-4 pb-3" data-testid="text-pulse-latest">
          <div className="text-[15px] leading-snug text-foreground">
            <span className="font-semibold">{featured.actorName}</span>
            <span className="text-muted-foreground"> finished </span>
            <span className="font-medium">{featured.moduleTitle}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{relativeTime(featured.completedAt)}</div>
        </div>
      )}

      <div className="px-5 pb-3">
        <div className="flex items-end gap-1 h-10" data-testid="chart-pulse-spark">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${d.label}: ${d.count}`}>
              <div
                className="rounded-sm bg-gradient-to-t from-emerald-200 to-emerald-400 dark:from-emerald-900 dark:to-emerald-500"
                style={{
                  height: `${Math.max(6, (d.count / maxCount) * 100)}%`,
                  opacity: 0.45 + (i / days.length) * 0.55,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
          {days.map((d, i) => (
            <span key={i} className={d.isToday ? "font-medium text-foreground" : ""}>
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {earlierToday.length > 0 && (
        <div className="px-5 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Earlier today
          </div>
          <div className="space-y-1.5">
            {earlierToday.map((a, i) => (
              <div key={a.id ?? i} className="flex items-center gap-2 text-[12px]" data-testid={`row-pulse-event-${i}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                <span className="text-foreground min-w-0 truncate">
                  <span className="font-medium">{a.actorName}</span>{" "}
                  <span className="text-muted-foreground">finished</span>{" "}
                  <span className="text-muted-foreground">{a.moduleTitle}</span>
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground flex-shrink-0">
                  {relativeTime(a.completedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border px-5 py-3 flex items-center gap-3 bg-muted/30">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Activity className="w-3.5 h-3.5" />
          <span>
            <span className="font-semibold text-foreground" data-testid="text-pulse-today-count">
              {todayCount}
            </span>{" "}
            {todayCount === 1 ? "event" : "events"} today
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7"
          onClick={onManage}
          data-testid="btn-pulse-manage"
        >
          Manage <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>
    </div>
  );
}

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[course.category ?? "Other"] ?? BookOpen;
  const modules = course.modules ?? [];
  const activeLearners = course.activeLearners ?? [];
  const moduleCount = course.moduleCount ?? 0;
  const assignedCount = course.assignedCount ?? 0;
  const cohortProgress = course.cohortProgress ?? 0;
  const totalLearners = assignedCount;

  const MAX_DOTS = 8;
  const displayModules = modules.slice(0, MAX_DOTS);
  const overflow = modules.length - displayModules.length;

  return (
    <div
      className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all group"
      onClick={onClick}
      data-testid={`card-course-${course.id}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors" data-testid={`text-course-title-${course.id}`}>
            {course.title}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {course.category ?? "Uncategorized"} · {moduleCount} module{moduleCount === 1 ? "" : "s"} · {assignedCount} learner{assignedCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-right shrink-0" data-testid={`text-cohort-progress-${course.id}`}>
          <div className="text-2xl font-bold text-foreground leading-none tabular-nums">{cohortProgress}%</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">cohort</div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center flex-wrap gap-1 mt-3">
        {course.isPublished
          ? <Badge className="bg-green-500 text-white text-[10px] h-5 px-1.5">Published</Badge>
          : <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Draft</Badge>}
        {course.isRequired && <Badge className="bg-red-500 text-white text-[10px] h-5 px-1.5">Required</Badge>}
        {course.publicLinkEnabled && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
            <Globe className="w-2.5 h-2.5" />Public
          </Badge>
        )}
        {course.estimatedDuration && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
            <Clock className="w-2.5 h-2.5" />{course.estimatedDuration}
          </Badge>
        )}
      </div>

      {/* Module path */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mt-5 mb-3">
        Module path
      </div>
      {modules.length === 0 ? (
        <div className="py-6 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground" data-testid={`empty-modules-${course.id}`}>
          No modules yet — open to add the first one
        </div>
      ) : (
        <div className="relative px-1 pt-2 pb-1">
          {/* Connecting line */}
          <div className="absolute left-3 right-3 top-[14px] h-[2px] bg-border">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${cohortProgress}%` }}
            />
          </div>
          {/* Checkpoints */}
          <div className="relative flex justify-between items-start gap-1">
            {displayModules.map((m, i) => {
              const pct = totalLearners > 0 ? m.completedCount / totalLearners : 0;
              const isDone = totalLearners > 0 && pct >= 0.95;
              const isActive = pct > 0.1 && pct < 0.95;
              const isLocked = !isDone && !isActive;
              return (
                <div key={m.id} className="flex flex-col items-center gap-1.5 flex-1 min-w-0" data-testid={`module-dot-${m.id}`}>
                  <div className={`relative z-10 h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isDone
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isActive
                      ? "bg-card border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm"
                      : "bg-card border-border text-muted-foreground"
                  }`}>
                    {isDone ? <Check className="w-3.5 h-3.5" /> : isLocked && totalLearners > 0 ? <Lock className="w-3 h-3" /> : i + 1}
                  </div>
                  <div className={`text-[10px] text-center leading-tight truncate w-full ${isLocked ? "text-muted-foreground" : "text-foreground"}`} title={m.title}>
                    {shortName(m.title)}
                  </div>
                  <div className="text-[9px] text-muted-foreground tabular-nums">
                    {m.completedCount}/{totalLearners}
                  </div>
                </div>
              );
            })}
            {overflow > 0 && (
              <div className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 36 }}>
                <div className="relative z-10 h-7 w-7 rounded-full border-2 bg-card border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                  +{overflow}
                </div>
                <div className="text-[10px] text-muted-foreground">more</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-flight learners */}
      {activeLearners.length > 0 ? (
        <div className="mt-5 rounded-lg bg-muted/40 border border-border px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="text-[11px] font-medium text-foreground">Currently in flight</div>
            <div className="ml-auto text-[11px] text-muted-foreground">{activeLearners.length} active</div>
          </div>
          <div className="space-y-1.5">
            {activeLearners.map((l) => {
              const color = colorForLearner(l.employeeId);
              const moduleAt = modules[l.currentModuleIndex];
              const pct = moduleCount > 0 ? (l.currentModuleIndex / moduleCount) * 100 : 0;
              return (
                <div key={l.employeeId} className="flex items-center gap-2.5" data-testid={`learner-flight-${l.employeeId}`}>
                  <div className={`h-6 w-6 rounded-full ${color} text-white text-[10px] font-semibold flex items-center justify-center shrink-0`} title={l.name}>
                    {l.initials}
                  </div>
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div className={`h-full ${color} opacity-80`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums w-14 text-right truncate" title={moduleAt?.title ?? "Done"}>
                    {moduleAt ? shortName(moduleAt.title) : "Done"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : assignedCount === 0 ? (
        <div className="mt-5 rounded-lg bg-muted/30 border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground" data-testid={`empty-learners-${course.id}`}>
          No learners enrolled yet
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-muted/30 border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
          {assignedCount} enrolled · waiting to start
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-muted-foreground hover:text-foreground justify-between pointer-events-none" tabIndex={-1}>
        <span>Walk the path</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function AdminTrainingHub() {
  const { toast } = useToast();
  const [view, setView] = useState<"grid" | "detail">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const thumbnailRef = useRef<HTMLInputElement>(null);

  // Course form state
  const [courseForm, setCourseForm] = useState({
    title: "", description: "", category: "", estimatedDuration: "",
    isRequired: false, publicLinkEnabled: false, certificateEnabled: true,
    thumbnailData: "",
  });

  // Module editing
  const [editingModule, setEditingModule] = useState<Partial<Module> | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const assetRef = useRef<HTMLInputElement>(null);

  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [editCourseForm, setEditCourseForm] = useState({ title: "", description: "", category: "", isRequired: false });
  const [includeQuiz, setIncludeQuiz] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const dragSrcRef = useRef<number | null>(null);
  const [dragVisualSrc, setDragVisualSrc] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [localModules, setLocalModules] = useState<any[] | null>(null);

  const { data: courses = [], isLoading } = useQuery<Course[]>({ queryKey: ["/api/training/courses"] });
  const { data: stats } = useQuery<{ totalCourses: number; totalAssigned: number; totalCompleted: number; totalPending: number }>({
    queryKey: ["/api/training/stats"],
  });
  const { data: detail, isLoading: detailLoading } = useQuery<CourseDetail>({
    queryKey: ["/api/training/courses", selectedId],
    enabled: !!selectedId,
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: assignDialog,
  });
  const { data: publicLearners = [] } = useQuery<PublicLearnerRow[]>({
    queryKey: ["/api/training/courses", selectedId, "public-learners"],
    enabled: !!selectedId,
  });
  const { data: courseQuiz } = useQuery<any>({
    queryKey: ["/api/training/courses", selectedId, "quiz"],
    enabled: !!selectedId && view === "detail",
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/training/courses", data);
      return res.json();
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/stats"] });
      setCreateOpen(false);
      setCreateStep(1);
      setCourseForm({ title: "", description: "", category: "", estimatedDuration: "", isRequired: false, publicLinkEnabled: false, certificateEnabled: true, thumbnailData: "" });
      if (includeQuiz && data.id) {
        await apiRequest("POST", `/api/training/courses/${data.id}/quiz`, { title: "Final Quiz", passingScore: 80 });
        queryClient.invalidateQueries({ queryKey: ["/api/training/courses", data.id, "quiz"] });
      }
      setIncludeQuiz(false);
      setSelectedId(data.id);
      setView("detail");
      toast({ title: "Course created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/training/courses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      toast({ title: "Course updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/training/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/stats"] });
      setView("grid");
      setSelectedId(null);
      setDeleteConfirm(null);
      toast({ title: "Course deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveModuleMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/training/courses/${selectedId}/modules/${data.id}`, data);
      }
      return apiRequest("POST", `/api/training/courses/${selectedId}/modules`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      setModuleDialogOpen(false);
      setEditingModule(null);
      toast({ title: "Module saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: (moduleId: string) => apiRequest("DELETE", `/api/training/courses/${selectedId}/modules/${moduleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      toast({ title: "Module deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: (employeeIds: string[]) =>
      apiRequest("POST", `/api/training/courses/${selectedId}/assign`, { employeeIds, sendEmailNotification }).then(r => r.json()),
    onSuccess: (data: { ok: boolean; newlyAssigned: number; emailsSent: number; emailsFailed: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/stats"] });
      setAssignDialog(false);
      if (sendEmailNotification && data.newlyAssigned > 0) {
        if (data.emailsFailed > 0 && data.emailsSent === 0) {
          toast({ title: "Training assigned successfully", description: "Email notifications could not be sent.", variant: "destructive" });
        } else if (data.emailsFailed > 0) {
          toast({ title: "Training assigned successfully", description: `Email sent to ${data.emailsSent} employee${data.emailsSent !== 1 ? "s" : ""}. ${data.emailsFailed} could not be sent.` });
        } else {
          toast({ title: "Training assigned successfully", description: `Email notification sent to ${data.emailsSent} employee${data.emailsSent !== 1 ? "s" : ""}.` });
        }
      } else {
        toast({ title: "Training assigned successfully" });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendReminderMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/training/courses/${selectedId}/send-reminder`, {}).then(r => r.json()),
    onSuccess: (data: { ok: boolean; incompleteCount: number; emailsSent: number; emailsFailed: number }) => {
      if (data.incompleteCount === 0) {
        toast({ title: "No reminders needed", description: "All assigned employees have completed this training." });
      } else if (data.emailsFailed > 0 && data.emailsSent === 0) {
        toast({ title: "Reminders could not be sent", description: "Check that employees have valid email addresses.", variant: "destructive" });
      } else if (data.emailsFailed > 0) {
        toast({ title: "Reminders sent", description: `Sent to ${data.emailsSent} employee${data.emailsSent !== 1 ? "s" : ""}. ${data.emailsFailed} could not be sent.` });
      } else {
        toast({ title: "Reminders sent", description: `Reminder email sent to ${data.emailsSent} incomplete employee${data.emailsSent !== 1 ? "s" : ""}.` });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      apiRequest("PATCH", `/api/training/courses/${id}`, { isPublished: publish }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
    },
  });

  const createQuizMutation = useMutation({
    mutationFn: (courseId: string) => apiRequest("POST", `/api/training/courses/${courseId}/quiz`, { title: "Final Quiz", passingScore: 80 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId, "quiz"] });
      toast({ title: "Quiz created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => apiRequest("DELETE", `/api/training/quizzes/${quizId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId, "quiz"] });
      toast({ title: "Quiz removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addQuestionMutation = useMutation({
    mutationFn: (q: any) => apiRequest("POST", `/api/training/quizzes/${courseQuiz?.id}/questions`, {
      questionText: q.questionText,
      questionType: "multiple_choice",
      options: q.options,
      correctAnswer: q.options[q.correctAnswer],
      sortOrder: courseQuiz?.questions?.length ?? 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId, "quiz"] });
      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      toast({ title: "Question added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (q: any) => apiRequest("PUT", `/api/training/quiz-questions/${q.id}`, {
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.options[q.correctAnswer],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId, "quiz"] });
      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      toast({ title: "Question saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => apiRequest("DELETE", `/api/training/quiz-questions/${questionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId, "quiz"] });
      toast({ title: "Question deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reorderModulesMutation = useMutation({
    mutationFn: (order: string[]) => apiRequest("PATCH", `/api/training/courses/${selectedId}/modules/reorder`, { order }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses", selectedId] });
      setLocalModules(null);
      toast({ title: "Module order updated" });
    },
    onError: (e: any) => {
      setLocalModules(null);
      toast({ title: "Could not update module order. Please try again.", description: e.message, variant: "destructive" });
    },
  });

  const applyReorder = (srcIdx: number, dstIdx: number) => {
    const source = localModules ?? (detail?.modules ?? []);
    const mods = [...source];
    const [moved] = mods.splice(srcIdx, 1);
    mods.splice(dstIdx, 0, moved);
    setLocalModules(mods);
    reorderModulesMutation.mutate(mods.map((m: any) => m.id));
  };

  const moveModule = (idx: number, dir: -1 | 1) => {
    const source = localModules ?? (detail?.modules ?? []);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= source.length) return;
    applyReorder(idx, newIdx);
  };

  const displayModules = useMemo(
    () => localModules ?? (detail?.modules ?? []),
    [localModules, detail?.modules]
  );

  const handleThumbnail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCourseForm(f => ({ ...f, thumbnailData: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAssetUploading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      setEditingModule(m => ({
        ...m,
        assets: [...(m?.assets ?? []), { id: `new_${Date.now()}`, assetData: data, assetType: "image", sortOrder: (m?.assets?.length ?? 0) }],
      }));
      setAssetUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const getPublicLink = (publicId: string) => `${window.location.origin}/training/public/${publicId}`;

  const filtered = courses.filter(c => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== "All" && c.category !== filterCategory) return false;
    if (filterStatus === "Published" && !c.isPublished) return false;
    if (filterStatus === "Draft" && c.isPublished) return false;
    if (filterStatus === "Required" && !c.isRequired) return false;
    return true;
  });

  const course = detail?.course;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground leading-tight break-words">Training Hub</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create courses, assign employees, track completions</p>
        </div>
        {view === "grid" && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 w-full sm:w-auto sm:flex-shrink-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAiWizardOpen(true)} data-testid="btn-create-course-ai">
              <Sparkles className="w-4 h-4 mr-1" /> Generate with AI
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => { setCreateOpen(true); setCreateStep(1); }} data-testid="btn-create-course">
              <Plus className="w-4 h-4 mr-1" /> Create Course
            </Button>
          </div>
        )}
        {view === "detail" && (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setView("grid"); setSelectedId(null); }} data-testid="btn-back-courses">
            ← All Courses
          </Button>
        )}
      </div>

      {/* Stats */}
      {view === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Courses", value: stats?.totalCourses ?? courses.length, icon: BookOpen, color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
            { label: "Employees Assigned", value: stats?.totalAssigned ?? 0, icon: Users, color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
            { label: "Completions", value: stats?.totalCompleted ?? 0, icon: Trophy, color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
            { label: "In Progress", value: stats?.totalPending ?? 0, icon: Clock, color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold text-foreground leading-tight">{s.value}</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground leading-tight truncate">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {view === "grid" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
            <div className="relative w-full sm:flex-1 sm:min-w-48">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 h-9 w-full" placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-courses" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 w-full sm:w-auto">
              <select
                className="h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground w-full sm:w-auto min-w-0"
                value={filterCategory} onChange={e => setFilterCategory(e.target.value)} data-testid="select-filter-category">
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground w-full sm:w-auto min-w-0"
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)} data-testid="select-filter-status">
                <option value="All">All Status</option>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Required">Required</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4 text-center border border-dashed border-border rounded-xl">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-base font-semibold text-foreground mb-1">No courses yet</p>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">Build your first training course with YouTube videos, text lessons, and quizzes.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
                <Button className="w-full" onClick={() => setAiWizardOpen(true)} data-testid="btn-create-course-ai-empty">
                  <Sparkles className="w-4 h-4 mr-1" /> Generate with AI
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setCreateOpen(true)} data-testid="btn-create-course-empty">
                  <Plus className="w-4 h-4 mr-1" /> Create Manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {filtered.map(c => (
                <CourseCard key={c.id} course={c} onClick={() => { setSelectedId(c.id); setView("detail"); }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETAIL VIEW ── */}
      {view === "detail" && selectedId && (
        <div className="space-y-6">
          {detailLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !detail || !course ? (
            <p className="text-center text-muted-foreground py-20">Course not found</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: course info + modules */}
              <div className="xl:col-span-2 space-y-4">
                {/* Course header */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold text-foreground">{course.title}</h2>
                        {course.isPublished
                          ? <Badge className="bg-green-500 text-white text-xs">Published</Badge>
                          : <Badge variant="secondary" className="text-xs">Draft</Badge>}
                        {course.isRequired && <Badge className="bg-red-500 text-white text-xs">Required</Badge>}
                      </div>
                      {course.description && <p className="text-sm text-muted-foreground mb-2">{course.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {course.category && <span className="bg-muted px-2 py-0.5 rounded-full">{course.category}</span>}
                        {course.estimatedDuration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.estimatedDuration}</span>}
                        {course.certificateEnabled && <span className="flex items-center gap-1 text-amber-600"><Award className="w-3 h-3" />Certificate</span>}
                        {course.publicLinkEnabled && course.publicId && <span className="flex items-center gap-1 text-blue-600"><Globe className="w-3 h-3" />Public Link</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant={course.isPublished ? "outline" : "default"}
                        size="sm"
                        onClick={() => publishMutation.mutate({ id: course.id, publish: !course.isPublished })}
                        disabled={publishMutation.isPending}
                        data-testid="btn-toggle-publish">
                        {course.isPublished ? <><EyeOff className="w-3.5 h-3.5 mr-1" />Unpublish</> : <><Eye className="w-3.5 h-3.5 mr-1" />Publish</>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setAssignDialog(true)} data-testid="btn-assign-employees">
                        <Users className="w-3.5 h-3.5 mr-1" /> Assign
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => sendReminderMutation.mutate()} disabled={sendReminderMutation.isPending} data-testid="btn-send-reminder">
                        {sendReminderMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                        Send Reminder
                      </Button>
                      {course.publicLinkEnabled && course.publicId ? (
                        <Button variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(getPublicLink(course.publicId!));
                          toast({ title: "Link copied!" });
                        }} data-testid="btn-copy-public-link">
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm"
                          onClick={() => updateCourseMutation.mutate({ id: course.id, data: { publicLinkEnabled: true } })}
                          disabled={updateCourseMutation.isPending}
                          data-testid="btn-enable-public-link">
                          <Globe className="w-3.5 h-3.5 mr-1" /> Enable Public Link
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditCourseForm({
                          title: course.title,
                          description: course.description ?? "",
                          category: course.category ?? "",
                          isRequired: course.isRequired ?? false,
                        });
                        setEditCourseOpen(true);
                      }} data-testid="btn-edit-course-info">
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Info
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => setDeleteConfirm(course.id)} data-testid="btn-delete-course">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Live activity pulse */}
                <LiveActivityPulse
                  completions={detail.completions}
                  onManage={() => {
                    const el = document.querySelector('[data-testid="cohort-roster"], [data-testid="card-cohort-roster"]');
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />

                {/* Modules */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">Modules ({detail.modules.length})</h3>
                    <Button size="sm" onClick={() => { setEditingModule({ sortOrder: detail.modules.length, isRequired: true, assets: [] }); setModuleDialogOpen(true); }} data-testid="btn-add-module">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Module
                    </Button>
                  </div>
                  {detail.modules.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border rounded-lg">
                      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">No modules yet. Add your first module.</p>
                      <Button size="sm" variant="outline" onClick={() => { setEditingModule({ sortOrder: 0, isRequired: true, assets: [] }); setModuleDialogOpen(true); }}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Module
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {displayModules.map((mod: any, i: number) => (
                        <div
                          key={mod.id}
                          draggable
                          onDragStart={() => { dragSrcRef.current = i; setDragVisualSrc(i); }}
                          onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                          onDrop={e => {
                            e.preventDefault();
                            const src = dragSrcRef.current;
                            dragSrcRef.current = null;
                            setDragVisualSrc(null);
                            setDragOverIdx(null);
                            if (src === null || src === i) return;
                            applyReorder(src, i);
                          }}
                          onDragEnd={() => { dragSrcRef.current = null; setDragVisualSrc(null); setDragOverIdx(null); }}
                          className={`flex items-center gap-2 p-3 border rounded-lg transition-all select-none ${
                            dragVisualSrc === i ? "opacity-40 border-border" :
                            dragOverIdx === i && dragVisualSrc !== i ? "border-primary bg-primary/5" :
                            "border-border hover:bg-muted/30"
                          }`}
                          data-testid={`row-module-${mod.id}`}>
                          {/* Drag handle */}
                          <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0 touch-none" data-testid={`drag-handle-${mod.id}`}>
                            <GripVertical className="w-4 h-4" />
                          </div>
                          {/* Position number */}
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{i + 1}</div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">{mod.title}</span>
                              {mod.isRequired && <Badge variant="outline" className="text-xs h-4">Required</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {mod.youtubeEmbedId && <span className="flex items-center gap-1"><Play className="w-3 h-3 text-red-500" />Video</span>}
                              {mod.lessonText && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />Lesson</span>}
                              {(mod.assets?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Image className="w-3 h-3" />{mod.assets?.length} images</span>}
                            </div>
                          </div>
                          {/* Move up/down (mobile-friendly) */}
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <Button
                              variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => moveModule(i, -1)}
                              disabled={i === 0 || reorderModulesMutation.isPending}
                              data-testid={`btn-move-up-${mod.id}`}>
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => moveModule(i, 1)}
                              disabled={i === displayModules.length - 1 || reorderModulesMutation.isPending}
                              data-testid={`btn-move-down-${mod.id}`}>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </div>
                          {/* Edit / Delete */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingModule(mod); setModuleDialogOpen(true); }} data-testid={`btn-edit-module-${mod.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteModuleMutation.mutate(mod.id)} data-testid={`btn-delete-module-${mod.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                {/* Quiz Section */}
                {courseQuiz ? (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-foreground">Final Quiz</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {courseQuiz.questions?.length ?? 0} question{(courseQuiz.questions?.length ?? 0) === 1 ? "" : "s"} · {courseQuiz.passingScore ?? 80}% to pass
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => {
                          setEditingQuestion({ questionText: "", options: ["", "", "", ""], correctAnswer: 0 });
                          setQuestionDialogOpen(true);
                        }} data-testid="btn-add-question">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => deleteQuizMutation.mutate(courseQuiz.id)}
                          disabled={deleteQuizMutation.isPending}
                          data-testid="btn-delete-quiz">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {(courseQuiz.questions?.length ?? 0) === 0 ? (
                      <div className="text-center py-6 border border-dashed border-border rounded-lg">
                        <CheckCircle2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">No questions yet. Add your first question.</p>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingQuestion({ questionText: "", options: ["", "", "", ""], correctAnswer: 0 });
                          setQuestionDialogOpen(true);
                        }}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {courseQuiz.questions.map((q: any, i: number) => {
                          const options: string[] = q.optionsJson ? JSON.parse(q.optionsJson) : [];
                          const correctVal = q.correctAnswerJson ? JSON.parse(q.correctAnswerJson) : 0;
                          const correctIdx = typeof correctVal === "number" ? correctVal : options.indexOf(correctVal);
                          return (
                            <div key={q.id} className="p-3 border border-border rounded-lg" data-testid={`row-question-${q.id}`}>
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{q.questionText}</p>
                                  {options.length > 0 && (
                                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                                      {options.map((opt: string, oi: number) => (
                                        <div key={oi} className={`text-xs px-2 py-1 rounded ${oi === correctIdx ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted text-muted-foreground"}`}>
                                          {String.fromCharCode(65 + oi)}. {opt}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                                    const opts: string[] = q.optionsJson ? JSON.parse(q.optionsJson) : ["", "", "", ""];
                                    const cVal = q.correctAnswerJson ? JSON.parse(q.correctAnswerJson) : 0;
                                    const cIdx = typeof cVal === "number" ? cVal : opts.indexOf(cVal);
                                    setEditingQuestion({ id: q.id, questionText: q.questionText, options: opts.length < 2 ? ["", "", "", ""] : opts, correctAnswer: cIdx });
                                    setQuestionDialogOpen(true);
                                  }} data-testid={`btn-edit-question-${q.id}`}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => deleteQuestionMutation.mutate(q.id)}
                                    disabled={deleteQuestionMutation.isPending}
                                    data-testid={`btn-delete-question-${q.id}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center pt-1">
                    <Button variant="outline" onClick={() => createQuizMutation.mutate(selectedId!)} disabled={createQuizMutation.isPending} data-testid="btn-add-quiz">
                      {createQuizMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                      Add Quiz
                    </Button>
                  </div>
                )}
              </div>

              {/* Right: cohort roster + public learners */}
              <div className="space-y-4">
                <CohortRoster
                  learners={detail.assignments.map((a: any) => {
                    const completedModules = new Set(
                      detail.completions
                        .filter(c => c.employeeId === a.employeeId)
                        .map(c => c.moduleId)
                    ).size;
                    const total = detail.modules.length;
                    const pct = total > 0 ? Math.round((completedModules / total) * 100) : 0;
                    return {
                      id: a.employeeId ?? a.id,
                      name: a.employeeName ?? "Unknown",
                      role: "",
                      progress: pct,
                      initials: initialsFromName(a.employeeName ?? ""),
                      color: colorHexForLearner(a.employeeId ?? a.id),
                    };
                  })}
                  totalAssigned={detail.stats.assigned}
                  totalModules={detail.modules.length}
                  onAssign={() => setAssignDialog(true)}
                />

                {/* Public Link Learners */}
                {course.publicLinkEnabled && (
                  <PublicLearnersRoster
                    learners={publicLearners}
                    publicLink={course.publicId ? getPublicLink(course.publicId) : null}
                    onCopy={() => {
                      if (!course.publicId) return;
                      navigator.clipboard.writeText(getPublicLink(course.publicId));
                      toast({ title: "Link copied!" });
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI WIZARD ── */}
      <TrainingAIWizard
        open={aiWizardOpen}
        onOpenChange={setAiWizardOpen}
        onCreated={(courseId) => { setSelectedId(courseId); setView("detail"); }}
      />

      {/* ── CREATE COURSE DIALOG ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-create-course">
          <DialogHeader>
            <DialogTitle>
              {createStep === 1 ? "Course Details" : createStep === 2 ? "Settings & Options" : "Review & Create"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Step indicator */}
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= createStep ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>

            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>Course Title <span className="text-destructive">*</span></Label>
                  <Input className="mt-1" placeholder="e.g. How to Mop Properly" value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} data-testid="input-course-title" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea className="mt-1" rows={3} placeholder="What will employees learn?" value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} data-testid="input-course-description" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <select className="mt-1 w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground" value={courseForm.category} onChange={e => setCourseForm(f => ({ ...f, category: e.target.value }))} data-testid="select-course-category">
                      <option value="">Select...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Estimated Duration</Label>
                    <Input className="mt-1" placeholder="e.g. 30 min" value={courseForm.estimatedDuration} onChange={e => setCourseForm(f => ({ ...f, estimatedDuration: e.target.value }))} data-testid="input-course-duration" />
                  </div>
                </div>
                <div>
                  <Label>Thumbnail (optional)</Label>
                  <div className="mt-1">
                    {courseForm.thumbnailData ? (
                      <div className="relative w-full h-28 rounded-lg overflow-hidden border border-border">
                        <img src={courseForm.thumbnailData} alt="" className="w-full h-full object-cover" />
                        <Button variant="ghost" size="sm" className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white h-6 w-6 p-0" onClick={() => setCourseForm(f => ({ ...f, thumbnailData: "" }))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="w-full h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors">
                        <input ref={thumbnailRef} type="file" accept="image/*" className="sr-only" onChange={handleThumbnail} />
                        <div className="text-center">
                          <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                          <span className="text-xs text-muted-foreground">Click to upload thumbnail</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-foreground">Required Course</div>
                    <div className="text-xs text-muted-foreground">Employees must complete this course</div>
                  </div>
                  <Switch checked={courseForm.isRequired} onCheckedChange={v => setCourseForm(f => ({ ...f, isRequired: v }))} data-testid="switch-required" />
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-foreground">Issue Certificate</div>
                    <div className="text-xs text-muted-foreground">Generate completion certificate</div>
                  </div>
                  <Switch checked={courseForm.certificateEnabled} onCheckedChange={v => setCourseForm(f => ({ ...f, certificateEnabled: v }))} data-testid="switch-certificate" />
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-foreground">Enable Public Link</div>
                    <div className="text-xs text-muted-foreground">Allow non-employees to access via link</div>
                  </div>
                  <Switch checked={courseForm.publicLinkEnabled} onCheckedChange={v => setCourseForm(f => ({ ...f, publicLinkEnabled: v }))} data-testid="switch-public-link" />
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-foreground">Include Quiz at End</div>
                    <div className="text-xs text-muted-foreground">Auto-create a quiz after the last module</div>
                  </div>
                  <Switch checked={includeQuiz} onCheckedChange={v => setIncludeQuiz(v)} data-testid="switch-include-quiz" />
                </div>
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Review your course before creating it. You can add modules and assign employees after creation.</p>
                <div className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Title</span><span className="font-medium">{courseForm.title}</span>
                  </div>
                  {courseForm.category && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Category</span><span>{courseForm.category}</span></div>}
                  {courseForm.estimatedDuration && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Duration</span><span>{courseForm.estimatedDuration}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Required</span><span>{courseForm.isRequired ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Certificate</span><span>{courseForm.certificateEnabled ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Public Link</span><span>{courseForm.publicLinkEnabled ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Quiz</span><span>{includeQuiz ? "Yes — auto-created" : "No"}</span></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={() => createStep > 1 ? setCreateStep(s => s - 1) : setCreateOpen(false)}>
                {createStep > 1 ? "Back" : "Cancel"}
              </Button>
              {createStep < 3 ? (
                <Button size="sm" onClick={() => setCreateStep(s => s + 1)} disabled={createStep === 1 && !courseForm.title.trim()} data-testid="btn-next-step">
                  Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => createCourseMutation.mutate(courseForm)} disabled={createCourseMutation.isPending} data-testid="btn-create-course-confirm">
                  {createCourseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Create Course
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT COURSE INFO DIALOG ── */}
      <Dialog open={editCourseOpen} onOpenChange={setEditCourseOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-edit-course-info">
          <DialogHeader>
            <DialogTitle>Edit Course Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Course Title <span className="text-destructive">*</span></Label>
              <Input className="mt-1" value={editCourseForm.title} onChange={e => setEditCourseForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-course-title" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" rows={3} placeholder="What will employees learn?" value={editCourseForm.description} onChange={e => setEditCourseForm(f => ({ ...f, description: e.target.value }))} data-testid="input-edit-course-description" />
            </div>
            <div>
              <Label>Category</Label>
              <select className="mt-1 w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground" value={editCourseForm.category} onChange={e => setEditCourseForm(f => ({ ...f, category: e.target.value }))} data-testid="select-edit-course-category">
                <option value="">No Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="text-sm font-medium text-foreground">Required Course</div>
                <div className="text-xs text-muted-foreground">Employees must complete this course</div>
              </div>
              <Switch checked={editCourseForm.isRequired} onCheckedChange={v => setEditCourseForm(f => ({ ...f, isRequired: v }))} data-testid="switch-edit-required" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCourseOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!course || !editCourseForm.title.trim()) return;
                updateCourseMutation.mutate({
                  id: course.id,
                  data: {
                    title: editCourseForm.title.trim(),
                    description: editCourseForm.description.trim() || null,
                    category: editCourseForm.category || null,
                    isRequired: editCourseForm.isRequired,
                  },
                });
                setEditCourseOpen(false);
              }}
              disabled={!editCourseForm.title.trim() || updateCourseMutation.isPending}
              data-testid="btn-save-course-info">
              {updateCourseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── QUESTION EDITOR DIALOG ── */}
      <Dialog open={questionDialogOpen} onOpenChange={v => { setQuestionDialogOpen(v); if (!v) setEditingQuestion(null); }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-question">
          <DialogHeader>
            <DialogTitle>{editingQuestion?.id ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Question <span className="text-destructive">*</span></Label>
                <Textarea className="mt-1" rows={2} placeholder="Enter your question..." value={editingQuestion.questionText ?? ""} onChange={e => setEditingQuestion((q: any) => ({ ...q, questionText: e.target.value }))} data-testid="input-question-text" />
              </div>
              <div>
                <Label>Answer Options</Label>
                <p className="text-xs text-muted-foreground mb-2">Click the circle to mark the correct answer.</p>
                <div className="space-y-2">
                  {(editingQuestion.options ?? ["", "", "", ""]).map((opt: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingQuestion((q: any) => ({ ...q, correctAnswer: i }))}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${editingQuestion.correctAnswer === i ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground hover:border-primary"}`}
                        data-testid={`radio-correct-${i}`}>
                        {editingQuestion.correctAnswer === i && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className="w-5 text-xs font-medium text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                      <Input
                        className="flex-1 h-8 text-sm"
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={e => {
                          const newOpts = [...(editingQuestion.options ?? ["", "", "", ""])];
                          newOpts[i] = e.target.value;
                          setEditingQuestion((q: any) => ({ ...q, options: newOpts }));
                        }}
                        data-testid={`input-option-${i}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuestionDialogOpen(false); setEditingQuestion(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingQuestion?.id) {
                  updateQuestionMutation.mutate(editingQuestion);
                } else {
                  addQuestionMutation.mutate(editingQuestion);
                }
              }}
              disabled={
                !editingQuestion?.questionText?.trim() ||
                (editingQuestion?.options ?? []).filter((o: string) => o.trim()).length < 2 ||
                addQuestionMutation.isPending ||
                updateQuestionMutation.isPending
              }
              data-testid="btn-save-question">
              {(addQuestionMutation.isPending || updateQuestionMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODULE DIALOG ── */}
      <Dialog open={moduleDialogOpen} onOpenChange={v => { setModuleDialogOpen(v); if (!v) setEditingModule(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-module">
          <DialogHeader>
            <DialogTitle>{editingModule?.id ? "Edit Module" : "Add Module"}</DialogTitle>
          </DialogHeader>
          {editingModule && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Module Title <span className="text-destructive">*</span></Label>
                <Input className="mt-1" placeholder="e.g. Proper Mopping Technique" value={editingModule.title ?? ""} onChange={e => setEditingModule(m => ({ ...m, title: e.target.value }))} data-testid="input-module-title" />
              </div>
              <div>
                <Label>Description</Label>
                <Input className="mt-1" placeholder="Brief module description" value={editingModule.description ?? ""} onChange={e => setEditingModule(m => ({ ...m, description: e.target.value }))} data-testid="input-module-description" />
              </div>

              {/* YouTube */}
              <div>
                <Label>YouTube Video URL (optional)</Label>
                <Input
                  className="mt-1"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={editingModule.youtubeUrl ?? ""}
                  onChange={e => {
                    const url = e.target.value;
                    const embedId = parseYoutubeId(url);
                    setEditingModule(m => ({ ...m, youtubeUrl: url, youtubeEmbedId: embedId ?? undefined }));
                  }}
                  data-testid="input-youtube-url"
                />
                {editingModule.youtubeEmbedId && (
                  <div className="mt-2 aspect-video rounded-lg overflow-hidden border border-border bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${editingModule.youtubeEmbedId}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>

              {/* Lesson Blocks (replaces flat lessonText + assets). Legacy
                  lessonText/assets are still rendered for older modules via
                  the public/employee viewers, but new content uses blocks. */}
              {editingModule.id ? (
                <AdminBlockEditor
                  moduleId={editingModule.id}
                  moduleTitle={editingModule.title ?? ""}
                  courseTitle={detail?.course?.title}
                  courseDescription={detail?.course?.description}
                />
              ) : (
                <div className="border border-dashed border-border rounded-lg p-4 text-sm text-muted-foreground text-center">
                  Save the module first to add lesson blocks (text, images, checklists, steps, AI-generated content, and more).
                </div>
              )}

              {/* Legacy lesson text — still editable for backwards compat */}
              {(editingModule.lessonText ?? "").trim() && (
                <details className="border border-border rounded-lg p-3">
                  <summary className="text-sm font-medium cursor-pointer">Legacy lesson text (deprecated)</summary>
                  <Textarea className="mt-2" rows={4} value={editingModule.lessonText ?? ""} onChange={e => setEditingModule(m => ({ ...m, lessonText: e.target.value }))} data-testid="input-lesson-text" />
                  <p className="text-[11px] text-muted-foreground mt-1">This is shown only when no blocks exist. New content should use blocks.</p>
                </details>
              )}

              <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                <Switch checked={editingModule.isRequired ?? true} onCheckedChange={v => setEditingModule(m => ({ ...m, isRequired: v }))} data-testid="switch-module-required" />
                <Label className="cursor-pointer">Required module (must complete to finish course)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModuleDialogOpen(false); setEditingModule(null); }}>Cancel</Button>
            <Button
              onClick={() => saveModuleMutation.mutate(editingModule)}
              disabled={!editingModule?.title?.trim() || saveModuleMutation.isPending}
              data-testid="btn-save-module">
              {saveModuleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN DIALOG ── */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="sm:max-w-md max-h-[80vh]" data-testid="dialog-assign">
          <DialogHeader>
            <DialogTitle>Assign Employees</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-96 space-y-2 py-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              if (selectedEmployees.size === employees.length) setSelectedEmployees(new Set());
              else setSelectedEmployees(new Set(employees.map(e => e.id)));
            }}>
              {selectedEmployees.size === employees.length ? "Deselect All" : "Select All"}
            </Button>
            {employees.map(emp => (
              <label key={emp.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedEmployees.has(emp.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`} data-testid={`checkbox-employee-${emp.id}`}>
                <input type="checkbox" className="sr-only" checked={selectedEmployees.has(emp.id)} onChange={e => {
                  const s = new Set(selectedEmployees);
                  if (e.target.checked) s.add(emp.id); else s.delete(emp.id);
                  setSelectedEmployees(s);
                }} />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedEmployees.has(emp.id) ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {selectedEmployees.has(emp.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="text-sm font-medium">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-muted-foreground">{emp.position ?? emp.email}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="border-t pt-3 pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="checkbox-send-email-notification">
              <input
                type="checkbox"
                checked={sendEmailNotification}
                onChange={e => setSendEmailNotification(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${sendEmailNotification ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                {sendEmailNotification && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <span className="text-sm font-medium">Send email notification to assigned employees</span>
                <p className="text-xs text-muted-foreground">Employees will receive an email with instructions to complete this training.</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={() => assignMutation.mutate([...selectedEmployees])} disabled={selectedEmployees.size === 0 || assignMutation.isPending} data-testid="btn-confirm-assign">
              {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Assign {selectedEmployees.size > 0 ? `(${selectedEmployees.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Course</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the course, all modules, assignments, and completion records. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteCourseMutation.mutate(deleteConfirm)} disabled={deleteCourseMutation.isPending} data-testid="btn-confirm-delete">
              {deleteCourseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
