import {Avatar,AvatarFallback,AvatarImage} from "@/components/ui/avatar";
import {ProfilePhotoUpload} from "@/components/profile-photo-upload";
import {LocationBoundaries} from "@/components/location-boundaries";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UpgradeModal, parsePlanLimitError, type UpgradeReason } from "@/components/upgrade-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Building2, Mail, Phone, MapPin, ClipboardList, KeyRound, RefreshCw, Copy, UserCheck, UserX } from "lucide-react";

export default function AdminClients() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "", contactPhone: "" });
  const [locForm, setLocForm] = useState({ name: "", address: "", clientId: "", notes: "" });
  const [editForm, setEditForm] = useState({ name: "", contactName: "", contactEmail: "", contactPhone: "", isActive: true });
  const [credDialog, setCredDialog] = useState<{ email: string; tempPin: string } | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>(null);

  const { data: clientsList, isLoading,error:directoryError,refetch:reloadDirectory } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locationsList } = useQuery<any[]>({ queryKey: ["/api/locations"] });
  const { data: requestsList } = useQuery<any[]>({ queryKey: ["/api/client-requests"] });

  const createClientMut = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/clients", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients"] }); toast({ title: "Client created" }); setOpen(false); setForm({ name: "", contactName: "", contactEmail: "", contactPhone: "" }); },
    onError: (err: any) => {
      const limitReason = parsePlanLimitError(err);
      if (limitReason) { setOpen(false); setUpgradeReason(limitReason); }
      else toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createLocMut = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/locations", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/locations"] }); toast({ title: "Location created" }); setLocOpen(false); setLocForm({ name: "", address: "", clientId: "", notes: "" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateClientMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated" });
      setDetailOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const enableLoginMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/clients/${id}/enable-login`);
      return res.json();
    },
    onSuccess: (data: { email: string; tempPin: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setCredDialog(data);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetPinMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/clients/${id}/reset-pin`);
      return res.json();
    },
    onSuccess: (data: { email: string; tempPin: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setCredDialog(data);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const disableLoginMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/clients/${id}/disable-login`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client login disabled" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  const handleClientClick = (client: any) => {
    setSelectedClient(client);
    setEditForm({
      name: client.name,
      contactName: client.contactName || "",
      contactEmail: client.contactEmail || "",
      contactPhone: client.contactPhone || "",
      isActive: client.isActive,
    });
    setDetailOpen(true);
  };

  const filtered = (clientsList || []).filter(c => `${c.name} ${c.contactName||""} ${c.contactEmail||""} ${c.contactPhone||""}`.toLowerCase().includes(search.toLowerCase()));

  const getClientLocs = (clientId: string) =>
    (locationsList || []).filter(l => (l.clientId || l.client_id) === clientId);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-clients-title">Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">{clientsList?.length || 0} clients</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <LocationBoundaries locations={locationsList}/>
          <Dialog open={locOpen} onOpenChange={setLocOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="button-add-location"><MapPin className="w-4 h-4 mr-1.5" />Add Location</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Location</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createLocMut.mutate({ ...locForm, clientId: locForm.clientId || null }); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input data-testid="input-loc-name" value={locForm.name} onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input data-testid="input-loc-address" value={locForm.address} onChange={e => setLocForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Link to Client <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Select value={locForm.clientId} onValueChange={val => setLocForm(p => ({ ...p, clientId: val === "none" ? "" : val }))}>
                    <SelectTrigger data-testid="select-loc-client">
                      <SelectValue placeholder="Select client..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No client</SelectItem>
                      {(clientsList || []).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={locForm.notes} onChange={e => setLocForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" disabled={createLocMut.isPending} data-testid="button-save-location">{createLocMut.isPending ? "Creating..." : "Create Location"}</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-client"><Plus className="w-4 h-4 mr-1.5" />Add Client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createClientMut.mutate(form); }} className="space-y-4">
                <div className="space-y-2"><Label>Company Name</Label><Input data-testid="input-client-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Contact Name</Label><Input data-testid="input-client-contact" value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Contact Email</Label><Input data-testid="input-client-email" type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Contact Phone</Label><Input data-testid="input-client-phone" value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} /></div>
                <Button type="submit" className="w-full" disabled={createClientMut.isPending} data-testid="button-save-client">{createClientMut.isPending ? "Creating..." : "Create Client"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search-clients" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {directoryError ? (<div role="alert" className="rounded-lg border p-4 text-sm">The directory could not be loaded. <Button type="button" size="sm" variant="outline" onClick={()=>reloadDirectory()}>Retry</Button></div>) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No clients found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-background divide-y">
          <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_6rem_6rem_5rem] gap-4 px-4 py-3 text-xs font-medium text-muted-foreground bg-muted/30"><span>Client</span><span>Contact</span><span>Work sites</span><span>Status</span><span>Profile</span></div>
          {filtered.map((client:any)=><button key={client.id} type="button" data-testid={`card-client-${client.id}`} onClick={()=>handleClientClick(client)} className="w-full text-left grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_6rem_6rem_5rem] items-center gap-3 lg:gap-4 px-4 py-3 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <div className="flex items-center gap-3 min-w-0"><Avatar className="h-9 w-9 rounded-lg shrink-0"><AvatarImage src={client.avatarUrl} alt={client.name} className="object-contain"/><AvatarFallback className="text-xs bg-primary/10">{client.name.slice(0,2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="text-sm font-medium break-words">{client.name}</p><p className="text-xs text-muted-foreground">{client.contactName||'No contact name'}</p><p className="lg:hidden text-xs text-muted-foreground break-all">{client.contactEmail||client.contactPhone||''}</p></div></div>
            <div className="hidden lg:block min-w-0 text-xs text-muted-foreground"><p className="break-all">{client.contactEmail||'—'}</p><p>{client.contactPhone||'—'}</p></div><span className="hidden lg:block text-sm">{getClientLocs(client.id).length}</span><Badge className="justify-self-end lg:justify-self-start text-[10px]" variant={client.isActive?'secondary':'outline'}>{client.isActive?'Active':'Inactive'}</Badge><span className="hidden lg:block text-xs text-primary">Open →</span>
          </button>)}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedClient?.name}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 py-4">
              {selectedClient&&<ProfilePhotoUpload kind="clients" id={selectedClient.id} name={selectedClient.name} url={selectedClient.avatarUrl} onUpdated={updated=>setSelectedClient((prev:any)=>({...prev,...updated}))}/>}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3"><span className="text-sm font-medium mr-auto">Client login access</span>{!selectedClient?.userId||!selectedClient?.loginEnabled?<Button type="button" size="sm" variant="outline" disabled={!selectedClient?.contactEmail||enableLoginMut.isPending} onClick={()=>enableLoginMut.mutate(selectedClient.id)}>Enable login</Button>:<><Button type="button" size="sm" variant="outline" onClick={()=>resetPinMut.mutate(selectedClient.id)}>Reset PIN</Button><Button type="button" size="sm" variant="outline" onClick={()=>disableLoginMut.mutate(selectedClient.id)}>Disable login</Button></>}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={editForm.contactName}
                    onChange={e => setEditForm(prev => ({ ...prev, contactName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    value={editForm.contactEmail}
                    onChange={e => setEditForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={editForm.contactPhone}
                    onChange={e => setEditForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <div className="space-y-0.5">
                  <Label>Active Status</Label>
                  <p className="text-sm text-muted-foreground">Enable or disable this client profile</p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={checked => setEditForm(prev => ({ ...prev, isActive: checked }))}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => updateClientMut.mutate({ id: selectedClient.id, data: editForm })}
                disabled={updateClientMut.isPending}
                data-testid="button-save-client-detail"
              >
                {updateClientMut.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </TabsContent>

            <TabsContent value="locations" className="space-y-4 py-4">
              {(() => {
                const locs = selectedClient ? getClientLocs(selectedClient.id) : [];
                if (locs.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p>No locations added for this client</p>
                      <p className="text-xs mt-1">Use the "Add Location" button and link it to this client</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {locs.map((loc: any) => (
                      <Card key={loc.id}>
                        <CardContent className="p-4">
                          <p className="font-medium text-sm">{loc.name}</p>
                          {loc.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />{loc.address}
                            </p>
                          )}
                          {loc.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{loc.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="requests" className="space-y-4 py-4">
              {(() => {
                const requests = requestsList?.filter(r => r.clientId === selectedClient?.id) || [];
                if (requests.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p>No requests found for this client</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {requests.map((req: any) => (
                      <Card key={req.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{req.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.description}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize px-1 h-4">{req.status}</Badge>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                            <Badge variant="secondary" className="text-[10px] capitalize px-1 h-4">
                              {req.priority}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credDialog} onOpenChange={(v) => !v && setCredDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Login Credentials</DialogTitle>
          </DialogHeader>
          {credDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Share these credentials with the client. They will be asked to set their own password on first login.</p>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono" data-testid="text-client-cred-email">{credDialog.email}</code>
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(credDialog.email, "Email")} data-testid="button-copy-client-email">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Temporary PIN</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono text-lg tracking-wider" data-testid="text-client-cred-pin">{credDialog.tempPin}</code>
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(credDialog.tempPin, "PIN")} data-testid="button-copy-client-pin">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The client will log in via the Admin / Client tab using their email and this PIN as the password. They will then be required to set a new password.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
    </div>
  );
}
