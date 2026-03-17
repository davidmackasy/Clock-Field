import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bell, Megaphone, CreditCard, Tag, AlertTriangle, Headphones, CheckCheck } from "lucide-react";
import type { PlatformMessage } from "@shared/schema";

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-blue-100 text-blue-800" },
  billing: { label: "Billing", icon: CreditCard, color: "bg-orange-100 text-orange-800" },
  promotion: { label: "Promotion", icon: Tag, color: "bg-green-100 text-green-800" },
  warning: { label: "Warning", icon: AlertTriangle, color: "bg-red-100 text-red-800" },
  support: { label: "Support", icon: Headphones, color: "bg-purple-100 text-purple-800" },
};

export default function AdminPlatformMessages() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<PlatformMessage[]>({
    queryKey: ["/api/admin/platform-messages"],
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/platform-messages/${id}/read`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-messages"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const unreadCount = messages.filter(m => !m.isRead).length;

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
        <div className="space-y-3">
          {messages.map(msg => {
            const config = typeConfig[msg.messageType] || typeConfig.announcement;
            const Icon = config.icon;
            return (
              <Card
                key={msg.id}
                className={`transition-colors ${!msg.isRead ? "border-primary/30 bg-primary/5" : ""}`}
                data-testid={`message-${msg.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-medium text-sm ${!msg.isRead ? "font-semibold" : ""}`}>{msg.subject}</h3>
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
                            onClick={() => markRead.mutate(msg.id)}
                            data-testid={`button-mark-read-${msg.id}`}
                          >
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Mark read
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{msg.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
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
