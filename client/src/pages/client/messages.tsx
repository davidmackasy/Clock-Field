import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import {
  MessageSquare, Plus, ChevronLeft, Send, X, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { companyDateKey, formatCompanyTime, formatCompanyLongDate } from "@/lib/timezone";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MESSAGE_TAGS = [
  { value: "general_message",   label: "General Message" },
  { value: "client_request",    label: "Service Request" },
  { value: "cleaning_issue",    label: "Cleaning Issue" },
  { value: "maintenance_issue", label: "Maintenance Concern" },
  { value: "photo_report",      label: "Photo Report" },
  { value: "other",             label: "Other" },
];
const TAG_LABEL: Record<string, string> = Object.fromEntries(MESSAGE_TAGS.map(t => [t.value, t.label]));
const STATUS_LABELS: Record<string, string> = {
  new: "New", open: "Open", pending: "Pending", in_review: "In Review",
  in_progress: "In Progress", replied: "Replied", scheduled: "Scheduled",
  resolved: "Resolved", closed: "Closed",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700", pending: "bg-orange-100 text-orange-700",
  replied: "bg-emerald-100 text-emerald-700", in_review: "bg-amber-100 text-amber-700",
  in_progress: "bg-amber-100 text-amber-700", resolved: "bg-gray-100 text-gray-500",
  closed: "bg-gray-100 text-gray-500",
};

function tagLabel(v: string) {
  return TAG_LABEL[v] || v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function formatTime(iso: string, tz: string) {
  const d = new Date(iso);
  if (companyDateKey(d, tz) === companyDateKey(new Date(), tz)) return formatCompanyTime(d, tz);
  return formatCompanyLongDate(d, tz);
}
function formatFullTime(iso: string, tz: string) {
  const d = new Date(iso);
  return `${formatCompanyLongDate(d, tz)} ${formatCompanyTime(d, tz)}`;
}
function getComposeTag(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("compose");
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ClientMessages() {
  const { toast } = useToast();
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const timezone = timezoneData?.timezone || "UTC";
  const initialTag = getComposeTag();

  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText]   = useState("");
  const [replyPhotos, setReplyPhotos] = useState<PhotoItem[]>([]);
  const [showPhotoBar, setShowPhotoBar] = useState(false);

  const [showCompose, setShowCompose] = useState(!!initialTag);
  const [compTag, setCompTag]         = useState(initialTag || "general_message");
  const [compTitle, setCompTitle]     = useState("");
  const [compBody, setCompBody]       = useState("");
  const [compPhotos, setCompPhotos]   = useState<PhotoItem[]>([]);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: requests = [], isLoading: reqLoading } = useQuery<any[]>({
    queryKey: ["/api/client-requests"],
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const { data: thread = [], isLoading: threadLoading } = useQuery<any[]>({
    queryKey: ["/api/client-requests", selectedId, "messages"],
    enabled: !!selectedId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async () => {
      if (!compBody.trim()) throw new Error("Message is required");
      const res = await apiRequest("POST", "/api/client-requests", {
        title: compTitle.trim() || TAG_LABEL[compTag] || "New Message",
        description: compBody.trim(),
        requestType: compTag,
        priority: "normal",
        photos: compPhotos,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      setShowCompose(false);
      setCompTitle(""); setCompBody(""); setCompPhotos([]); setCompTag("general_message");
      setSelectedId(data.id);
      setMobileView("thread");
      if (window.location.search) window.history.replaceState({}, "", window.location.pathname);
      toast({ title: "Message sent to your service team" });
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const markClientReadMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/client-requests/${id}/mark-client-read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/client/messages/unread-count"] }),
  });

  const replyMut = useMutation({
    mutationFn: async () => {
      if ((!replyText.trim() && replyPhotos.length === 0) || !selectedId) throw new Error("Message required");
      const res = await apiRequest("POST", `/api/client-requests/${selectedId}/messages`, {
        body: replyText.trim() || null,
        photos: replyPhotos,
        isVisibleToClient: true,
        isVisibleToEmployee: false,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests", selectedId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-requests"] });
      setReplyText(""); setReplyPhotos([]); setShowPhotoBar(false);
      toast({ title: "Reply sent" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!threadLoading) setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [thread, threadLoading]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const myConversations = (requests as any[])
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  const selectedReq = (requests as any[]).find(r => r.id === selectedId) || null;

  function openConversation(req: any) {
    setSelectedId(req.id);
    setMobileView("thread");
    setReplyText(""); setReplyPhotos([]); setShowPhotoBar(false);
    markClientReadMut.mutate(req.id);
  }
  function openCompose(tag?: string) {
    setCompTag(tag || "general_message");
    setCompTitle(""); setCompBody(""); setCompPhotos([]);
    setShowCompose(true);
  }

  // ── Conversation List ─────────────────────────────────────────────────────
  const ConvList = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
        <div>
          <h1 className="text-[20px] font-bold text-[#111827]">Messages</h1>
          <p className="text-[13px] text-[#9ca3af]">Your conversations with our team</p>
        </div>
        <button onClick={() => openCompose()} data-testid="button-new-message"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[13px] font-semibold bg-primary text-white hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {reqLoading ? (
          <div className="px-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-3 p-3 bg-white rounded-[12px] border border-[#f0f0f0]">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /></div>
              </div>
            ))}
          </div>
        ) : myConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-[#d1d5db]" />
            </div>
            <h2 className="text-[16px] font-semibold text-[#374151] mb-2">No messages yet</h2>
            <p className="text-[13.5px] text-[#9ca3af] leading-relaxed mb-6">
              Send a message, report an issue, or upload photos for your service team.
            </p>
            <button onClick={() => openCompose()} data-testid="button-empty-new-message"
              className="flex items-center gap-2 px-5 py-3 rounded-[10px] text-[14px] font-semibold bg-primary text-white hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />New Message
            </button>
          </div>
        ) : (
          <div className="px-4 space-y-2 pb-4">
            {myConversations.map(req => {
              const isSelected = selectedId === req.id;
              const hasReply = req.status === "replied";
              return (
                <button key={req.id} onClick={() => openConversation(req)} data-testid={`convo-${req.id}`}
                  className={cn(
                    "w-full text-left border rounded-[12px] px-4 py-3.5 transition-colors hover:border-primary/20 hover:shadow-sm",
                    isSelected ? "border-primary/40 bg-primary/5 shadow-sm" : hasReply ? "border-primary/30 bg-blue-50/30" : "border-[#f0f0f0] bg-white"
                  )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[14px] truncate", hasReply ? "font-semibold text-[#111827]" : "font-medium text-[#374151]")}>{req.title}</span>
                        {hasReply && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11.5px] font-medium text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-full">{tagLabel(req.requestType)}</span>
                        <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full", STATUS_COLORS[req.status] || "bg-gray-100 text-gray-500")}>
                          {STATUS_LABELS[req.status] || req.status}
                        </span>
                      </div>
                      {req.description && <p className="text-[12.5px] text-[#6b7280] line-clamp-1">{req.description}</p>}
                    </div>
                     <span className="text-[11.5px] text-[#9ca3af] shrink-0 mt-0.5">{formatTime(req.updatedAt || req.createdAt, timezone)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Thread View ───────────────────────────────────────────────────────────
  const ThreadView = selectedReq ? (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] px-4 py-3 flex items-center gap-3 shrink-0" data-testid="thread-header">
        <button onClick={() => setMobileView("list")} data-testid="button-back-to-list"
          className="md:hidden w-9 h-9 rounded-full hover:bg-[#f3f4f6] flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-[#374151]" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-semibold text-[#111827] truncate">{selectedReq.title}</p>
          <p className="text-[12px] text-[#9ca3af] truncate">
            <span className="text-primary/70 font-medium">{tagLabel(selectedReq.requestType)}</span>
            {" · "}{STATUS_LABELS[selectedReq.status] || selectedReq.status}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#f7f8fb]">
        {/* Initial request card */}
        <div className="bg-white rounded-[12px] border border-[#e5e7eb] overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#f3f4f6] bg-[#fafafa]">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-[13px] font-semibold text-[#111827] flex-1 truncate">{tagLabel(selectedReq.requestType)}</span>
             <span className="text-[11.5px] text-[#9ca3af] shrink-0">{formatFullTime(selectedReq.createdAt, timezone)}</span>
          </div>
          <div className="px-4 py-3">
            {selectedReq.description && <p className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed">{selectedReq.description}</p>}
          </div>
        </div>

        {/* Thread messages */}
        {threadLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}><Skeleton className="h-14 w-[70%] rounded-[12px]" /></div>)}
          </div>
        ) : (
          (thread as any[]).filter(m => m.messageType !== "initial_request").map((msg: any) => {
            const isMe = msg.authorRole === "client";
            if (msg.messageType === "status_change") {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-[11.5px] text-[#9ca3af] bg-[#f0f0f0] px-3 py-1 rounded-full">
                    {STATUS_LABELS[msg.statusValue] || msg.statusValue}
                  </span>
                </div>
              );
            }
            return (
              <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[82%] rounded-[12px] px-4 py-3 text-[13.5px] shadow-sm",
                  isMe ? "bg-primary text-primary-foreground rounded-br-[4px]" : "bg-white border border-[#e5e7eb] text-[#374151] rounded-bl-[4px]"
                )}>
                  <p className={cn("text-[11px] font-semibold mb-1.5", isMe ? "text-white/70" : "text-[#9ca3af]")}>
                    {isMe ? "You" : "Service Team"}
                  </p>
                  {msg.body && <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>}
                  {(msg.attachments || []).length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {msg.attachments.map((att: any) => (
                        <img key={att.id} src={`/api/attachments/${att.id}/image`} alt="photo"
                          className="rounded-[6px] object-cover w-full h-20 cursor-pointer hover:opacity-90" />
                      ))}
                    </div>
                  )}
                  <p className={cn("text-[10.5px] mt-1.5 text-right", isMe ? "text-white/50" : "text-[#9ca3af]")}>
                     {formatTime(msg.createdAt, timezone)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Reply composer */}
      {!["resolved", "closed"].includes(selectedReq.status) && (
        <div className="bg-white border-t border-[#e5e7eb] px-3 py-3 shrink-0">
          {showPhotoBar && (
            <div className="mb-2">
              <PhotoUploader photos={replyPhotos} onChange={setReplyPhotos} maxPhotos={3} enableCamera />
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowPhotoBar(p => !p)}
              data-testid="button-toggle-photos"
              className={cn(
                "w-9 h-9 rounded-[8px] border flex items-center justify-center shrink-0 transition-colors relative",
                showPhotoBar || replyPhotos.length > 0
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-[#e5e7eb] text-[#9ca3af] hover:text-primary hover:border-primary/30"
              )}
              title="Attach photos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              {replyPhotos.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {replyPhotos.length}
                </span>
              )}
            </button>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); replyMut.mutate(); } }}
              placeholder="Reply to your service team..."
              rows={2}
              data-testid="textarea-client-reply"
              className="flex-1 min-h-[52px] max-h-28 px-3 py-2.5 rounded-[8px] border border-[#e5e7eb] text-[13.5px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
            />
            <button
              onClick={() => replyMut.mutate()}
              disabled={(!replyText.trim() && replyPhotos.length === 0) || replyMut.isPending}
              data-testid="button-send-client-reply"
              className="w-10 h-10 rounded-[8px] bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {replyMut.isPending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#f8f9fb] text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-white border border-[#e5e7eb] flex items-center justify-center mb-4 shadow-sm">
        <MessageSquare className="w-7 h-7 text-[#c7cdd4]" />
      </div>
      <h3 className="text-[16px] font-semibold text-[#374151] mb-1.5">Select a conversation</h3>
      <p className="text-[13.5px] text-[#9ca3af] max-w-[240px] leading-relaxed">
        Choose a conversation from the list or send a new message.
      </p>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Compose Modal ─────────────────────────────────────────────────── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
              <h2 className="text-[16px] font-bold text-[#111827]">Send a Message</h2>
              <button onClick={() => setShowCompose(false)} data-testid="button-close-compose"
                className="w-8 h-8 rounded-full hover:bg-[#f3f4f6] flex items-center justify-center">
                <X className="w-4 h-4 text-[#6b7280]" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5 block">Type</label>
                <select value={compTag} onChange={e => setCompTag(e.target.value)} data-testid="select-compose-tag"
                  className="w-full h-10 px-3 rounded-[8px] border border-[#e5e7eb] text-[13px] text-[#374151] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40">
                  {MESSAGE_TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5 block">Subject <span className="font-normal normal-case">(optional)</span></label>
                <input type="text" placeholder="Leave blank to use type as subject" value={compTitle} onChange={e => setCompTitle(e.target.value)}
                  data-testid="input-compose-title"
                  className="w-full h-10 px-3 rounded-[8px] border border-[#e5e7eb] text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/40" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5 block">Message</label>
                <textarea placeholder="Describe your issue, request, or question..." value={compBody} onChange={e => setCompBody(e.target.value)}
                  rows={4} data-testid="textarea-compose-body"
                  className="w-full px-3 py-2.5 rounded-[8px] border border-[#e5e7eb] text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/40" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5 block">Photos <span className="font-normal normal-case">(take or upload)</span></label>
                <PhotoUploader photos={compPhotos} onChange={setCompPhotos} maxPhotos={8} enableCamera />
              </div>
              <div className="flex gap-2 pt-1 pb-2">
                <button onClick={() => setShowCompose(false)} data-testid="button-compose-cancel"
                  className="flex-1 py-3 rounded-[10px] text-[14px] font-medium border border-[#e5e7eb] text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                  Cancel
                </button>
                <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !compBody.trim()}
                  data-testid="button-compose-send"
                  className="flex-1 py-3 rounded-[10px] text-[14px] font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {createMut.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Layout ──────────────────────────────────────────────────────────── */}
      <div className="flex h-full overflow-hidden" data-testid="client-messages-page">
        {/* Left: conversation list */}
        <div className={cn(
          "flex flex-col bg-white border-r border-[#e5e7eb] overflow-hidden",
          "w-full md:w-[320px] lg:w-[360px] md:shrink-0",
          mobileView === "thread" ? "hidden md:flex" : "flex"
        )}>
          {ConvList}
        </div>

        {/* Right: thread */}
        <div className={cn(
          "flex-1 overflow-hidden",
          mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
        )}>
          {ThreadView}
        </div>
      </div>
    </>
  );
}
