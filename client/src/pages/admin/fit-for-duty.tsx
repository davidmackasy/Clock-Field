import {Input} from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCompanyInstant } from "@/lib/timezone";

function LivePhoto({ id, employeeName }: { id: string; employeeName: string }) {
  const [imageUrl, setImageUrl] = useState<string>();
  const photo = useQuery({
    queryKey: ["fit-for-duty-photo", id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/fit-for-duty/${encodeURIComponent(id)}/photo`, { credentials: "include", cache: "no-store" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Could not load the photo. Please try again.");
      return response.blob();
    },
    retry: false,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!photo.data) { setImageUrl(undefined); return; }
    const url = URL.createObjectURL(photo.data);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo.data]);
  return <div className="space-y-2">
    <p className="text-sm font-semibold">Live Photo</p>
    {photo.isLoading && <p className="text-sm text-muted-foreground" role="status">Loading photo…</p>}
    {photo.data === null && <p className="rounded-lg border p-3 text-sm text-muted-foreground">The original photo is unavailable. This submission’s answers and review history are still preserved.</p>}
    {photo.isError && <div className="rounded-lg border p-3 space-y-2"><p className="text-sm" role="alert">Could not load the photo. Please try again.</p><Button variant="outline" size="sm" onClick={() => photo.refetch()} disabled={photo.isFetching}>Retry photo</Button></div>}
    {imageUrl && <img src={imageUrl} alt={`Live attendance verification for ${employeeName}`} className="max-h-80 w-full max-w-sm rounded-lg border object-cover" />}
  </div>;
}

export default function AdminFitForDuty() {
  const { data = [], isLoading, isError } = useQuery<any[]>({ queryKey: ["/api/admin/fit-for-duty"] });
  const { data: timezoneData } = useQuery<{ timezone: string }>({ queryKey: ["/api/settings/timezone"], staleTime: Infinity });
  const timezone = timezoneData?.timezone || "UTC";
  const [search,setSearch]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [status,setStatus]=useState("all");
  const [opened,setOpened]=useState<string|null>(new URLSearchParams(window.location.search).get("submission"));
  const day=(instant:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(instant));
  const rows=data.filter(row=>{const date=day(row.acceptedAt);return (!from||date>=from)&&(!to||date<=to)&&(status==="all"||row.status===status)&&`${row.employeeName} ${row.employeeNumber} ${row.locationName} ${date} ${formatCompanyInstant(row.acceptedAt,timezone,{hour:"2-digit",minute:"2-digit"})}`.toLowerCase().includes(search.toLowerCase());});
  const groups=rows.reduce<Record<string,any[]>>((groups,row)=>{const date=new Date(day(row.acceptedAt)+"T12:00:00Z");date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));const key=date.toISOString().slice(0,10);(groups[key]??=[]).push(row);return groups;},{});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: string }) => (await apiRequest("POST", `/api/admin/fit-for-duty/${id}/review`, { decision, note: notes[id] || undefined })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/fit-for-duty"] }),
  });
  return <div className="p-6 space-y-4">
    <div><h1 className="text-2xl font-bold">Fit for Duty</h1><p className="text-sm text-muted-foreground">Review employee fitness-for-duty submissions.</p></div>
    {isLoading && <p className="text-muted-foreground">Loading submissions…</p>}
    {isError && <p className="text-destructive">Could not load Fit for Duty submissions.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"><Input aria-label="Search submissions" placeholder="Name, employee ID, date or time…" value={search} onChange={e=>setSearch(e.target.value)}/><div><label className="text-xs" htmlFor="fit-from">From</label><Input id="fit-from" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div><label className="text-xs" htmlFor="fit-to">Until</label><Input id="fit-to" type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></div><select aria-label="Submission status" className="border rounded-md p-2" value={status} onChange={e=>setStatus(e.target.value)}>{['all','cleared','flagged','blocked'].map(s=><option key={s} value={s}>{s==='all'?'All statuses':s}</option>)}</select></div>
    <p className="text-sm text-muted-foreground">{rows.length} matching submissions</p>
    {Object.entries(groups).sort(([a],[b])=>b.localeCompare(a)).map(([week,weekRows])=><section key={week} className="space-y-3"><h2 className="font-semibold">Week of {week}</h2><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">{(weekRows||[]).slice().sort((a,b)=>Date.parse(a.acceptedAt)-Date.parse(b.acceptedAt)).map(row => {
      const answers = JSON.parse(row.answerSnapshot || "[]");
      const questions = JSON.parse(row.questionTextSnapshot || "[]");
      return <Card key={row.id}><CardHeader><CardTitle className="flex justify-between text-base"><span>{row.employeeName} ({row.employeeNumber || "No ID"})</span><Badge variant={row.status === "flagged" ? "destructive" : "secondary"}>{row.status}</Badge></CardTitle><p className="text-sm text-muted-foreground">{row.locationName} · {formatCompanyInstant(row.acceptedAt, timezone, { weekday:"short",year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p></CardHeader><CardContent className="space-y-3"><Button variant="outline" size="sm" onClick={()=>setOpened(opened===row.id?null:row.id)}>{opened===row.id?"Close details":"View photo & details"}</Button>{opened===row.id&&<>
        {row.hasFacePhoto && <LivePhoto id={row.id} employeeName={row.employeeName} />}
        <div className="space-y-1 text-sm">{questions.map((q: string, i: number) => <p key={q}><b>{i + 1}.</b> {q} — <span className="font-semibold">{answers[i] ? "Yes" : "No"}</span></p>)}</div>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p><b>Confirmation:</b> {row.confirmationAccepted ? "Accepted" : "Not accepted"}</p>
          <p><b>Declaration version:</b> {row.declarationVersion}</p>
          <p><b>Related shift:</b> {row.shiftId || "Unscheduled clock-in"}</p>
          <p><b>Related clock-in:</b> {row.clockInId || "None (clock-in blocked or pending)"}</p>
        </div>
        {row.status === "flagged" && <><Textarea placeholder="Optional review note" value={notes[row.id] || ""} onChange={e => setNotes(n => ({ ...n, [row.id]: e.target.value }))} /><div className="flex gap-2"><Button onClick={() => review.mutate({ id: row.id, decision: "cleared" })}>Clear for Work</Button><Button variant="outline" onClick={() => review.mutate({ id: row.id, decision: "blocked" })}>Keep Blocked</Button></div></>}
        {row.reviews?.length > 0 && <p className="text-xs text-muted-foreground">Latest review: {row.reviews[0].decision} at {formatCompanyInstant(row.reviews[0].createdAt, timezone, { weekday:"short",year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p>}
      </>}</CardContent></Card>;
    })}</div></section>)}
    {!isLoading && !isError && !rows.length && <p className="text-muted-foreground">No submissions yet.</p>}
  </div>;
}
