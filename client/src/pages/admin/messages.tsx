import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Search, ChevronLeft, Send, Users, User,
  Building2, Clock, AlertCircle, Filter,
  Phone, Mail, UserPlus, Calendar, FileText, X,
  CheckCircle2, Circle, Inbox, ArchiveX, IdCard
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Category = "all" | "clients" | "team" | "assigned" | "archived";

interface CategoryDef {
  key: Category;
  label: string;
  icon: React.ElementType;
}

const CATEGORIES: CategoryDef[] = [
  { key: "all",      label: "All",      icon: Inbox },
  { key: "clients",  label: "Clients",  icon: Building2 },
  { key: "team",     label: "Team",     icon: IdCard },
  { key: "assigned", label: "Assigned", icon: Users },
  { key: "archived", label: "Archived", icon: ArchiveX },
];

const STATUS_COLORS: Record<string, string> = {
  new:         "bg-blue-100 text-blue-700",
  open:        "bg-blue-100 text-blue-700",
  in_review:   "bg-amber-100 text-amber-700",
  in_progress: "bg-amber-100 text-amber-700",
  replied:     "bg-emerald-100 text-emerald-700",
  scheduled:   "bg-purple-100 text-purple-700",
  resolved:    "bg-gray-100 text-gray-500",
  closed:      "bg-gray-100 text-gray-500",
  pending:     "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New", open: "Open", in_review: "In Review",
  in_progress: "In Progress", replied: "Replied",
  scheduled: "Scheduled", resolved: "Resolved",
  closed: "Closed", pending: "Pending",
};

