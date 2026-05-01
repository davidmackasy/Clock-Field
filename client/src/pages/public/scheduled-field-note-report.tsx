import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Camera, ClipboardCheck, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type PublicReport = {
  companyName: string;
  companyLogo: string | null;
  templateName: string;
  introText: string;
  outroText: string;
  clientName: string | null;
  cleanerName: string | null;
  submissionDate: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalSteps: number;
  completedSteps: number;
  sections: {
    id: string; title: string; sortOrder: number;
    steps: {
      id: string; title: string; description: string;
      isRequired: boolean; sortOrder: number;
      submission: { id: string; submittedImageUrl: string; submittedAt: string } | null;
    }[];
  }[];
};

export default function PublicScheduledFieldNoteReport() {
  const [, params] = useRoute("/public/scheduled-field-notes/:publicId");
  const publicId = params?.publicId || "";

  const { data: report, isLoading, isError } = useQuery<PublicReport>({
    queryKey: ["/api/public/scheduled-field-notes", publicId],
    queryFn: () => fetch(`/api/public/scheduled-field-notes/${publicId}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    enabled: !!publicId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-10 rounded-xl" />
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Report Not Found</h1>
          <p className="text-muted-foreground text-sm">This report is not available or the link has been disabled.</p>
        </div>
      </div>
    );
  }

  const completedSteps = report.sections.flatMap(s => s.steps).filter(s => s.submission).length;
  const totalSteps = report.sections.flatMap(s => s.steps).length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {report.companyLogo ? (
              <img src={report.companyLogo} alt={report.companyName} className="w-14 h-14 rounded-xl object-cover border" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{report.companyName}</p>
              <h1 className="text-2xl font-bold">{report.templateName}</h1>
              {report.clientName && <p className="text-sm text-muted-foreground mt-0.5">{report.clientName}</p>}
            </div>
          </div>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>📅 {format(parseISO(report.submissionDate), "MMMM d, yyyy")}</span>
            {report.cleanerName && <span>👤 {report.cleanerName}</span>}
            {report.completedAt && <span>✓ Completed {format(parseISO(report.completedAt), "h:mm a")}</span>}
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">{completedSteps} of {totalSteps} steps completed</span>
              <span className={cn("font-medium", report.status === "completed" ? "text-green-600" : "text-blue-600")}>
                {report.status === "completed" ? "✓ Complete" : `${progressPct}%`}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={cn("h-full rounded-full transition-all", report.status === "completed" ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {report.introText && (
            <p className="mt-4 text-sm text-muted-foreground bg-gray-50 rounded-xl p-3 border">{report.introText}</p>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {(report.sections || []).sort((a, b) => a.sortOrder - b.sortOrder).map(section => (
          <div key={section.id}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">{section.title}</h2>
            <div className="space-y-4">
              {(section.steps || []).sort((a, b) => a.sortOrder - b.sortOrder).map((step, idx) => (
                <div key={step.id} className={cn("bg-white rounded-2xl overflow-hidden shadow-sm border", step.submission ? "border-green-100" : "border-gray-100")}>
                  {/* Step header */}
                  <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-50">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5",
                      step.submission ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                      {step.submission ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{step.title}</p>
                      {step.description && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                    </div>
                    {!step.isRequired && (
                      <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Optional</span>
                    )}
                  </div>

                  {/* Photos */}
                  <div className={cn("grid gap-px", step.submission?.submittedImageUrl ? "grid-cols-2" : "grid-cols-1")}>
                    {step.submission?.submittedImageUrl ? (
                      <>
                        {/* Reference vs Submitted */}
                        {step.submission && (
                          <div className="relative">
                            <img src={step.submission.submittedImageUrl} alt="Submitted" className="w-full h-48 object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <p className="text-white text-[11px] font-medium">Your Photo</p>
                              <p className="text-white/70 text-[10px]">{format(parseISO(step.submission.submittedAt), "h:mm a")}</p>
                            </div>
                          </div>
                        )}
                        {/* Only show the ref photo column if it exists */}
                        {/* no reference photo shown on public report for privacy - only submitted */}
                      </>
                    ) : (
                      <div className="h-24 flex items-center justify-center bg-gray-50 text-muted-foreground gap-2">
                        <Camera className="w-5 h-5 opacity-30" />
                        <span className="text-xs">No photo submitted</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {report.outroText && (
          <div className="bg-white rounded-2xl p-5 border text-center shadow-sm">
            <ClipboardCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{report.outroText}</p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-8">Report generated by {report.companyName}</p>
      </div>
    </div>
  );
}
