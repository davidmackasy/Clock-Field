import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Copy, Download, FileText, Link2, Lock, Paperclip, Send, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function AdminIncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast(); const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({ queryKey: [`/api/admin/incidents/${id}`], enabled: !!id });
  const [investigation, setInvestigation] = useState("");
  const [signerName, setSignerName] = useState("");
  const [adminDeclaration, setAdminDeclaration] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [employeeUrl, setEmployeeUrl] = useState("");
  const [clientUrl, setClientUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const mutate = useMutation({ mutationFn: ({ path, method = "POST", body }: any) => apiRequest(method, `/api/admin/incidents/${id}/${path}`, body), onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/admin/incidents/${id}`] }); toast({ title: "Incident updated" }); } });
  async function reissueEmployeeLink() {
    setLinkBusy(true);
    try {
      const response = await apiRequest("POST", `/api/admin/incidents/${id}/reissue`);
      const result = await response.json();
      const url = result.employeePath ? `${window.location.origin}${result.employeePath}` : result.employeeUrl;
      setEmployeeUrl(url);
      await navigator.clipboard.writeText(url);
      toast({ title: "New employee link generated and copied" });
    } catch (error: any) {
      toast({ title: "Could not generate employee link", description: error.message, variant: "destructive" });
    } finally {
      setLinkBusy(false);
    }
  }
  async function generateClientLink() {
    setLinkBusy(true);
    try {
      const response = await apiRequest("POST", `/api/admin/incidents/${id}/send-client`, {
        allowlist: ["title", "summary", "incidentDate", "incidentTime", "incidentCategory", "areaAffected", "immediateAction"],
      });
      const result = await response.json();
      const url = result.clientPath ? `${window.location.origin}${result.clientPath}` : result.clientUrl;
      setClientUrl(url);
      await navigator.clipboard.writeText(url);
      qc.invalidateQueries({ queryKey: [`/api/admin/incidents/${id}`] });
      toast({ title: "Client-safe link generated and copied" });
    } catch (error: any) {
      toast({ title: "Could not generate client link", description: error.message, variant: "destructive" });
    } finally {
      setLinkBusy(false);
    }
  }
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading incident record…</div>;
  const incident = data?.incident ?? data ?? {};
  const evidence = data?.evidence ?? [];
  const activity = data?.activity ?? incident.activity ?? [];
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current; if (!c || !drawing.current) return;
    const r = c.getBoundingClientRect(); const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#163842";
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke(); setSignatureDataUrl(c.toDataURL("image/png"));
  };
  return <div className="min-h-full bg-background">
    <div className="border-b bg-card px-5 py-4 md:px-8"><div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3"><div><Link href="/admin/incidents" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />All incidents</Link><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{incident.title ?? "Incident report"}</h1><Badge variant="outline" className="font-mono text-[10px]">{incident.incidentNumber ?? `IR-${id}`}</Badge></div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => window.open(`/api/admin/incidents/${id}/pdf?version=internal`, "_blank")}><Download className="mr-1.5 h-4 w-4" />PDF</Button></div></div></div>
    <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-6 lg:grid-cols-[1fr_330px] md:px-8">
      <main className="space-y-6">
        <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Employee statement <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground" /></CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><div><Label>Date & time</Label><p className="mt-1 text-sm">{incident.incidentDate ?? "—"} {incident.incidentTime ?? ""}</p></div><div><Label>Location</Label><p className="mt-1 text-sm">{incident.areaAffected ?? incident.locationName ?? "—"}</p></div><div><Label>Severity</Label><p className="mt-1 text-sm capitalize">{incident.severity ?? "—"}</p></div></div><Separator /><div><Label>What happened</Label><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{data?.snapshot?.statementSnapshot ?? incident.employeeStatement ?? "Awaiting employee submission."}</p></div>{data?.snapshot && <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">EMPLOYEE STATEMENT — LOCKED · Submitted {new Date(data.snapshot.submittedAt).toLocaleString()}</p>}</CardContent></Card>
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Evidence & signature</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{evidence.map((item: any, i: number) => <a key={i} href={`/api/admin/incidents/${id}/evidence/${item.id}`} target="_blank" rel="noreferrer" className="rounded-lg border bg-muted/30 p-3 text-xs hover:border-primary"><Paperclip className="mb-2 h-4 w-4 text-primary" />{item.originalName ?? `Evidence ${i + 1}`}<span className="mt-1 block text-muted-foreground">{item.caption}</span></a>)}</div>{!evidence.length && <p className="text-sm text-muted-foreground">No evidence attached yet.</p>}{data?.snapshot?.signatureDataUrl && <div><Label>Employee signature</Label><img src={data.snapshot.signatureDataUrl} alt="Employee signature" className="mt-2 max-h-28 rounded border bg-white p-2" /></div>}</CardContent></Card>
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Admin investigation</CardTitle></CardHeader><CardContent className="space-y-4"><Textarea value={investigation || data?.investigation?.findings || ""} onChange={e => setInvestigation(e.target.value)} placeholder="Record findings, contributing factors, and decisions…" rows={6} /><Input placeholder="Corrective action" defaultValue={data?.investigation?.correctiveAction ?? ""} /><Button onClick={() => mutate.mutate({ path: "investigation", method: "PATCH", body: { findings: investigation } })}>Save investigation</Button></CardContent></Card>
       <Card className="border-amber-200 bg-amber-50/50 shadow-none"><CardContent className="space-y-4 p-4 text-sm text-amber-950"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Serious-incident review.</strong> Confirm required external reporting and preserve the original statement before finalizing.</p></div><Input placeholder="Administrator name" value={signerName} onChange={e => setSignerName(e.target.value)} /><label className="flex gap-2"><input type="checkbox" checked={adminDeclaration} onChange={e => setAdminDeclaration(e.target.checked)} />I confirm this investigation is complete and the record is ready to sign.</label><div><p className="mb-2 text-xs font-medium">Draw admin signature</p><canvas ref={canvas} width={600} height={120} onPointerDown={e => { drawing.current=true; const ctx=canvas.current?.getContext("2d"); const r=canvas.current?.getBoundingClientRect(); ctx?.beginPath(); ctx?.moveTo(e.clientX-(r?.left ?? 0),e.clientY-(r?.top ?? 0)); }} onPointerUp={() => drawing.current=false} onPointerMove={draw} className="h-24 w-full touch-none rounded border bg-white" /></div><Button disabled={!adminDeclaration || !signatureDataUrl || !signerName.trim()} onClick={() => mutate.mutate({ path: "finalize", body: { signerName, declarationAccepted: adminDeclaration, signatureDataUrl } })}>Confirm and finalize record</Button></CardContent></Card>
      </main>
       <aside className="space-y-4">
         {["pending", "opened", "in_progress", "expired"].includes(incident.status) && <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Employee incident link</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Generate a secure link for the assigned cleaner or staff member to complete this report.</p>{employeeUrl && <div className="flex gap-2"><Input value={employeeUrl} readOnly /><Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(employeeUrl)}><Copy className="h-4 w-4" /></Button></div>}<Button className="w-full" variant="outline" disabled={linkBusy} onClick={reissueEmployeeLink}><Link2 className="mr-2 h-4 w-4" />{incident.status === "expired" ? "Generate new link" : "Regenerate employee link"}</Button></CardContent></Card>}
         <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Client-safe link</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Available after the employee submits and the admin finalizes the report.</p>{clientUrl && <div className="flex gap-2"><Input value={clientUrl} readOnly /><Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(clientUrl)}><Copy className="h-4 w-4" /></Button></div>}<Button className="w-full" variant="outline" disabled={!["admin_signed", "sent_to_client"].includes(incident.status) || linkBusy} onClick={generateClientLink}><Send className="mr-2 h-4 w-4" />Generate client link</Button></CardContent></Card>
         <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Record activity</CardTitle></CardHeader><CardContent className="space-y-3 text-xs text-muted-foreground">{activity.map((event: any, i: number) => <div key={i} className="border-l-2 border-primary/30 pl-3"><p className="text-foreground">{event.label ?? event.action}</p><p>{event.createdAt ?? ""}</p></div>)}{!activity.length && <p>No activity recorded yet.</p>}</CardContent></Card>
       </aside>
    </div>
  </div>;
}