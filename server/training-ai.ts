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

export type QuestionTypeMix = {
  multiple_choice?: boolean;
  true_false?: boolean;
  short_answer?: boolean;
};

export interface GenerateCourseInput {
  topic: string;
  industry?: string;
  employeeLevel?: string;
  trainingGoal?: string;
  moduleCount?: number;
  includeQuiz?: boolean;
  quizQuestionCount?: number;
  questionTypeMix?: QuestionTypeMix;
  passingScore?: number;
  wantVideos?: boolean;
  wantImages?: boolean;
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
  overview: string;
  lessonText: string;
  stepByStep: string[];
  keyPoints: string[];
  checklist: string[];
  commonMistakes: string[];
  safetyNotes: string[];
  keyTakeaways: string[];
  imagePrompt?: string;
  // Optional storytelling fields used by /generate-blocks to compose
  // type-specific block flows (hook → scenario → image → ...). All are
  // optional so older AI responses still normalize cleanly.
  hook?: string;
  scenario?: string;
  quickTip?: string;
  recap?: string;
  example?: string;
}

// ── Course-type detection & adaptive guidance ───────────────────────────────
// We detect the type from the topic/title and adapt the prompt + block
// composition. Detection is heuristic only (keyword based) — no schema or
// API changes are needed because the type is never persisted; it just shapes
// the AI prompt and the block layout the route emits.
export type CourseType = "cleaning" | "safety" | "equipment" | "customer_service" | "general";

export function detectCourseType(...texts: (string | null | undefined)[]): CourseType {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (!t) return "general";
  // Order matters — safety wins over cleaning when both appear (e.g. "safe
  // chemical handling" should be safety, not cleaning).
  if (/\b(safety|hazard|osha|ppe|injury|slip|fall|chemical spill|fire|emergency|lockout|tagout|incident|risk|prevention)\b/.test(t)) return "safety";
  if (/\b(equipment|machine|tool|vacuum|scrubber|buffer|extractor|polisher|pressure washer|gear|device|operate|operating)\b/.test(t)) return "equipment";
  // Customer-service detection: avoid the generic word "service" (which also
  // appears in "cleaning service", "field services", etc.). Match only on
  // higher-signal phrases.
  if (/\b(customer service|client communication|complaint|complaints|guest service|guest experience|hospitality|front desk|phone etiquette|email etiquette|greeting guests|handling clients|customer interaction)\b/.test(t)) return "customer_service";
  if (/\b(clean|cleaning|janitor|sanitiz|disinfect|mop|sweep|dust|restroom|washroom|bathroom|kitchen|floor|surface|stain|residue)\b/.test(t)) return "cleaning";
  return "general";
}

const COURSE_TYPE_GUIDANCE: Record<CourseType, string> = {
  cleaning:
    "COURSE TYPE: CLEANING. Prioritize real scenarios, visual explanations, step-by-step processes, and before/after thinking. Open with a vivid hook (e.g. 'You walk into a washroom and it smells bad…'). Show the difference between dirty and clean. Give exact processes. Use a quick tip (e.g. 'Always clean from top to bottom') and a common mistake (e.g. 'Using the same cloth everywhere'). Be practical and visual.",
  safety:
    "COURSE TYPE: SAFETY. Foreground hazards, consequences, awareness, and prevention. Open with a hook that conveys urgency (e.g. 'In one second, a wet floor can cause injury…'). Use a 'What would you do if…' scenario. Explain the risk clearly. Provide a checklist of safety actions. Call out the mistake of ignoring warning signs. Be cautious and aware.",
  equipment:
    "COURSE TYPE: EQUIPMENT TRAINING. Focus on how to use the tool, do's and don'ts, setup and handling. Open with a hook about the cost of misuse (e.g. 'Using this machine incorrectly can damage floors…'). Describe parts and functions, then give exact operating steps. Include a best-practice quick tip and a common misuse mistake. Be instructional.",
  customer_service:
    "COURSE TYPE: CUSTOMER SERVICE. Focus on behavior, communication, and real situations. Open with a scenario (e.g. 'A client complains about missed spots…'). Explain how to respond. Provide a quick tip on tone and wording. Include a good-vs-bad response example. Be conversational and human.",
  general:
    "COURSE TYPE: GENERAL. Write engaging, practical training. Open with a hook or scenario, vary pacing, and end with a clear takeaway. Avoid rigid templates.",
};

