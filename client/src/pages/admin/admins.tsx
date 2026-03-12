import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Search, ShieldCheck, Copy, RefreshCw, UserX, UserCheck } from "lucide-react";

type Admin = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  accountStatus?: string;
  loginEnabled?: boolean;
  createdAt?: string;
};

type InviteResult = Admin & { tempPin: string };

function statusBadge(admin: Admin) {
  if (admin.accountStatus === "disabled" || !admin.isActive) return <Badge variant="destructive" className="text-xs">Disabled</Badge>;
  if (admin.accountStatus === "pending_activation") return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending Activation</Badge>;
  return <Badge variant="default" className="text-xs">Active</Badge>;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function AdminAdmins() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [credDialog, setCredDialog] = useState<{ email: string; tempPin: string } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Admin | null>(null);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", tempPin: "" });

  const { data: admins, isLoading } = useQuery<Admin[]>({ queryKey: ["/api/admins"] });

  const inviteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admins/invite", data);
      return res.json();
    },
    onSuccess: (data: InviteResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setCredDialog({ email: data.email!, tempPin: data.tempPin });
      setInviteOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", tempPin: "" });
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
      const admin = admins?.find(a => a.id === id);
      setCredDialog({ email: admin?.email || "", tempPin: data.tempPin });
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
      toast({ title: "Admin updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (admins || []).filter(a =>
    `${a.firstName} ${a.lastName} ${a.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-admins-title">Admin Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{admins?.length || 0} admin{(admins?.length || 0) !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-admin"><Plus className="w-4 h-4 mr-1.5" />Add Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New Admin</DialogTitle>
              <DialogDescription>Create a new admin account. You can set a custom temporary PIN or leave it blank to auto-generate one.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(formData); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input data-testid="input-admin-first" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input data-testid="input-admin-last" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input data-testid="input-admin-email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input data-testid="input-admin-phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555-000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Temporary PIN <span className="text-muted-foreground font-normal">(optional — leave blank to auto-generate)</span></Label>
                <Input
                  data-testid="input-admin-temp-pin"
                  value={formData.tempPin}
                  onChange={e => setFormData(p => ({ ...p, tempPin: e.target.value }))}
                  placeholder="e.g. 123456"
                  minLength={4}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Share the email and PIN with the new admin so they can log in and set their own password.
              </p>
              <Button type="submit" className="w-full" disabled={inviteMutation.isPending} data-testid="button-save-admin">
                {inviteMutation.isPending ? "Creating..." : "Create Admin Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search-admins" placeholder="Search admins..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No admins found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((admin: Admin) => {
                const isCurrentUser = admin.id === (user as any)?.id;
                return (
                  <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {admin.firstName} {admin.lastName}
                        {isCurrentUser && <Badge variant="outline" className="text-xs">You</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                    <TableCell>{statusBadge(admin)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(admin.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {!isCurrentUser && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            disabled={resetPinMutation.isPending || !admin.isActive}
                            onClick={() => resetPinMutation.mutate(admin.id)}
                            data-testid={`button-reset-pin-admin-${admin.id}`}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Reset PIN
                          </Button>
                          {admin.isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                              onClick={() => setDeactivateTarget(admin)}
                              data-testid={`button-deactivate-admin-${admin.id}`}
                            >
                              <UserX className="w-3 h-3" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 gap-1"
                              disabled={toggleActiveMutation.isPending}
                              onClick={() => toggleActiveMutation.mutate({ id: admin.id, isActive: true })}
                              data-testid={`button-reactivate-admin-${admin.id}`}
                            >
                              <UserCheck className="w-3 h-3" />
                              Reactivate
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

      <Dialog open={!!credDialog} onOpenChange={(v) => !v && setCredDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Login Credentials</DialogTitle>
            <DialogDescription>Share these credentials with the new admin. They will be asked to set their own password on first login.</DialogDescription>
          </DialogHeader>
          {credDialog && (
            <div className="space-y-4">
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
                The new admin will log in via the Admin / Client tab using their email and this PIN as the password. They will then be required to set a new password.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Admin</DialogTitle>
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
