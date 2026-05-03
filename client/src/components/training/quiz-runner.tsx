import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Lock, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight,
  Award, RotateCcw, Trophy,
} from "lucide-react";

export type QuizQuestion = {
  id: string;
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | string;
  optionsJson: string | null;
  sortOrder: number;
};

export type QuizPayload = {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    allowRetake: boolean;
    showCorrectAnswers: boolean;
    isRequired: boolean;
    questions: QuizQuestion[];
  };
  modulesComplete: boolean;
  attemptCount: number;
  lastAttempt: { id: string; score: number | null; passed: boolean; completedAt: string | null } | null;
  hasPassed: boolean;
  canRetake: boolean;
};

export type QuizSubmitResult = {
  score: number;
  passed: boolean;
  passingScore: number;
  correctCount: number;
  total: number;
  review: { questionId: string; given: any; isCorrect: boolean; correctAnswer?: any; explanation?: string | null }[];
  certificate: { certificateCode: string; issuedAt: string } | null;
};

function parseOptions(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch { return []; }
}

export function QuizRunner({
  payload,
  onStart,
  onSubmit,
  onPassed,
}: {
  payload: QuizPayload;
  onStart: () => Promise<{ attemptId: string }>;
  onSubmit: (attemptId: string, answers: Record<string, any>) => Promise<QuizSubmitResult>;
  onPassed?: (cert: { certificateCode: string; issuedAt: string } | null) => void;
}) {
  const { toast } = useToast();
  const { quiz, modulesComplete, hasPassed, lastAttempt, canRetake } = payload;
  const [stage, setStage] = useState<"intro" | "running" | "result">("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [idx, setIdx] = useState(0);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);

  const sorted = useMemo(() => [...quiz.questions].sort((a, b) => a.sortOrder - b.sortOrder), [quiz.questions]);
  const total = sorted.length;
  const current = sorted[idx];
  const answeredCount = sorted.filter(q => answers[q.id] !== undefined && answers[q.id] !== "").length;
  const allAnswered = answeredCount === total;

  // Locked: modules not complete yet
  if (!modulesComplete && stage === "intro") {
    return (
      <div className="border border-border rounded-xl p-6 bg-muted/20 text-center">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <div className="font-semibold text-foreground">Final Quiz Locked</div>
        <p className="text-sm text-muted-foreground mt-1">Complete all modules to unlock the quiz.</p>
        <div className="text-xs text-muted-foreground mt-3">{total} questions · pass at {quiz.passingScore}%</div>
      </div>
    );
  }

  // Already passed
  if (hasPassed && stage === "intro") {
    return (
      <div className="border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center">
        <Trophy className="w-10 h-10 mx-auto text-green-600 mb-2" />
        <div className="font-semibold text-foreground">Quiz Passed!</div>
        {lastAttempt && (
          <div className="text-sm text-muted-foreground mt-1">
            Your score: <span className="font-bold text-green-700 dark:text-green-400">{lastAttempt.score}%</span> · passing {quiz.passingScore}%
          </div>
        )}
      </div>
    );
  }

  // Intro / retake screen
  if (stage === "intro") {
    const previouslyFailed = lastAttempt && !lastAttempt.passed;
    return (
      <div className="border border-border rounded-xl p-6 bg-card">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-foreground">{quiz.title || "Final Quiz"}</div>
            {quiz.description && <p className="text-sm text-muted-foreground mt-0.5">{quiz.description}</p>}
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <Badge variant="outline">{total} questions</Badge>
              <Badge variant="outline">Pass at {quiz.passingScore}%</Badge>
              {quiz.allowRetake && <Badge variant="outline">Retakes allowed</Badge>}
              {quiz.isRequired && <Badge className="bg-red-500 text-white">Required for certificate</Badge>}
            </div>
          </div>
        </div>
        {previouslyFailed && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-red-700 dark:text-red-400">Last attempt: {lastAttempt!.score}%</span>
              <span className="text-muted-foreground"> · need {quiz.passingScore}% to pass</span>
            </div>
          </div>
        )}
        {!canRetake && previouslyFailed && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
            Retakes are not allowed for this quiz. Please contact your administrator.
          </div>
        )}
        <Button
          className="w-full"
          disabled={starting || (!canRetake && !!previouslyFailed)}
          onClick={async () => {
            try {
              setStarting(true);
              const res = await onStart();
              setAttemptId(res.attemptId);
              setAnswers({});
              setIdx(0);
              setStage("running");
            } catch (e: any) {
              toast({ title: "Couldn't start quiz", description: e.message, variant: "destructive" });
            } finally { setStarting(false); }
          }}
          data-testid="btn-quiz-start">
          {starting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ClipboardList className="w-4 h-4 mr-1" />}
          {previouslyFailed ? "Try Again" : "Start Quiz"}
        </Button>
      </div>
    );
  }

  // Running
  if (stage === "running" && current) {
    const opts = parseOptions(current.optionsJson);
    const val = answers[current.id] ?? "";
    const setVal = (v: any) => setAnswers(prev => ({ ...prev, [current.id]: v }));
    const pct = Math.round(((idx + 1) / total) * 100);

    return (
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        {/* Progress */}
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Question {idx + 1} of {total}</span>
            <span>{answeredCount}/{total} answered</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-base font-medium text-foreground" data-testid={`text-question-${current.id}`}>
            {current.questionText}
          </div>

          {current.questionType === "multiple_choice" && (
            <div className="space-y-2">
              {opts.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVal(opt)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    val === opt
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/40 text-foreground"
                  }`}
                  data-testid={`btn-option-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${val === opt ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                      {val === opt && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-sm">{opt}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {current.questionType === "true_false" && (
            <div className="grid grid-cols-2 gap-3">
              {["True", "False"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setVal(opt)}
                  className={`px-4 py-4 rounded-lg border-2 font-medium transition-all ${
                    val === opt ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                  data-testid={`btn-tf-${opt.toLowerCase()}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {current.questionType === "short_answer" && (
            <Input
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="Type your answer…"
              data-testid="input-short-answer"
            />
          )}
        </div>

        <div className="px-4 py-3 border-t border-border bg-muted/10 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={idx === 0}
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            data-testid="btn-quiz-prev">
            <ChevronLeft className="w-4 h-4 mr-1" />Previous
          </Button>
          {idx < total - 1 ? (
            <Button
              size="sm"
              onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
              data-testid="btn-quiz-next">
              Next<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!allAnswered || submitting || !attemptId}
              onClick={async () => {
                if (!attemptId) return;
                try {
                  setSubmitting(true);
                  const r = await onSubmit(attemptId, answers);
                  setResult(r);
                  setStage("result");
                  if (r.passed && onPassed) onPassed(r.certificate);
                } catch (e: any) {
                  toast({ title: "Submission failed", description: e.message, variant: "destructive" });
                } finally { setSubmitting(false); }
              }}
              data-testid="btn-quiz-submit">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Submit ({answeredCount}/{total})
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Result
  if (stage === "result" && result) {
    const showReview = quiz.showCorrectAnswers || result.passed;
    return (
      <div className="space-y-4">
        <div className={`border rounded-xl p-6 text-center ${
          result.passed
            ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
            : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
        }`}>
          {result.passed ? (
            <Trophy className="w-12 h-12 mx-auto text-green-600 mb-2" />
          ) : (
            <XCircle className="w-12 h-12 mx-auto text-red-500 mb-2" />
          )}
          <div className="text-lg font-bold text-foreground" data-testid="text-quiz-result-status">
            {result.passed ? "You Passed! 🎉" : "Not Quite — Try Again"}
          </div>
          <div className="mt-2 text-3xl font-bold" data-testid="text-quiz-score">
            <span className={result.passed ? "text-green-600" : "text-red-500"}>{result.score}%</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {result.correctCount} of {result.total} correct · pass at {result.passingScore}%
          </div>
          {result.passed && result.certificate && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-full text-sm text-amber-800 dark:text-amber-300">
              <Award className="w-4 h-4" />
              Certificate earned!
            </div>
          )}
        </div>

        {showReview && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Review</div>
            {sorted.map((q, i) => {
              const r = result.review.find(rv => rv.questionId === q.id);
              if (!r) return null;
              return (
                <div key={q.id} className={`border rounded-lg p-4 ${r.isCorrect ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}`}>
                  <div className="flex items-start gap-2">
                    {r.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{i + 1}. {q.questionText}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Your answer: <span className={r.isCorrect ? "text-green-600 font-medium" : "text-red-500"}>{String(r.given ?? "—")}</span>
                      </div>
                      {!r.isCorrect && r.correctAnswer !== undefined && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Correct: <span className="text-green-600 font-medium">{String(r.correctAnswer)}</span>
                        </div>
                      )}
                      {r.explanation && (
                        <div className="text-xs text-muted-foreground mt-1.5 italic">{r.explanation}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!result.passed && quiz.allowRetake && (
          <Button
            className="w-full"
            onClick={() => { setStage("intro"); setResult(null); setAnswers({}); setIdx(0); setAttemptId(null); }}
            data-testid="btn-quiz-retake">
            <RotateCcw className="w-4 h-4 mr-1" />Retake Quiz
          </Button>
        )}
      </div>
    );
  }

  return null;
}
