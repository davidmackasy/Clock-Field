import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCompanyInstant } from "@/lib/timezone";

export default function IncidentLinkGenerator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [clientId, setClientId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [title, setTitle] = useState("Incident report request");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ employeeUrl: string; expiresAt: string; incidentId: string } | null>(null);
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"], enabled: open });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"], enabled: open });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"], enabled: open });
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const timezone = timezoneData?.timezone || "UTC";

  function close() {
    setEmployeeId("");
    setClientId("");
    setLocationId("");
    setTitle("Incident report request");
    setResult(null);
    onClose();
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.employeeUrl);
    toast({ title: "Employee incident link copied" });
  }

  async function generate() {
    if (!employeeId) return;
    setCreating(true);
    try {
      const response = await apiRequest("POST", "/api/admin/incidents", {
        assignedEmployeeId: employeeId,
        assignedClientId: clientId || undefined,
        assignedLocationId: locationId || undefined,
        title: title.trim() || "Incident report request",
      });
      const data = await response.json();
      setResult({
        employeeUrl: data.employeePath ? `${window.location.origin}${data.employeePath}` : data.employeeUrl,
        expiresAt: data.expiresAt,
        incidentId: data.incident.id,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/incidents/dashboard"] });
    } catch (error: any) {
      toast({ title: "Could not generate link", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{result ? "Employee link generated" : "Generate incident report link"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Send this secure link to the assigned cleaner or staff member. They will fill out the incident report."
              : "Choose who must complete the report. The admin does not fill out the incident details."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex h-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="mr-2 h-5 w-5" /> Ready to send
            </div>
            <div className="space-y-2">
              <Label>Secure employee link</Label>
              <div className="flex gap-2">
                <Input value={result.employeeUrl} readOnly />
                <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copy employee link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires {formatCompanyInstant(result.expiresAt, timezone, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}. The employee must verify their existing ClockField credentials.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => window.open(`/admin/incidents/${result.incidentId}`, "_self")}>Open request</Button>
              <Button type="button" onClick={copyLink}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cleaner or staff member *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map((employee: any) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {[employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.employeeId}
                  </SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Request title</Label>
              <Input value={title} onChange={event => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Client (optional)</Label>
                <Select value={clientId || "none"} onValueChange={value => setClientId(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="No client" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No client</SelectItem>{clients.map((client: any) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location (optional)</Label>
                <Select value={locationId || "none"} onValueChange={value => setLocationId(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="No location" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No location</SelectItem>{locations.map((location: any) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="button" disabled={!employeeId || creating} onClick={generate}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Generate employee link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}