import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Building2, Mail, Phone, MapPin } from "lucide-react";

export default function AdminClients() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "", contactPhone: "" });
  const [locForm, setLocForm] = useState({ name: "", address: "", clientId: "", notes: "" });

  const { data: clientsList, isLoading } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: locationsList } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const createClientMut = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/clients", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients"] }); toast({ title: "Client created" }); setOpen(false); setForm({ name: "", contactName: "", contactEmail: "", contactPhone: "" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createLocMut = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/locations", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/locations"] }); toast({ title: "Location created" }); setLocOpen(false); setLocForm({ name: "", address: "", clientId: "", notes: "" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = (clientsList || []).filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const locsByClient = new Map<string, any[]>();
  (locationsList || []).forEach(l => {
    const list = locsByClient.get(l.clientId) || [];
    list.push(l);
    locsByClient.set(l.clientId, list);
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-clients-title">Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">{clientsList?.length || 0} clients</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={locOpen} onOpenChange={setLocOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="button-add-location"><MapPin className="w-4 h-4 mr-1.5" />Add Location</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Location</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createLocMut.mutate(locForm); }} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input data-testid="input-loc-name" value={locForm.name} onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Address</Label><Input data-testid="input-loc-address" value={locForm.address} onChange={e => setLocForm(p => ({ ...p, address: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Notes</Label><Input value={locForm.notes} onChange={e => setLocForm(p => ({ ...p, notes: e.target.value }))} /></div>
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No clients found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((client: any) => {
            const locs = locsByClient.get(client.id) || [];
            return (
              <Card key={client.id} data-testid={`card-client-${client.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      {client.contactName && <p className="text-sm text-muted-foreground">{client.contactName}</p>}
                    </div>
                    <Badge variant={client.isActive ? "default" : "secondary"} className="text-xs">{client.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {client.contactEmail && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{client.contactEmail}</div>}
                    {client.contactPhone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{client.contactPhone}</div>}
                    {locs.length > 0 && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{locs.length} location{locs.length > 1 ? "s" : ""}</div>}
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
