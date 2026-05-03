import OpenAI from "openai";

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  _client = new OpenAI({ apiKey: key });
  return _client;
}

const MODEL = "gpt-4o-mini";

export type ToneOption = "simple" | "professional" | "safety_focused" | "beginner_friendly";

export interface GenerateCourseInput {
  topic: string;
  industry?: string;
  employeeLevel?: string;
  trainingGoal?: string;
  moduleCount?: number;
  includeQuiz?: boolean;
  tone?: ToneOption;
}

export interface AIQuizQuestion {
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
}

export interface AIModuleDraft {
  title: string;
  description: string;
  lessonText: string;
  keyPoints: string[];
  checklist: string[];
  safetyNotes: string[];
}

export interface AICourseDraft {
  title: string;
  description: string;
  category: string;
  estimatedDuration: string;
  learningObjectives: string[];
  modules: AIModuleDraft[];
  suggestedQuiz: AIQuizQuestion[];
  certificateText: string;
  publicIntro: string;
}

const TONE_GUIDANCE: Record<ToneOption, string> = {
  simple: "Use plain, easy-to-read language. Short sentences. Avoid jargon. Aim for a 6th-grade reading level.",
  professional: "Use polished, business-professional language suitable for corporate training. Clear, confident, and structured.",
  safety_focused: "Foreground safety, hazards, PPE, and compliance. Use cautionary phrasing where appropriate. Cite OSHA-style best practices generally without inventing specific regulation numbers.",
  beginner_friendly: "Assume zero prior knowledge. Define terms when first used. Encouraging and patient tone.",
};

function tonePreamble(tone?: ToneOption): string {
  return tone ? TONE_GUIDANCE[tone] : TONE_GUIDANCE.professional;
}

