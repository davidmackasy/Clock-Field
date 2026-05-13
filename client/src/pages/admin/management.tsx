import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Search, Users, Copy, RefreshCw, UserX, UserCheck, Mail, Send, RotateCcw } from "lucide-react";

type ManagementMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  accountStatus?: string;
  loginEnabled?: boolean;
  createdAt?: string;
  managementRole?: string;
  inviteStatus?: string;
  inviteSentAt?: string;
  inviteAcceptedAt?: string;
};

type InviteResult = ManagementMember & { tempPin: string; inviteEmailStatus?: string };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  assistant: "Assistant",
  team: "Team",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full business management access",
  assistant: "View most areas and help with office operations",
  team: "View team activity, schedules, and employee status",
};

const INVITE_STATUS_LABELS: Record<string, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  accepted: "Accepted",
  expired: "Expired",
  failed: "Failed",
};

function roleBadge(role?: string) {
  if (!role || role === "admin") return <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0">Admin</Badge>;
  if (role === "assistant") return <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-0">Assistant</Badge>;
  return <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">Team</Badge>;
}

function statusBadge(member: ManagementMember) {
  if (member.accountStatus === "disabled" || !member.isActive) return <Badge variant="destructive" className="text-xs">Disabled</Badge>;
  if (member.accountStatus === "pending_activation") return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>;
  return <Badge variant="default" className="text-xs">Active</Badge>;
}

