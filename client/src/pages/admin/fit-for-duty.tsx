import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminFitForDuty() {
  const { data = [], isLoading, isError } = useQuery<any[]>({ queryKey: ["/api/admin/fit-for-duty"] });
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
      return <Card key={row.id}><CardHeader><CardTitle className="flex justify-between text-base"><span>{row.employeeName} ({row.employeeNumber || "No ID"})</span><Badge variant={row.status === "flagged" ? "destructive" : "secondary"}>{row.status}</Badge></CardTitle><p className="text-sm text-muted-foreground">{row.locationName} · {new Date(row.acceptedAt).toLocaleString()}</p></CardHeader><CardContent className="space-y-3">
        <div className="space-y-1 text-sm">{questions.map((q: string, i: number) => <p key={q}><b>{i + 1}.</b> {q} — <span className="font-semibold">{answers[i] ? "Yes" : "No"}</span></p>)}</div>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p><b>Confirmation:</b> {row.confirmationAccepted ? "Accepted" : "Not accepted"}</p>
          <p><b>Declaration version:</b> {row.declarationVersion}</p>
          <p><b>Related shift:</b> {row.shiftId || "Unscheduled clock-in"}</p>
          <p><b>Related clock-in:</b> {row.clockInId || "None (clock-in blocked or pending)"}</p>
        </div>
        {row.status === "flagged" && <><Textarea placeholder="Optional review note" value={notes[row.id] || ""} onChange={e => setNotes(n => ({ ...n, [row.id]: e.target.value }))} /><div className="flex gap-2"><Button onClick={() => review.mutate({ id: row.id, decision: "cleared" })}>Clear for Work</Button><Button variant="outline" onClick={() => review.mutate({ id: row.id, decision: "blocked" })}>Keep Blocked</Button></div></>}
        {row.reviews?.length > 0 && <p className="text-xs text-muted-foreground">Latest review: {row.reviews[0].decision} at {new Date(row.reviews[0].createdAt).toLocaleString()}</p>}
      </CardContent></Card>;
    })}
    {!isLoading && !isError && !data.length && <p className="text-muted-foreground">No submissions yet.</p>}
  </div>;
}