async function chatJSON(systemPrompt: string, userPrompt: string, maxTokens = 1800): Promise<any> {
  const client = getClient();
  if (!client) throw new Error("AI not available: OPENAI_API_KEY missing");
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.5,
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content?.trim() || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function chatText(systemPrompt: string, userPrompt: string, maxTokens = 400): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("AI not available: OPENAI_API_KEY missing");
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.5,
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

// ── Course draft (wizard step 2) ────────────────────────────────────────────
export async function generateCourseDraft(input: GenerateCourseInput): Promise<AICourseDraft> {
  const moduleCount = Math.max(2, Math.min(12, input.moduleCount ?? 5));
  const includeQuiz = input.includeQuiz !== false;
  const quizCount = includeQuiz ? 10 : 0;

  const system = [
    "You are an expert instructional designer building employee training courses.",
    tonePreamble(input.tone),
    "Always return valid JSON matching the requested schema. Never invent specific regulation citations or proprietary product names.",
    "Lesson text should be 80-160 words per module — practical and direct, not fluffy.",
  ].join(" ");

  const user = [
    `Generate a training course draft for the following topic.`,
    ``,
    `Topic: ${input.topic}`,
    input.industry ? `Industry: ${input.industry}` : "",
    input.employeeLevel ? `Employee level: ${input.employeeLevel}` : "",
    input.trainingGoal ? `Training goal: ${input.trainingGoal}` : "",
    `Number of modules: ${moduleCount}`,
    includeQuiz ? `Include a final quiz with ${quizCount} questions (mix of multiple_choice, true_false, and short_answer).` : `Do NOT include a quiz; return suggestedQuiz: [].`,
    ``,
    `Return JSON exactly matching this shape (no extra fields):`,
    `{`,
    `  "title": string,                     // ~6 words, action-oriented`,
    `  "description": string,               // 2-3 sentences`,
    `  "category": string,                  // one of: Compliance, Safety, Skills, Onboarding, Operations`,
    `  "estimatedDuration": string,         // e.g. "30 min", "1 hour", "2 hours"`,
    `  "learningObjectives": string[],      // 3-6 outcome-based bullets starting with verbs (Identify, Demonstrate, Apply...)`,
    `  "modules": [`,
    `    {`,
    `      "title": string,`,
    `      "description": string,           // 1 sentence`,
    `      "lessonText": string,            // 80-160 words, practical, no fluff`,
    `      "keyPoints": string[],           // 3-5 short bullets`,
    `      "checklist": string[],           // 3-6 actionable verify-items`,
    `      "safetyNotes": string[]          // 0-3 cautions; empty array if not safety-relevant`,
    `    }`,
    `  ],`,
    `  "suggestedQuiz": [`,
    `    {`,
    `      "questionText": string,`,
    `      "questionType": "multiple_choice" | "true_false" | "short_answer",`,
    `      "options": string[],             // 4 options for multiple_choice; ["True","False"] for true_false; omit for short_answer`,
    `      "correctAnswer": string,         // for short_answer: a 1-5 word ideal answer; for others: the exact option text`,
    `      "explanation": string            // 1 sentence why`,
    `    }`,
    `  ],`,
    `  "certificateText": string,           // 1-2 sentence official certificate body, no signatures`,
    `  "publicIntro": string                // 30-50 word welcoming intro for the public-facing course landing page`,
    `}`,
  ].filter(Boolean).join("\n");

  const data = await chatJSON(system, user, 3500);
  return normalizeCourseDraft(data, moduleCount);
}

function normalizeCourseDraft(data: any, expectedModules: number): AICourseDraft {
  const modules: AIModuleDraft[] = Array.isArray(data?.modules) ? data.modules.slice(0, 12).map((m: any) => ({
    title: String(m?.title ?? "Untitled module"),
    description: String(m?.description ?? ""),
    lessonText: String(m?.lessonText ?? ""),
    keyPoints: Array.isArray(m?.keyPoints) ? m.keyPoints.map(String) : [],
    checklist: Array.isArray(m?.checklist) ? m.checklist.map(String) : [],
    safetyNotes: Array.isArray(m?.safetyNotes) ? m.safetyNotes.map(String) : [],
  })) : [];

  const suggestedQuiz: AIQuizQuestion[] = Array.isArray(data?.suggestedQuiz) ? data.suggestedQuiz.slice(0, 25).map(normalizeQuestion).filter(Boolean) as AIQuizQuestion[] : [];

  return {
    title: String(data?.title ?? "Untitled Course"),
    description: String(data?.description ?? ""),
    category: String(data?.category ?? "Skills"),
    estimatedDuration: String(data?.estimatedDuration ?? `${expectedModules * 10} min`),
    learningObjectives: Array.isArray(data?.learningObjectives) ? data.learningObjectives.map(String) : [],
    modules,
    suggestedQuiz,
    certificateText: String(data?.certificateText ?? ""),
    publicIntro: String(data?.publicIntro ?? ""),
  };
}

function normalizeQuestion(q: any): AIQuizQuestion | null {
  if (!q || typeof q.questionText !== "string") return null;
  const type = q.questionType === "true_false" || q.questionType === "short_answer" ? q.questionType : "multiple_choice";
  let options: string[] | undefined;
  if (type === "multiple_choice") {
    options = Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [];
    if (!options || options.length < 2) return null;
  } else if (type === "true_false") {
    options = ["True", "False"];
  }
  return {
    questionText: String(q.questionText),
    questionType: type,
    options,
    correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : Array.isArray(q.correctAnswer) ? q.correctAnswer.map(String) : String(q.correctAnswer ?? ""),
    explanation: typeof q.explanation === "string" ? q.explanation : undefined,
  };
}

// ── Single-text actions (improve / professional / shorter / clearer / safety / grammar) ──
export type ImproveAction =
  | "improve" | "fix_grammar" | "make_clearer" | "make_shorter"
  | "make_professional" | "make_safety_focused" | "make_beginner_friendly"
  | "intro" | "summary" | "certificate_text" | "public_intro";

const IMPROVE_PROMPTS: Record<ImproveAction, string> = {
  improve: "Improve the following training content to be clearer, more useful, and more engaging while preserving meaning. Return only the improved text.",
  fix_grammar: "Fix grammar, spelling, and punctuation in the following text. Do not change meaning or style. Return only the corrected text.",
  make_clearer: "Rewrite the following text to be clearer and easier to understand. Use shorter sentences and concrete examples. Return only the rewritten text.",
  make_shorter: "Rewrite the following text more concisely. Cut filler. Preserve all key facts. Return only the shortened text.",
  make_professional: "Rewrite the following text in a polished, professional business tone suitable for employee training. Return only the rewritten text.",
  make_safety_focused: "Rewrite the following text to foreground safety: hazards, PPE, prevention, and compliance. Add cautionary phrasing where appropriate. Return only the rewritten text.",
  make_beginner_friendly: "Rewrite the following text for an absolute beginner. Define terms on first use. Use a patient, encouraging tone. Return only the rewritten text.",
  intro: "Write a short engaging intro paragraph (2-3 sentences) for a training course on the following topic. Return only the paragraph.",
  summary: "Summarize the following training content in 2-3 sentences. Return only the summary.",
  certificate_text: "Write 1-2 sentences of official certificate body text for a training course on the following topic. Suitable to print on a certificate. No signatures, no dates. Return only the text.",
  public_intro: "Write a 30-50 word welcoming intro for the public-facing landing page of a training course on the following topic. Return only the intro.",
};

export async function improveText(text: string, action: ImproveAction, _context?: string): Promise<string> {
  const prompt = IMPROVE_PROMPTS[action] ?? IMPROVE_PROMPTS.improve;
  return chatText(prompt, text, 500);
}

// ── Quiz generation from course context ─────────────────────────────────────
export async function generateQuizFromCourse(args: {
  courseTitle: string;
  courseDescription?: string | null;
  modules: { title: string; description?: string | null; lessonText?: string | null }[];
  count?: number;
  tone?: ToneOption;
}): Promise<AIQuizQuestion[]> {
  const count = Math.max(3, Math.min(30, args.count ?? 15));
  const system = [
    "You are an expert quiz designer for employee training courses.",
    tonePreamble(args.tone),
    "Each question must be answerable from the course content provided. Avoid trick questions. Mix question types.",
    "Return valid JSON only.",
  ].join(" ");

  const moduleSummary = args.modules.map((m, i) => {
    const parts = [`Module ${i + 1}: ${m.title}`];
    if (m.description) parts.push(`  Description: ${m.description}`);
    if (m.lessonText) parts.push(`  Content: ${m.lessonText.slice(0, 600)}`);
    return parts.join("\n");
  }).join("\n\n");

  const user = [
    `Course: ${args.courseTitle}`,
    args.courseDescription ? `Description: ${args.courseDescription}` : "",
    ``,
    `Modules:`,
    moduleSummary,
    ``,
    `IMPORTANT: Only generate questions whose answers are explicitly supported by the module content above. Do not invent facts, regulations, or specifications that are not stated.`,
    ``,
    `Generate ${count} quiz questions covering the modules above. Aim for roughly:`,
    `- 60% multiple_choice (4 options each)`,
    `- 25% true_false`,
    `- 15% short_answer (correctAnswer should be 1-5 words)`,
    ``,
    `Return JSON: { "questions": [ { "questionText", "questionType", "options"?, "correctAnswer", "explanation" } ] }`,
  ].filter(Boolean).join("\n");

  const data = await chatJSON(system, user, 3000);
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  return questions.map(normalizeQuestion).filter(Boolean) as AIQuizQuestion[];
}

// ── Module content generation ───────────────────────────────────────────────
export async function generateModuleContent(args: {
  moduleTitle: string;
  courseTitle?: string;
  courseDescription?: string | null;
  tone?: ToneOption;
}): Promise<AIModuleDraft> {
  const system = [
    "You are an instructional designer writing a single training module.",
    tonePreamble(args.tone),
    "Be concrete and practical. No filler. Return valid JSON only.",
  ].join(" ");

  const user = [
    args.courseTitle ? `Course: ${args.courseTitle}` : "",
    args.courseDescription ? `Course context: ${args.courseDescription}` : "",
    `Module title: ${args.moduleTitle}`,
    ``,
    `Generate the module body. Return JSON:`,
    `{`,
    `  "title": string,                 // refined title`,
    `  "description": string,           // 1 sentence`,
    `  "lessonText": string,            // 80-160 words`,
    `  "keyPoints": string[],           // 3-5 bullets`,
    `  "checklist": string[],           // 3-6 verify-items`,
    `  "safetyNotes": string[]          // 0-3; empty array if N/A`,
    `}`,
  ].filter(Boolean).join("\n");

  const data = await chatJSON(system, user, 1200);
  return {
    title: String(data?.title ?? args.moduleTitle),
    description: String(data?.description ?? ""),
    lessonText: String(data?.lessonText ?? ""),
    keyPoints: Array.isArray(data?.keyPoints) ? data.keyPoints.map(String) : [],
    checklist: Array.isArray(data?.checklist) ? data.checklist.map(String) : [],
    safetyNotes: Array.isArray(data?.safetyNotes) ? data.safetyNotes.map(String) : [],
  };
}

export function isAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
