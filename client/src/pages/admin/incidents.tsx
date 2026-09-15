import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardCheck, Clock3, FilePlus2, Filter, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import IncidentLinkGenerator from "@/pages/admin/incident-link-generator";

const tone: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  opened: "bg-cyan-100 text-cyan-800",
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  admin_signed: "bg-emerald-100 text-emerald-800",
  sent_to_client: "bg-violet-100 text-violet-800",
  closed: "bg-emerald-100 text-emerald-800",
  expired: "bg-red-100 text-red-800",
};

export default function AdminIncidents() {
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/admin/incidents/dashboard"],
  });
  const incidents = useMemo(() => {
    const rows = data?.incidents ?? data?.rows ?? [];
    return rows.filter((row: any) => {
      const hit = `${row.title ?? ""} ${row.incidentNumber ?? row.id ?? ""} ${row.employeeName ?? ""}`.toLowerCase().includes(query.toLowerCase());
      return hit && (status === "all" || row.status === status);
    });
  }, [data, query, status]);
  const counts = data?.summary ?? data?.counts ?? {};

  return (
    <div className="min-h-full bg-background">
      <div className="border-b bg-card/80 px-5 py-5 md:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Safety & compliance</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Incident reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">A clear record of what happened, what changed, and what happens next.</p>
          </div>
          <Button onClick={() => setGeneratorOpen(true)} className="w-full gap-2 sm:w-auto"><FilePlus2 className="h-4 w-4" />Generate incident link</Button>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-6 md:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Open reports", (counts.pending ?? 0) + (counts.opened ?? 0) + (counts.in_progress ?? 0) + (counts.submitted ?? 0) + (counts.in_review ?? 0), AlertTriangle, "text-amber-700 bg-amber-50"],
            ["Admin review", (counts.submitted ?? 0) + (counts.in_review ?? 0), ClipboardCheck, "text-blue-700 bg-blue-50"],
            ["Completed", (counts.admin_signed ?? 0) + (counts.sent_to_client ?? 0) + (counts.closed ?? 0), ShieldCheck, "text-emerald-700 bg-emerald-50"],
            ["Awaiting employee", (counts.pending ?? 0) + (counts.opened ?? 0) + (counts.in_progress ?? 0), Clock3, "text-slate-700 bg-slate-100"],
          ].map(([label, value, Icon, classes]: any) => (
            <Card key={label as string} className="shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg p-2 ${classes}`}><Icon className="h-4 w-4" /></div>
                <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="shadow-none">
          <CardHeader className="gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">All incidents</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search reports…" className="pl-9 sm:w-64" /></div>
              <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="opened">Opened</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="in_review">Admin review</SelectItem><SelectItem value="admin_signed">Admin signed</SelectItem><SelectItem value="sent_to_client">Sent to client</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> :
              isError ? <div className="p-8 text-center text-sm text-destructive">Incident records could not be loaded. Refresh and try again.</div> :
              incidents.length === 0 ? <div className="p-12 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-primary/50" /><p className="mt-3 font-medium">No matching incident reports</p><p className="mt-1 text-sm text-muted-foreground">New reports will appear here as soon as they are created.</p></div> :
              <div className="divide-y">{incidents.map((row: any) => <Link key={row.id} href={`/admin/incidents/${row.id}`} className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[11px] text-muted-foreground">{row.incidentNumber ?? `IR-${row.id}`}</span><Badge className={`border-0 text-[10px] ${tone[row.status] ?? "bg-muted"}`}>{(row.status ?? "draft").replaceAll("_", " ")}</Badge></div><p className="mt-1 truncate font-medium">{row.title ?? row.summary ?? "Untitled incident"}</p><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{row.incidentDate ?? "Date not set"} <span>·</span>{row.employeeName ?? row.assignedEmployeeName ?? "Unassigned"}</p></div>
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 md:block" />
              </Link>)}</div>}
          </CardContent>
        </Card>
      </div>
       <IncidentLinkGenerator open={generatorOpen} onClose={() => setGeneratorOpen(false)} />
    </div>
  );
}