import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bell, Megaphone, CreditCard, Tag, AlertTriangle, Headphones, CheckCheck, Sparkles, ChevronLeft, Mail } from "lucide-react";
import type { PlatformMessage } from "@shared/schema";

const typeConfig: Record<string, { label: string; icon: any; color: string; iconBg: string }> = {
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-blue-100 text-blue-800", iconBg: "bg-blue-100 text-blue-700" },
  billing:       { label: "Billing",      icon: CreditCard, color: "bg-orange-100 text-orange-800", iconBg: "bg-orange-100 text-orange-700" },
  promotion:     { label: "Promotion",    icon: Tag,        color: "bg-green-100 text-green-800", iconBg: "bg-green-100 text-green-700" },
  warning:       { label: "Warning",      icon: AlertTriangle, color: "bg-red-100 text-red-800", iconBg: "bg-red-100 text-red-700" },
  support:       { label: "Support",      icon: Headphones, color: "bg-purple-100 text-purple-800", iconBg: "bg-purple-100 text-purple-700" },
  welcome:       { label: "Welcome",      icon: Sparkles,   color: "bg-indigo-100 text-indigo-800", iconBg: "bg-indigo-100 text-indigo-700" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminPlatformMessages() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useQuery<PlatformMessage[]>({
    queryKey: ["/api/admin/platform-messages"],
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/platform-messages/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-messages"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const unreadCount = messages.filter(m => !m.isRead).length;
  const selectedMsg = messages.find(m => m.id === selectedId) ?? null;

  function openMessage(msg: PlatformMessage) {
    setSelectedId(msg.id);
    if (!msg.isRead) {
      markRead.mutate(msg.id);
    }
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedMsg) {
    const config = typeConfig[selectedMsg.messageType] || typeConfig.announcement;
    const Icon = config.icon;
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-messages"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Messages
        </button>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6 pb-6 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge className={`${config.color} border-0 text-xs`}>{config.label}</Badge>
                  {selectedMsg.isBroadcast && (
                    <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Broadcast</Badge>
                  )}
                </div>
                <h2 className="text-lg font-semibold leading-snug">{selectedMsg.subject}</h2>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  <span>ClockField Team</span>
                  <span className="mx-1">·</span>
                  <span>{formatDate(selectedMsg.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Body */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {selectedMsg.body}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Platform Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Messages from the platform team
            {unreadCount > 0 && ` · ${unreadCount} unread`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No messages from the platform yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const config = typeConfig[msg.messageType] || typeConfig.announcement;
            const Icon = config.icon;
            const preview = msg.body.replace(/\n+/g, " ").slice(0, 120) + (msg.body.length > 120 ? "…" : "");
            return (
              <Card
                key={msg.id}
                className={`cursor-pointer transition-all hover:shadow-md ${!msg.isRead ? "border-primary/30 bg-primary/5" : "hover:bg-muted/30"}`}
                onClick={() => openMessage(msg)}
                data-testid={`message-${msg.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm ${!msg.isRead ? "font-semibold" : "font-medium"}`}>{msg.subject}</h3>
                          <Badge className={`${config.color} border-0 text-xs`}>{config.label}</Badge>
                          {msg.isBroadcast && (
                            <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Broadcast</Badge>
                          )}
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        {!msg.isRead && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2 shrink-0"
                            onClick={(e) => { e.stopPropagation(); markRead.mutate(msg.id); }}
                            data-testid={`button-mark-read-${msg.id}`}
                          >
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Mark read
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{formatDate(msg.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