export function courseTypeGuidance(type: CourseType): string {
  return COURSE_TYPE_GUIDANCE[type];
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

function buildTypeMixGuidance(mix: QuestionTypeMix | undefined, count: number): string {
  const enabled: string[] = [];
  if (mix?.multiple_choice !== false) enabled.push("multiple_choice");
  if (mix?.true_false !== false) enabled.push("true_false");
  if (mix?.short_answer !== false) enabled.push("short_answer");
  if (enabled.length === 0) enabled.push("multiple_choice");
  if (enabled.length === 1) {
    return `All ${count} questions must be ${enabled[0]}.`;
  }
  // Suggest a balanced mix among enabled types.
  const lines: string[] = ["Use ONLY these question types:"];
  if (enabled.includes("multiple_choice")) lines.push("- multiple_choice (4 plausible options each, exactly one correct)");
  if (enabled.includes("true_false")) lines.push("- true_false");
  if (enabled.includes("short_answer")) lines.push("- short_answer (correctAnswer 1-5 words)");
  lines.push(`Distribute the ${count} questions roughly evenly across the enabled types.`);
  return lines.join("\n");
}

// ── Course draft (full course + final quiz in one shot) ─────────────────────
export async function generateCourseDraft(input: GenerateCourseInput): Promise<AICourseDraft> {
  const moduleCount = Math.max(2, Math.min(12, input.moduleCount ?? 5));
  const includeQuiz = input.includeQuiz !== false;
  const quizCount = includeQuiz ? Math.max(3, Math.min(30, input.quizQuestionCount ?? 15)) : 0;
  const passingScore = typeof input.passingScore === "number" ? Math.max(0, Math.min(100, input.passingScore)) : 80;
  const wantImages = !!input.wantImages;

  const courseType = detectCourseType(input.topic, input.industry, input.trainingGoal);
  const system = [
    "You are a senior instructional designer and storyteller building professional employee training courses for service industries (cleaning, janitorial, field services, hospitality).",
    tonePreamble(input.tone),
    courseTypeGuidance(courseType),
    "Build each module like a guided learning experience — NOT a rigid Overview→Lesson→Image→Checklist template. Vary pacing. Open with a hook or scenario, explain the concept in parts, place visuals between parts, and end with an action or takeaway. Never stack long text blocks back-to-back. Each module should feel different from the others.",
    "Always return valid JSON matching the requested schema. Never invent specific regulation citations or proprietary product names.",
    "Modules must be PRACTICAL, DETAILED, and USEFUL — not generic filler. Each lesson should give an employee everything they need to do the work correctly.",
    "Lesson text MUST be 200-400 words per module, organized as flowing paragraphs (not bullets).",
    // Quiz quality bar — harder, scenario-driven, real-world.
    "Quiz questions must be RIGOROUS: prefer realistic on-the-job scenarios over factual recall. Avoid obvious or giveaway answers. Rephrase concepts in the questions instead of copying module wording verbatim. Every distractor in a multiple_choice question must be plausible to someone who only skimmed the module. Every question MUST include a 1-sentence explanation of why the correct answer is right.",
  ].join(" ");

  const typeMixGuidance = includeQuiz ? buildTypeMixGuidance(input.questionTypeMix, quizCount) : "";

  const user = [
    `Generate a complete training course for the topic below. Generate EVERYTHING in one pass: course meta, modules with rich content, and final quiz (if requested).`,
    ``,
    `Topic: ${input.topic}`,
    input.industry ? `Industry: ${input.industry}` : "",
    input.employeeLevel ? `Audience: ${input.employeeLevel}` : "",
    input.trainingGoal ? `Training goal: ${input.trainingGoal}` : "",
    `Number of modules: ${moduleCount}`,
    includeQuiz
      ? `Final quiz: ${quizCount} questions based on the modules you generate. Passing score: ${passingScore}%. ${typeMixGuidance}\n` +
        `At least HALF of the multiple_choice questions must be scenario-based — phrased as a real situation the employee would face on the job (e.g. "You arrive at a client site and notice…", "A coworker spills…", "A customer complains that…"). Ask "what is the safest first action" or "what should you do next" rather than asking for a definition.\n` +
        `Do NOT lift wording verbatim from lessonText; rephrase. Distractors must look plausible. Every question must include an "explanation" string.`
      : `Do NOT include a quiz; return suggestedQuiz: [].`,
    wantImages ? `For each module include an "imagePrompt" — a short visual description an admin could use to find or generate a relevant header image.` : `imagePrompt may be empty string.`,
    ``,
    `Return JSON exactly matching this shape:`,
    `{`,
    `  "title": string,                     // ~6 words, action-oriented`,
    `  "description": string,               // 2-3 sentences`,
    `  "category": string,                  // one of: Compliance, Safety, Skills, Onboarding, Operations, Cleaning, Customer Service, Equipment`,
    `  "estimatedDuration": string,         // e.g. "30 min", "1 hour", "2 hours"`,
    `  "learningObjectives": string[],      // 3-6 outcome-based bullets starting with verbs (Identify, Demonstrate, Apply...)`,
    `  "modules": [`,
    `    {`,
    `      "title": string,`,
    `      "description": string,           // 1 sentence`,
    `      "overview": string,              // 2-3 sentences: what this module covers and why it matters`,
    `      "lessonText": string,            // 200-400 words of practical, detailed teaching content`,
    `      "stepByStep": string[],          // 4-8 ordered steps the employee performs`,
    `      "keyPoints": string[],           // 3-5 short reinforcement bullets`,
    `      "checklist": string[],           // 3-6 actionable verify-items the employee can tick off on the job`,
    `      "commonMistakes": string[],      // 2-4 frequent errors to avoid`,
    `      "safetyNotes": string[],         // 0-3 cautions; empty array if not safety-relevant`,
    `      "keyTakeaways": string[],        // 2-4 final-summary bullets`,
    `      "imagePrompt": string,           // short visual description, or "" if none`,
    `      "hook": string,                  // 1-2 sentence vivid opening that pulls the reader in. "" if not natural`,
    `      "scenario": string,              // 1-2 sentence "What would you do if…" or real-situation prompt. "" if not natural`,
    `      "quickTip": string,              // 1 sentence pithy practical tip. "" if not natural`,
    `      "example": string,               // 1-2 sentence good-vs-bad example. Customer-service modules SHOULD have this; others may use ""`,
    `      "recap": string                  // 1-2 sentence wrap-up the learner walks away with. "" if not natural`,
    `    }`,
    `  ],`,
    `  "suggestedQuiz": [`,
    `    {`,
    `      "questionText": string,          // anchored in the module content above`,
    `      "questionType": "multiple_choice" | "true_false" | "short_answer",`,
    `      "options": string[],             // 4 options for multiple_choice; ["True","False"] for true_false; omit for short_answer`,
    `      "correctAnswer": string,         // for short_answer: a 1-5 word ideal answer; for others: the exact option text`,
    `      "explanation": string            // 1 sentence why — required for every question`,
    `    }`,
    `  ],`,
    `  "certificateText": string,           // 1-2 sentence official certificate body, no signatures`,
    `  "publicIntro": string                // 30-50 word welcoming intro for the public-facing course landing page`,
    `}`,
  ].filter(Boolean).join("\n");

  const data = await chatJSON(system, user, 6000);
  return normalizeCourseDraft(data, moduleCount);
}

function normalizeCourseDraft(data: any, expectedModules: number): AICourseDraft {
  const modules: AIModuleDraft[] = Array.isArray(data?.modules) ? data.modules.slice(0, 12).map(normalizeModule) : [];
  const suggestedQuiz: AIQuizQuestion[] = Array.isArray(data?.suggestedQuiz) ? data.suggestedQuiz.slice(0, 30).map(normalizeQuestion).filter(Boolean) as AIQuizQuestion[] : [];
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

function asStringArray(v: any): string[] {
  return Array.isArray(v) ? v.map(String).filter(s => s.trim().length > 0) : [];
}

function normalizeModule(m: any): AIModuleDraft {
  const optStr = (v: any): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    title: String(m?.title ?? "Untitled module"),
    description: String(m?.description ?? ""),
    overview: String(m?.overview ?? ""),
    lessonText: String(m?.lessonText ?? ""),
    stepByStep: asStringArray(m?.stepByStep),
    keyPoints: asStringArray(m?.keyPoints),
    checklist: asStringArray(m?.checklist),
    commonMistakes: asStringArray(m?.commonMistakes),
    safetyNotes: asStringArray(m?.safetyNotes),
    keyTakeaways: asStringArray(m?.keyTakeaways),
    imagePrompt: typeof m?.imagePrompt === "string" ? m.imagePrompt : "",
    hook: optStr(m?.hook),
    scenario: optStr(m?.scenario),
    quickTip: optStr(m?.quickTip),
    recap: optStr(m?.recap),
    example: optStr(m?.example),
  };
}

function normalizeQuestion(q: any): AIQuizQuestion | null {
  if (!q || typeof q.questionText !== "string" || !q.questionText.trim()) return null;
  const type = q.questionType === "true_false" || q.questionType === "short_answer" ? q.questionType : "multiple_choice";
  let options: string[] | undefined;
  if (type === "multiple_choice") {
    options = Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [];
    if (!options || options.length < 2) return null;
  } else if (type === "true_false") {
    options = ["True", "False"];
  }
  return {
    questionText: String(q.questionText).trim(),
    questionType: type,
    options,
    correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : Array.isArray(q.correctAnswer) ? q.correctAnswer.map(String) : String(q.correctAnswer ?? ""),
    explanation: typeof q.explanation === "string" ? q.explanation : undefined,
  };
}

// ── Single-text actions ─────────────────────────────────────────────────────
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

// ── Quiz generation from existing course modules ────────────────────────────
export async function generateQuizFromCourse(args: {
  courseTitle: string;
  courseDescription?: string | null;
  modules: { title: string; description?: string | null; lessonText?: string | null }[];
  count?: number;
  questionTypeMix?: QuestionTypeMix;
  tone?: ToneOption;
}): Promise<AIQuizQuestion[]> {
  const count = Math.max(3, Math.min(30, args.count ?? 15));
  const system = [
    "You are an expert quiz designer for employee training courses.",
    tonePreamble(args.tone),
    "Each question must be answerable from the course content provided.",
    "RIGOR: prefer realistic on-the-job scenarios over factual recall. Avoid obvious or giveaway answers. Do not lift wording verbatim from lesson text — rephrase concepts. Every distractor in a multiple_choice question must be plausible to someone who only skimmed the modules. Every question MUST include a 1-sentence explanation of why the correct answer is right.",
    "Return valid JSON only.",
  ].join(" ");

  const moduleSummary = args.modules.map((m, i) => {
    const parts = [`Module ${i + 1}: ${m.title}`];
    if (m.description) parts.push(`  Description: ${m.description}`);
    if (m.lessonText) parts.push(`  Content: ${m.lessonText.slice(0, 800)}`);
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
    `Generate ${count} quiz questions covering the modules above.`,
    buildTypeMixGuidance(args.questionTypeMix, count),
    `At least HALF of the multiple_choice questions must be scenario-based — phrased as a real situation the employee would face on the job (e.g. "You arrive at a client site and notice…", "A coworker spills…", "A customer complains that…"). Ask "what is the safest first action" or "what should you do next" rather than asking for a definition.`,
    `Do NOT copy wording verbatim from the module content; rephrase. Distractors must look plausible.`,
    `Every question must include an "explanation" string of 1 sentence.`,
    ``,
    `Return JSON: { "questions": [ { "questionText", "questionType", "options"?, "correctAnswer", "explanation" } ] }`,
  ].filter(Boolean).join("\n");

  const data = await chatJSON(system, user, 4000);
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  return questions.map(normalizeQuestion).filter(Boolean) as AIQuizQuestion[];
}

// ── Single-module generation (richer, structured) ───────────────────────────
export async function generateModuleContent(args: {
  moduleTitle: string;
  courseTitle?: string;
  courseDescription?: string | null;
  tone?: ToneOption;
}): Promise<AIModuleDraft> {
  const courseType = detectCourseType(args.moduleTitle, args.courseTitle, args.courseDescription);
  const system = [
    "You are an instructional designer and storyteller writing a single, detailed training module.",
    tonePreamble(args.tone),
    courseTypeGuidance(courseType),
    "Build the module as a guided learning experience — NOT a rigid template. Open with a hook or scenario, explain the concept in parts, place visuals between parts, and end with an action or takeaway. Vary pacing. Be concrete, practical, and useful for a service-industry employee. No filler. Return valid JSON only.",
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
    `  "overview": string,              // 2-3 sentences`,
    `  "lessonText": string,            // 200-400 words of detailed teaching content`,
    `  "stepByStep": string[],          // 4-8 ordered steps`,
    `  "keyPoints": string[],           // 3-5 reinforcement bullets`,
    `  "checklist": string[],           // 3-6 verify-items`,
    `  "commonMistakes": string[],     // 2-4 errors to avoid`,
    `  "safetyNotes": string[],         // 0-3; empty array if N/A`,
    `  "keyTakeaways": string[],       // 2-4 summary bullets`,
    `  "imagePrompt": string,           // short visual description, or ""`,
    `  "hook": string,                  // 1-2 sentence vivid opening. "" if not natural`,
    `  "scenario": string,              // 1-2 sentence real-situation prompt. "" if not natural`,
    `  "quickTip": string,              // 1 sentence practical tip. "" if not natural`,
    `  "example": string,               // 1-2 sentence good-vs-bad example. "" if not natural`,
    `  "recap": string                  // 1-2 sentence wrap-up. "" if not natural`,
    `}`,
  ].filter(Boolean).join("\n");

  const data = await chatJSON(system, user, 2000);
  return normalizeModule({ ...data, title: data?.title ?? args.moduleTitle });
}

export function isAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