function inviteStatusBadge(status?: string) {
  if (!status || status === "not_sent") return null;
  const colors: Record<string, string> = {
    sent: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    accepted: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    expired: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    failed: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || ""}`}>
      <Mail className="w-3 h-3" />
      {INVITE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

export default function AdminManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [credDialog, setCredDialog] = useState<{ email: string; tempPin: string; inviteEmailStatus?: string } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagementMember | null>(null);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", tempPin: "",
    managementRole: "admin", sendEmailInvite: false,
  });

  const { data: members, isLoading } = useQuery<ManagementMember[]>({ queryKey: ["/api/admins"] });

  const inviteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admins/invite", data);
      return res.json();
    },
    onSuccess: (data: InviteResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setCredDialog({ email: data.email!, tempPin: data.tempPin, inviteEmailStatus: data.inviteEmailStatus });
      setInviteOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", tempPin: "", managementRole: "admin", sendEmailInvite: false });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admins/${id}/reset-pin`);
      return res.json();
    },
    onSuccess: (data: { tempPin: string }, id: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      const member = members?.find(m => m.id === id);
      setCredDialog({ email: member?.email || "", tempPin: data.tempPin });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admins/${id}/resend-invite`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      toast({ title: "Invite resent successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admins/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setDeactivateTarget(null);
      toast({ title: "Member updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (members || []).filter(m =>
    `${m.firstName} ${m.lastName} ${m.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied` }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-management-title">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">{members?.length || 0} member{(members?.length || 0) !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-management"><Plus className="w-4 h-4 mr-1.5" />Add Member</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Management Member</DialogTitle>
              <DialogDescription>Invite a new member to help manage your business on ClockField.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(formData); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input data-testid="input-member-first" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input data-testid="input-member-last" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input data-testid="input-member-email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input data-testid="input-member-phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555-000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Role <span className="text-destructive">*</span></Label>
                <Select value={formData.managementRole} onValueChange={v => setFormData(p => ({ ...p, managementRole: v }))}>
                  <SelectTrigger data-testid="select-member-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
                {formData.managementRole && (
                  <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[formData.managementRole]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Temporary PIN <span className="text-muted-foreground font-normal">(optional — leave blank to auto-generate)</span></Label>
                <Input
                  data-testid="input-member-temp-pin"
                  value={formData.tempPin}
                  onChange={e => setFormData(p => ({ ...p, tempPin: e.target.value }))}
                  placeholder="e.g. 123456"
                  minLength={4}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Send email invite</Label>
                  <p className="text-xs text-muted-foreground">Send a secure invite link to their email address</p>
                </div>
                <Switch
                  data-testid="switch-send-invite"
                  checked={formData.sendEmailInvite}
                  onCheckedChange={v => setFormData(p => ({ ...p, sendEmailInvite: v }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={inviteMutation.isPending} data-testid="button-save-member">
                {inviteMutation.isPending ? "Creating..." : "Create Member Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search-members" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No management members found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invite</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => {
                const isCurrentUser = member.id === (user as any)?.id;
                return (
                  <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.firstName} {member.lastName}
                        {isCurrentUser && <Badge variant="outline" className="text-xs">You</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{member.email}</TableCell>
                    <TableCell>{roleBadge(member.managementRole)}</TableCell>
                    <TableCell>{statusBadge(member)}</TableCell>
                    <TableCell>{inviteStatusBadge(member.inviteStatus)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(member.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {!isCurrentUser && (
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button
                            size="sm" variant="outline" className="text-xs h-7 gap-1"
                            disabled={resetPinMutation.isPending || !member.isActive}
                            onClick={() => resetPinMutation.mutate(member.id)}
                            data-testid={`button-reset-pin-${member.id}`}
                          >
                            <RefreshCw className="w-3 h-3" /> Reset PIN
                          </Button>
                          {member.inviteStatus && member.inviteStatus !== "not_sent" && member.inviteStatus !== "accepted" && (
                            <Button
                              size="sm" variant="outline" className="text-xs h-7 gap-1"
                              disabled={resendInviteMutation.isPending}
                              onClick={() => resendInviteMutation.mutate(member.id)}
                              data-testid={`button-resend-invite-${member.id}`}
                            >
                              <Send className="w-3 h-3" /> Resend
                            </Button>
                          )}
                          {member.isActive ? (
                            <Button
                              size="sm" variant="outline" className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                              onClick={() => setDeactivateTarget(member)}
                              data-testid={`button-deactivate-${member.id}`}
                            >
                              <UserX className="w-3 h-3" /> Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm" variant="outline" className="text-xs h-7 gap-1"
                              disabled={toggleActiveMutation.isPending}
                              onClick={() => toggleActiveMutation.mutate({ id: member.id, isActive: true })}
                              data-testid={`button-reactivate-${member.id}`}
                            >
                              <UserCheck className="w-3 h-3" /> Reactivate
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Credentials dialog */}
      <Dialog open={!!credDialog} onOpenChange={(v) => !v && setCredDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Member Created</DialogTitle>
            <DialogDescription>
              {credDialog?.inviteEmailStatus === "sent"
                ? "An invite email has been sent. Credentials are also available below as a backup."
                : credDialog?.inviteEmailStatus === "failed"
                ? "Invite email failed to send. Please share credentials manually."
                : "Share these credentials with the new member. They'll be asked to set a password on first login."}
            </DialogDescription>
          </DialogHeader>
          {credDialog && (
            <div className="space-y-4">
              {credDialog.inviteEmailStatus === "sent" && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                  <Mail className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-300">Invite email sent successfully</p>
                </div>
              )}
              {credDialog.inviteEmailStatus === "failed" && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <Mail className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">Invite email failed — share credentials manually</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono" data-testid="text-cred-email">{credDialog.email}</code>
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(credDialog.email, "Email")} data-testid="button-copy-email">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Temporary PIN</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono text-lg tracking-wider" data-testid="text-cred-pin">{credDialog.tempPin}</code>
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(credDialog.tempPin, "PIN")} data-testid="button-copy-pin">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The new member logs in using their email and this PIN. They'll be prompted to set a permanent password.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm dialog */}
      <Dialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {deactivateTarget?.firstName} {deactivateTarget?.lastName}? They will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={toggleActiveMutation.isPending}
              onClick={() => deactivateTarget && toggleActiveMutation.mutate({ id: deactivateTarget.id, isActive: false })}
              data-testid="button-confirm-deactivate"
            >
              {toggleActiveMutation.isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
