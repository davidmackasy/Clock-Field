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
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: string }) => (await apiRequest("POST", `/api/admin/fit-for-duty/${id}/review`, { decision, note: notes[id] || undefined })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/fit-for-duty"] }),
  });
  return <div className="p-6 space-y-4">
    <div><h1 className="text-2xl font-bold">Fit for Duty</h1><p className="text-sm text-muted-foreground">Review employee fitness-for-duty submissions.</p></div>
    {isLoading && <p className="text-muted-foreground">Loading submissions…</p>}
    {isError && <p className="text-destructive">Could not load Fit for Duty submissions.</p>}
    {data.map(row => {
      const answers = JSON.parse(row.answerSnapshot || "[]");
      const questions = JSON.parse(row.questionTextSnapshot || "[]");
      return <Card key={row.id}><CardHeader><CardTitle className="flex justify-between text-base"><span>{row.employeeName} ({row.employeeNumber || "No ID"})</span><Badge variant={row.status === "flagged" ? "destructive" : "secondary"}>{row.status}</Badge></CardTitle><p className="text-sm text-muted-foreground">{row.locationName} · {formatCompanyInstant(row.acceptedAt, timezone, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p></CardHeader><CardContent className="space-y-3">
        {row.hasFacePhoto && <LivePhoto id={row.id} employeeName={row.employeeName} />}
        <div className="space-y-1 text-sm">{questions.map((q: string, i: number) => <p key={q}><b>{i + 1}.</b> {q} — <span className="font-semibold">{answers[i] ? "Yes" : "No"}</span></p>)}</div>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p><b>Confirmation:</b> {row.confirmationAccepted ? "Accepted" : "Not accepted"}</p>
          <p><b>Declaration version:</b> {row.declarationVersion}</p>
          <p><b>Related shift:</b> {row.shiftId || "Unscheduled clock-in"}</p>
          <p><b>Related clock-in:</b> {row.clockInId || "None (clock-in blocked or pending)"}</p>
        </div>
        {row.status === "flagged" && <><Textarea placeholder="Optional review note" value={notes[row.id] || ""} onChange={e => setNotes(n => ({ ...n, [row.id]: e.target.value }))} /><div className="flex gap-2"><Button onClick={() => review.mutate({ id: row.id, decision: "cleared" })}>Clear for Work</Button><Button variant="outline" onClick={() => review.mutate({ id: row.id, decision: "blocked" })}>Keep Blocked</Button></div></>}
        {row.reviews?.length > 0 && <p className="text-xs text-muted-foreground">Latest review: {row.reviews[0].decision} at {formatCompanyInstant(row.reviews[0].createdAt, timezone, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p>}
      </CardContent></Card>;
    })}
    {!isLoading && !isError && !data.length && <p className="text-muted-foreground">No submissions yet.</p>}
  </div>;
}
