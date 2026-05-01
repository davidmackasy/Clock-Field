import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, ChevronRight, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type TodayItem = {
  assignment: { id: string; templateId: string; cleanerId: string; clientId: string | null; status: string };
  template: { id: string; name: string; description: string; introText: string; outroText: string; requiredBeforeClockOut: boolean; stepCount: number; requiredStepCount: number; status: string };
  submission: { id: string; status: string; completedSteps: number; totalSteps: number } | null;
  clientName: string | null;
  today: string;
};

export default function EmployeeScheduledFieldNotesList() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: items, isLoading } = useQuery<TodayItem[]>({
    queryKey: ["/api/employee/scheduled-field-notes/today"],
    refetchInterval: 30_000,
  });

  const startSubmission = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiRequest("POST", "/api/employee/scheduled-field-notes/start", { assignmentId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/scheduled-field-notes/today"] });
      navigate(`/employee/scheduled-field-notes/${data.id}`);
    },
    onError: () => toast({ title: "Could not start checklist", variant: "destructive" }),
  });

  const handleOpen = (item: TodayItem) => {
    if (item.submission) {
      navigate(`/employee/scheduled-field-notes/${item.submission.id}`);
    } else {
      startSubmission.mutate(item.assignment.id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-background border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />Scheduled Checklists
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Today's required photo checklists</p>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {isLoading ? (
          [...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : !items?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-base">No checklists for today</p>
            <p className="text-sm mt-1">Your assigned checklists will appear here</p>
          </div>
        ) : (
          items.map((item) => {
            const { template, submission, clientName } = item;
            const isComplete = submission?.status === "completed";
            const isInProgress = submission?.status === "in_progress";
            const notStarted = !submission;
            const progress = submission ? Math.round((submission.completedSteps / Math.max(submission.totalSteps, 1)) * 100) : 0;

            return (
              <button
                key={item.assignment.id}
                data-testid={`card-sfn-${item.assignment.id}`}
                onClick={() => handleOpen(item)}
                disabled={startSubmission.isPending}
                className={cn(
                  "w-full text-left border rounded-2xl overflow-hidden transition-all active:scale-[0.99]",
                  isComplete ? "border-green-200 bg-green-50/50" : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
                )}
              >
                {/* Status bar */}
                <div className={cn("h-1 w-full", isComplete ? "bg-green-400" : isInProgress ? "bg-blue-400" : "bg-muted")} />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      isComplete ? "bg-green-100" : isInProgress ? "bg-blue-100" : "bg-muted")}>
                      {isComplete ? <CheckCircle2 className="w-5 h-5 text-green-600" /> :
                        isInProgress ? <Clock className="w-5 h-5 text-blue-600" /> :
                          <ClipboardList className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <p className="font-semibold text-sm">{template.name}</p>
                        {startSubmission.isPending && startSubmission.variables === item.assignment.id
                          ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </div>
                      {clientName && <p className="text-xs text-muted-foreground mt-0.5">{clientName}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn("text-xs font-medium",
                          isComplete ? "text-green-700" : isInProgress ? "text-blue-700" : "text-muted-foreground")}>
                          {isComplete ? "Completed" : isInProgress ? `${submission.completedSteps}/${submission.totalSteps} steps done` : `${template.requiredStepCount} steps required`}
                        </span>
                        {template.requiredBeforeClockOut && !isComplete && (
                          <span className="flex items-center gap-1 text-[11px] text-orange-600">
                            <AlertCircle className="w-3 h-3" />Required before clock-out
                          </span>
                        )}
                      </div>
                      {isInProgress && submission && submission.totalSteps > 0 && (
                        <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
