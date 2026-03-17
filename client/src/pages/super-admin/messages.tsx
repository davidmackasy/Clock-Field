import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Globe, ArrowLeft, Plus, Megaphone, CreditCard, Tag, AlertTriangle, Headphones } from "lucide-react";
import type { PlatformMessage } from "@shared/schema";

type Business = { id: string; name: string };

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-blue-100 text-blue-800" },
  billing: { label: "Billing", icon: CreditCard, color: "bg-orange-100 text-orange-800" },
  promotion: { label: "Promotion", icon: Tag, color: "bg-green-100 text-green-800" },
  warning: { label: "Warning", icon: AlertTriangle, color: "bg-red-100 text-red-800" },
  support: { label: "Support", icon: Headphones, color: "bg-purple-100 text-purple-800" },
};

export default function SuperAdminMessages() {
  const { isSuperAdmin } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [composeOpen, setComposeOpen] = useState(false);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [targetBizId, setTargetBizId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msgType, setMsgType] = useState("announcement");

  const { data: messages = [], isLoading } = useQuery<PlatformMessage[]>({
    queryKey: ["/api/super-admin/messages"],
    enabled: isSuperAdmin,
  });

  const { data: businesses = [] } = useQuery<Business[]>({
    queryKey: ["/api/super-admin/businesses"],
    enabled: isSuperAdmin && composeOpen && !isBroadcast,
    select: (data: any[]) => data.map(b => ({ id: b.id, name: b.name })),
  });

  const sendMessage = useMutation({
    mutationFn: async (data: any) => {
      const url = isBroadcast
        ? "/api/super-admin/messages/broadcast"
        : `/api/super-admin/businesses/${targetBizId}/message`;
      const res = await apiRequest("POST", url, { ...data, isBroadcast });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/messages"] });
      toast({ title: "Message sent" });
      setComposeOpen(false);
      setSubject("");
      setBody("");
      setTargetBizId("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) return;
    if (!isBroadcast && !targetBizId) return;
    sendMessage.mutate({ subject, body, messageType: msgType });
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <p className="text-muted-foreground">Super admin access required</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Platform Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Send and manage messages to businesses</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setIsBroadcast(true); setComposeOpen(true); }} data-testid="button-new-broadcast">
            <Globe className="w-4 h-4 mr-1.5" />
            Broadcast
          </Button>
          <Button size="sm" onClick={() => { setIsBroadcast(false); setComposeOpen(true); }} data-testid="button-new-message">
            <Plus className="w-4 h-4 mr-1.5" />
            New Message
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/super-admin")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Dashboard
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No messages sent yet</p>
            <Button size="sm" className="mt-4" onClick={() => setComposeOpen(true)} data-testid="button-send-first">
              Send your first message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const config = typeConfig[msg.messageType] || typeConfig.announcement;
            const Icon = config.icon;
            return (
              <Card key={msg.id} data-testid={`message-${msg.id}`}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{msg.subject}</span>
                        <Badge className={`${config.color} border-0 text-xs`}>{config.label}</Badge>
                        {msg.isBroadcast && <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Broadcast</Badge>}
                        {!msg.isBroadcast && <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">Direct</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{msg.body}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              {isBroadcast ? "Broadcast to All Businesses" : "Send to Specific Business"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!isBroadcast && (
              <div className="space-y-1.5">
                <Label>Business</Label>
                <Select value={targetBizId} onValueChange={setTargetBizId}>
                  <SelectTrigger data-testid="select-target-business">
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={msgType} onValueChange={setMsgType}>
                <SelectTrigger data-testid="select-compose-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" data-testid="input-compose-subject" />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Write your message..." data-testid="textarea-compose-body" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={!subject.trim() || !body.trim() || (!isBroadcast && !targetBizId) || sendMessage.isPending}
              data-testid="button-compose-send"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sendMessage.isPending ? "Sending..." : isBroadcast ? "Broadcast" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
