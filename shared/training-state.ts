/** One completion rule for learner views, admin reporting and certificates. */
export function trainingState(modules: { id: string; isRequired?: boolean }[], completedIds: Set<string>, quiz: { isRequired?: boolean; questions?: unknown[] } | null | undefined, quizPassed: boolean) {
  const completedModules = modules.filter(module => completedIds.has(module.id)).length;
  const required = modules.filter(module => module.isRequired);
  const needed = required.length ? required : modules;
  const modulesComplete = modules.length > 0 && needed.every(module => completedIds.has(module.id));
  const hasQuiz = !!quiz && (quiz.questions?.length ?? 0) > 0;
  const quizRequired = hasQuiz && !!quiz?.isRequired;
  const quizPending = modulesComplete && quizRequired && !quizPassed;
  const isCompleted = modulesComplete && (!quizRequired || quizPassed);
  const lessonPct = modules.length ? Math.round(completedModules / modules.length * 100) : 0;
  const progressPct = isCompleted ? 100 : quizPending ? 90 : Math.min(lessonPct, 99);
  return { totalModules: modules.length, completedModules, modulesComplete, hasQuiz, quizRequired, quizPassed, quizPending, isCompleted, progressPct, status: isCompleted ? 'completed' as const : completedModules > 0 ? 'in_progress' as const : 'not_started' as const };
}