const QUICK_REPLIES = [
  "Reschedule",
  "Price inquiry",
  "Scheduling inquiry",
  "We'll be in touch shortly",
  "Can you send more details?",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_PALETTE = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-600",
  "bg-rose-500", "bg-cyan-600", "bg-indigo-500", "bg-orange-500", "bg-teal-500",
];
function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + h * 31;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminMessages() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [category, setCategory]     = useState<Category>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [replyText, setReplyText]   = useState("");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  const threadEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: requests = [], isLoading: reqLoading, isError: reqError } = useQuery<any[]>({
    queryKey: ["/api/client-requests"],
    staleTime: 30_000,
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    staleTime: 60_000,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    staleTime: 60_000,
  });

  const {
    data: thread = [],
    isLoading: threadLoading,
    isError: threadError,
  } = useQuery<any[]>({
    queryKey: ["/api/client-requests", selectedId, "messages"],
    enabled: !!selectedId,
    staleTime: 30_000,
    retry: 1,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const replyMut = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/client-requests/${selectedId}/messages`, {
        body,
        photos: [],
        isVisibleToClient: true,
        isVisibleToEmployee: true,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests", selectedId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      setReplyText("");
      toast({ title: "Reply sent" });
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/client-requests/${id}/mark-admin-read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] }),
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const clientMap = new Map((clients as any[]).map(c => [c.id, c]));
  const empMap    = new Map((employees as any[]).map(e => [e.id, e]));

  function getContactName(req: any): string {
    if (req.createdByRole === "client" && req.clientId) {
      return clientMap.get(req.clientId)?.name || "Client";
    }
    if ((req.createdByRole === "employee" || req.createdByRole === "admin") && req.employeeId) {
      const e = empMap.get(req.employeeId);
      return e ? `${e.firstName} ${e.lastName}` : req.createdByRole === "employee" ? "Employee" : "Cleaner";
    }
    return req.title || "Unknown";
  }

  function getContactLabel(req: any): string {
    if (req.createdByRole === "client")   return "Client";
    if (req.createdByRole === "employee") return "Employee";
    if (req.createdByRole === "admin")    return "Assigned to Cleaner";
    return titleCase(req.requestType || "Request");
  }

  const isArchived = (r: any) => ["resolved", "closed"].includes(r.status);
  const isUnread   = (r: any) => r.createdByRole === "admin" && r.status === "replied" && !r.adminReadReplyAt;

  function categorize(reqs: any[], cat: Category): any[] {
    const active = reqs.filter(r => !isArchived(r));
    switch (cat) {
      case "clients":  return active.filter(r => r.createdByRole === "client");
      case "team":     return active.filter(r => r.createdByRole === "employee");
      case "assigned": return active.filter(r => r.createdByRole === "admin");
      case "archived": return reqs.filter(r => isArchived(r));
      default:         return active;
    }
  }

  const counts = Object.fromEntries(
    CATEGORIES.map(c => [c.key, categorize(requests as any[], c.key).length])
  ) as Record<Category, number>;

  const unreadCount = (requests as any[]).filter(isUnread).length;

  const displayList = categorize(requests as any[], category)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        getContactName(r).toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
    );

  const selectedReq = (requests as any[]).find(r => r.id === selectedId) || null;

  // ── Auto-scroll thread ────────────────────────────────────────────────────
  useEffect(() => {
    if (!threadLoading) {
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [thread, threadLoading]);

  // ── Interaction handlers ──────────────────────────────────────────────────
  function selectConversation(req: any) {
    setSelectedId(req.id);
    setMobileView("thread");
    setReplyText("");
    if (isUnread(req)) markReadMut.mutate(req.id);
  }

  function sendReply() {
    if (!replyText.trim() || !selectedId || replyMut.isPending) return;
    replyMut.mutate(replyText.trim());
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" data-testid="messages-page">

      {/* ── Col 1: Category Sidebar — desktop only ─────────────────────────── */}
      <aside className="hidden md:flex w-[196px] xl:w-[216px] flex-col shrink-0 bg-[#f8f9fa] border-r border-[#e5e7eb]">
        <div className="px-4 py-4 border-b border-[#ececec]">
          <h1 className="text-[14.5px] font-bold text-[#111827] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary shrink-0" />
            Messages
            {unreadCount > 0 && (
              <span className="ml-auto text-[11px] font-semibold bg-primary text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </h1>
        </div>

        <nav className="flex-1 py-2 px-2">
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const active = category === key;
            const count  = counts[key];
            return (
              <button
                key={key}
                onClick={() => setCategory(key)}
                data-testid={`cat-${key}`}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[13px] font-medium transition-colors mb-0.5",
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-[#374151] hover:bg-[#eef0f3]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", active ? "text-white/90" : "text-[#9ca3af]")} />
                  {label}
                </div>
                {count > 0 && (
                  <span className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0",
                    active ? "bg-white/20 text-white" : "bg-[#e5e7eb] text-[#4b5563]"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Col 2: Conversation List ────────────────────────────────────────── */}
      <div className={cn(
        "flex flex-col bg-white border-r border-[#e5e7eb] shrink-0",
        "w-full md:w-[296px] xl:w-[332px]",
        mobileView === "thread" ? "hidden md:flex" : "flex"
      )}>
        {/* Search bar */}
        <div className="px-3 py-3 border-b border-[#f0f0f0] shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af] pointer-events-none" />
            <input
              type="text"
              placeholder="Search messages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-messages-search"
              className="w-full h-8 pl-8 pr-3 rounded-[7px] bg-[#f3f4f6] text-[13px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-white border border-transparent focus:border-primary/30 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile category pills */}
        <div className="flex md:hidden gap-1.5 overflow-x-auto px-3 py-2 border-b border-[#f0f0f0] shrink-0 scrollbar-hide">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors",
                category === key
                  ? "bg-primary text-white"
                  : "bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb]"
              )}
            >
              {label}{counts[key] > 0 ? ` · ${counts[key]}` : ""}
            </button>
          ))}
        </div>

        {/* Category label (desktop) */}
        <div className="hidden md:flex items-center justify-between px-3 py-2 border-b border-[#f0f0f0] shrink-0">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9ca3af]">
            {CATEGORIES.find(c => c.key === category)?.label || "All"} · {displayList.length}
          </span>
          {search && (
            <button onClick={() => setSearch("")} className="text-[11.5px] text-primary hover:underline">Clear</button>
          )}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {reqLoading ? (
            <div className="p-3 space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex gap-3 p-2">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : reqError ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
              <p className="text-[13px] font-medium text-[#374151]">Couldn't load messages</p>
              <p className="text-[12px] text-[#9ca3af] mt-1">Please refresh the page to try again.</p>
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f3f4f6] flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-[#d1d5db]" />
              </div>
              <p className="text-[13.5px] font-medium text-[#374151] mb-1">
                {search ? "No results" : "No messages"}
              </p>
              <p className="text-[12.5px] text-[#9ca3af] leading-relaxed">
                {search
                  ? "Try a different search term."
                  : category === "archived"
                    ? "No archived conversations yet."
                    : "When clients, employees, or requests come in, they'll appear here."}
              </p>
            </div>
          ) : (
            displayList.map(req => {
              const name      = getContactName(req);
              const label     = getContactLabel(req);
              const isSelected = selectedId === req.id;
              const unread    = isUnread(req);
              const initials  = getInitials(name);
              const color     = avatarColor(name);
              const preview   = req.description || req.title || "No message preview";
              const time      = formatTime(req.updatedAt || req.createdAt);

              return (
                <button
                  key={req.id}
                  onClick={() => selectConversation(req)}
                  data-testid={`convo-${req.id}`}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-[#f5f5f5]",
                    isSelected
                      ? "bg-[#eff6ff] border-l-[3px] border-l-primary"
                      : cn("border-l-[3px] border-l-transparent hover:bg-[#fafafa]", unread && "bg-blue-50/40")
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold text-white mt-0.5",
                    color
                  )}>
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                      <span className={cn(
                        "text-[13.5px] truncate",
                        unread ? "font-semibold text-[#111827]" : "font-medium text-[#374151]"
                      )}>
                        {name}
                      </span>
                      <span className="text-[11px] text-[#9ca3af] shrink-0">{time}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11.5px] text-[#9ca3af] font-medium">{label}</span>
                      {unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-[12.5px] text-[#6b7280] line-clamp-1">{preview}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Col 3: Conversation Thread ──────────────────────────────────────── */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden",
        mobileView === "list" ? "hidden md:flex" : "flex"
      )}>

        {!selectedReq ? (
          /* Empty state (desktop) */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#f8f9fa]">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#e5e7eb] flex items-center justify-center mb-4 shadow-sm">
              <MessageSquare className="w-7 h-7 text-[#c7cdd4]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#374151] mb-1.5">Select a conversation</h3>
            <p className="text-[13.5px] text-[#9ca3af] max-w-[240px] leading-relaxed">
              Choose a message from the list to view the conversation thread and reply.
            </p>
          </div>
        ) : (
          <>
            {/* ── Thread header ──────────────────────────────────────────── */}
            {(() => {
              const name       = getContactName(selectedReq);
              const label      = getContactLabel(selectedReq);
              const initials   = getInitials(name);
              const color      = avatarColor(name);
              const statusCls  = STATUS_COLORS[selectedReq.status] || "bg-gray-100 text-gray-500";
              const statusLbl  = STATUS_LABELS[selectedReq.status] || selectedReq.status;

              return (
                <div className="bg-white border-b border-[#e5e7eb] px-4 py-3 flex items-center gap-3 shrink-0" data-testid="thread-header">
                  {/* Mobile back */}
                  <button
                    onClick={() => { setMobileView("list"); }}
                    className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors shrink-0"
                    data-testid="button-thread-back"
                  >
                    <ChevronLeft className="w-5 h-5 text-[#374151]" />
                  </button>

                  {/* Avatar */}
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0", color)}>
                    {initials}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14.5px] font-semibold text-[#111827] truncate">{name}</span>
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0", statusCls)}>{statusLbl}</span>
                    </div>
                    <p className="text-[12px] text-[#9ca3af] truncate">
                      {label}
                      {selectedReq.requestType && ` · ${titleCase(selectedReq.requestType)}`}
                    </p>
                  </div>

                  {/* Quick action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedReq.clientId && (
                      <button
                        onClick={() => navigate("/admin/clients")}
                        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] text-[12px] font-medium text-[#374151] border border-[#e5e7eb] hover:bg-[#f3f4f6] transition-colors"
                        data-testid="button-header-view-client"
                        title="View client"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">View Client</span>
                      </button>
                    )}
                    <button
                      onClick={() => navigate("/admin/schedule")}
                      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] text-[12px] font-semibold text-primary border border-primary/25 bg-primary/5 hover:bg-primary/10 transition-colors"
                      data-testid="button-header-schedule"
                      title="Create schedule"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Schedule</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ── Message thread body ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#f7f8fb]">

              {/* Initial request card */}
              <div className="bg-white rounded-[12px] border border-[#e5e7eb] shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden" data-testid="initial-request-card">
                {/* Card header */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#f3f4f6] bg-[#fafafa]">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[13px] font-semibold text-[#111827] flex-1 min-w-0 truncate">
                    {titleCase(selectedReq.requestType || "Request")}
                  </span>
                  <span className="text-[11.5px] text-[#9ca3af] shrink-0">
                    {formatFullTime(selectedReq.createdAt)}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-2">
                  <Row label="From"    value={getContactName(selectedReq)} />
                  <Row label="Subject" value={selectedReq.title} />
                  {selectedReq.description && <Row label="Message" value={selectedReq.description} multiline />}
                  {selectedReq.priority && selectedReq.priority !== "normal" && (
                    <Row label="Priority" value={selectedReq.priority} className={selectedReq.priority === "urgent" || selectedReq.priority === "high" ? "text-red-600 font-semibold" : ""} />
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1">
                  {!selectedReq.clientId && (
                    <ActionBtn icon={UserPlus} label="Add Client" onClick={() => navigate("/admin/clients")} primary testId="btn-add-client" />
                  )}
                  {selectedReq.clientId && (
                    <ActionBtn icon={Building2} label="View Client" onClick={() => navigate("/admin/clients")} primary testId="btn-view-client" />
                  )}
                  <ActionBtn icon={Calendar} label="Create Schedule" onClick={() => navigate("/admin/schedule")} testId="btn-create-schedule" />
                  <ActionBtn icon={FileText} label="Create Quote" onClick={() => navigate("/admin/quote-forms")} testId="btn-create-quote" />
                </div>
              </div>

              {/* Thread messages */}
              {threadLoading ? (
                <div className="space-y-2.5">
                  {[1,2,3].map(i => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                      <Skeleton className="h-14 w-[60%] rounded-[10px]" />
                    </div>
                  ))}
                </div>
              ) : threadError ? (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-[8px] p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Failed to load conversation. Please refresh.
                </div>
              ) : (
                (thread as any[])
                  .filter(m => m.messageType !== "initial_request")
                  .map((msg: any) => {
                    const isAdmin = msg.authorRole === "admin";

                    if (msg.messageType === "status_change") {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="flex items-center gap-1.5 bg-[#f0f0f0] rounded-full px-3 py-1 text-[11.5px] text-[#6b7280]">
                            <Circle className="w-2.5 h-2.5" />
                            Status changed to{" "}
                            <span className="font-semibold text-[#374151]">
                              {STATUS_LABELS[msg.statusValue] || msg.statusValue}
                            </span>
                            <span className="text-[#9ca3af]">· {formatTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[78%] rounded-[12px] px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.07)]",
                          isAdmin
                            ? "bg-primary text-white"
                            : "bg-white border border-[#e5e7eb] text-[#374151]"
                        )}>
                          <p className={cn("text-[11px] font-medium mb-1", isAdmin ? "text-white/65" : "text-[#9ca3af]")}>
                            {isAdmin ? "You (Admin)" : getContactName(selectedReq)}
                          </p>
                          {msg.body && (
                            <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                          )}
                          {msg.attachments?.length > 0 && (
                            <div className="grid grid-cols-2 gap-1 mt-2">
                              {msg.attachments.map((att: any) => (
                                <img
                                  key={att.id}
                                  src={`/api/attachments/${att.id}/image`}
                                  alt={att.caption || "attachment"}
                                  className="w-full h-20 object-cover rounded-[7px] cursor-pointer hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                  data-testid={`msg-attachment-${att.id}`}
                                />
                              ))}
                            </div>
                          )}
                          <p className={cn("text-[11px] mt-1.5", isAdmin ? "text-white/55" : "text-[#9ca3af]")}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
              )}

              <div ref={threadEndRef} />
            </div>

            {/* ── Reply composer ─────────────────────────────────────────── */}
            <div className="bg-white border-t border-[#e5e7eb] px-4 pt-3 pb-3 shrink-0" data-testid="reply-composer">
              {/* Quick reply chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide mb-2">
                {QUICK_REPLIES.map(qr => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => setReplyText(prev => prev ? prev + " " + qr : qr)}
                    data-testid={`quick-${qr.toLowerCase().replace(/\s+/g, "-").replace(/[?]/g, "")}`}
                    className="shrink-0 px-2.5 py-1 rounded-full text-[11.5px] font-medium border border-[#e5e7eb] text-[#374151] hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-colors whitespace-nowrap"
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Input + send */}
              <div className="flex gap-2 items-end">
                <textarea
                  placeholder="Type your message here..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
                  }}
                  rows={2}
                  data-testid="input-reply-text"
                  className="flex-1 resize-none rounded-[8px] border border-[#d1d5db] px-3 py-2 text-[13.5px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || replyMut.isPending}
                  data-testid="button-send-reply"
                  className="flex items-center gap-1.5 px-4 h-[72px] bg-primary text-white text-[13px] font-semibold rounded-[8px] hover:bg-[hsl(210,85%,36%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {replyMut.isPending ? "Sending…" : "Send"}
                </button>
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1.5">Press Ctrl+Enter or ⌘+Enter to send</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helper sub-components ─────────────────────────────────────────────────────
function Row({ label, value, multiline = false, className = "" }: {
  label: string; value?: string; multiline?: boolean; className?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="font-medium text-[#374151] w-[70px] shrink-0">{label}:</span>
      <span className={cn("text-[#111827] min-w-0 break-words", multiline && "whitespace-pre-wrap", className)}>
        {value}
      </span>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, primary = false, testId }: {
  icon: React.ElementType; label: string; onClick: () => void; primary?: boolean; testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-semibold transition-colors",
        primary
          ? "bg-primary text-white hover:bg-[hsl(210,85%,36%)]"
          : "border border-[#e5e7eb] text-[#374151] hover:bg-[#f3f4f6]"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
