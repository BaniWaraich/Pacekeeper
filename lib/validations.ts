import { z } from "zod";

/**
 * lib/validations.ts — Zod schemas for the §6 API contracts.
 *
 * Single source of truth for wire shapes. This file validates SHAPE and STATIC
 * BOUNDS only: no clock, no DB/Prisma, no engine, no env. Route-layer concerns
 * live in the handlers, NOT here — specifically the `attemptedAt` now±24h clamp,
 * the `examDate` future-date check, and every ownership/session/auth check.
 *
 * Every exported type is derived via `z.infer` — the schema is canonical; no
 * hand-written interface duplicates a wire shape.
 *
 * `strictObject` everywhere content is authored or AI output is gated: unknown
 * keys are rejected (reject-not-repair), never stripped or passed through.
 */

/* ── Shared bound constants ───────────────────────────────────────────────
 * The gate (AI response) and the write path (CRUD) read the SAME constant —
 * a bound is defined once, never repeated as a literal. */
const TITLE_MAX = 120; // goal/module/topic titles AND AI-structure module/topic titles
const NOTE_CONTENT_MAX = 10_000; // note content
export const MATERIAL_MAX = 100_000; // topic.material AND POST /api/ai/structure `material` (§6.3)
const PROMPT_MAX = 2_000; // QuestionInput.prompt (§6.1)
const BACK_MAX = 5_000; // flashcard.back (§6.1)
const OPTIONS_MIN = 2; // MCQ options lower bound (§6.1)
const OPTIONS_MAX = 6; // MCQ options upper bound (§6.1)
const AI_MODULES_MAX = 30; // AI structure response: modules array
const AI_TOPICS_MAX = 30; // AI structure response: topics-per-module array
const AI_COUNT_MAX = 20; // POST /api/ai/questions `count` (§6.3)

/* ── Shared field schemas ─────────────────────────────────────────────── */

/** IANA timezone placeholder — non-emptiness ONLY. Real validation against
 *  `Intl.supportedValuesOf('timeZone')` lives in the caller-side date utility
 *  (step 6/9); do not duplicate it here. */
export const ianaTimezoneSchema = z.string().min(1);

/** Content title, reused across goal/module/topic and AI structure output. */
const titleSchema = z.string().min(1).max(TITLE_MAX);

/** Ordering index on modules/topics — non-negative integer. */
const orderIndexSchema = z.number().int().nonnegative();

/** A record id that references a cuid-keyed row (goalId, moduleId, topicId,
 *  questionId). Not a UUID — only `Attempt.id` is a client UUID. */
const recordIdSchema = z.string().min(1);

/** Wrap an all-optional partial so `PATCH {}` is rejected rather than being a
 *  silent no-op. */
function requireAtLeastOneField<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (val) => val != null && typeof val === "object" && Object.keys(val).length > 0,
    { message: "at least one field required" },
  );
}

/* ── §6.1 QuestionInput (discriminated union) ─────────────────────────────
 * Each variant is a `strictObject`, so an MCQ carrying a stray `back` (or a
 * flashcard carrying `options`) fails — per-variant strictness, not just at the
 * union's outer layer. */

const mcqQuestionBase = z.strictObject({
  type: z.literal("MCQ"),
  prompt: z.string().min(1).max(PROMPT_MAX),
  options: z.array(z.string().min(1)).min(OPTIONS_MIN).max(OPTIONS_MAX),
  correctIndex: z.number().int().nonnegative(),
});

const flashcardQuestionBase = z.strictObject({
  type: z.literal("FLASHCARD"),
  prompt: z.string().min(1).max(PROMPT_MAX),
  back: z.string().min(1).max(BACK_MAX),
});

/** `correctIndex` must index into `options` — a same-object static relationship
 *  (shape validation, not a DB/clock concern). */
export const mcqQuestionSchema = mcqQuestionBase.refine(
  (q) => q.correctIndex < q.options.length,
  { message: "correctIndex must be less than options.length", path: ["correctIndex"] },
);

export const flashcardQuestionSchema = flashcardQuestionBase;

export const questionInputSchema = z
  .discriminatedUnion("type", [mcqQuestionBase, flashcardQuestionBase])
  .superRefine((q, ctx) => {
    if (q.type === "MCQ" && q.correctIndex >= q.options.length) {
      ctx.addIssue({
        code: "custom",
        message: "correctIndex must be less than options.length",
        path: ["correctIndex"],
      });
    }
  });

export type McqQuestion = z.infer<typeof mcqQuestionSchema>;
export type FlashcardQuestion = z.infer<typeof flashcardQuestionSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;

/* ── §6.1 Content CRUD ────────────────────────────────────────────────────
 * Update schemas OMIT the parent-reference key before `.partial()` (no
 * re-parenting on PATCH) and reject an empty body. */

export const goalCreateSchema = z.strictObject({
  title: titleSchema,
  // Calendar day (`@db.Date`), timezone-free. Future-date check is route-layer.
  examDate: z.iso.date(),
  dailyNewTopicCap: z.number().int().positive().optional(),
  bufferDays: z.number().int().nonnegative().optional(),
});
export const goalUpdateSchema = requireAtLeastOneField(goalCreateSchema.partial());

export const moduleCreateSchema = z.strictObject({
  goalId: recordIdSchema,
  title: titleSchema,
  orderIndex: orderIndexSchema,
});
export const moduleUpdateSchema = requireAtLeastOneField(
  moduleCreateSchema.omit({ goalId: true }).partial(),
);

export const topicCreateSchema = z.strictObject({
  moduleId: recordIdSchema,
  title: titleSchema,
  material: z.string().min(1).max(MATERIAL_MAX).optional(),
  orderIndex: orderIndexSchema,
});
export const topicUpdateSchema = requireAtLeastOneField(
  topicCreateSchema.omit({ moduleId: true }).partial(),
);

export const noteCreateSchema = z.strictObject({
  topicId: recordIdSchema,
  content: z.string().min(1).max(NOTE_CONTENT_MAX),
});
export const noteUpdateSchema = requireAtLeastOneField(
  noteCreateSchema.omit({ topicId: true }).partial(),
);

/** POST /api/questions/batch — the confirmation gate's write; each item fully
 *  re-validated against the union. */
export const questionBatchSchema = z.strictObject({
  topicId: recordIdSchema,
  questions: z.array(questionInputSchema).min(1),
});

/** PATCH /api/questions/:id — a full QuestionInput re-submit (replace, not a
 *  partial-of-union). */
export const questionUpdateSchema = questionInputSchema;

export type GoalCreate = z.infer<typeof goalCreateSchema>;
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;
export type ModuleCreate = z.infer<typeof moduleCreateSchema>;
export type ModuleUpdate = z.infer<typeof moduleUpdateSchema>;
export type TopicCreate = z.infer<typeof topicCreateSchema>;
export type TopicUpdate = z.infer<typeof topicUpdateSchema>;
export type NoteCreate = z.infer<typeof noteCreateSchema>;
export type NoteUpdate = z.infer<typeof noteUpdateSchema>;
export type QuestionBatch = z.infer<typeof questionBatchSchema>;

/* ── §6.2 Study loop ──────────────────────────────────────────────────────
 * `outcome` is NEVER accepted from the client — MCQs are server-graded and
 * flashcards derive outcome from `selfMark`. `strictObject` guarantees a body
 * carrying `outcome` (or any other stray key) is REJECTED. */

export const attemptCreateSchema = z.strictObject({
  id: z.uuid(), // client-generated idempotency UUID
  questionId: recordIdSchema,
  selectedOption: z.number().int().nonnegative().optional(), // MCQ audit trail
  selfMark: z.enum(["CORRECT", "INCORRECT"]).optional(), // flashcard self-grade
  attemptedAt: z.iso.datetime(), // instant; now±24h clamp is route-layer
});

export const planEntrySchema = z.strictObject({
  topicId: recordIdSchema,
  plannedDate: z.iso.date(), // calendar day (`@db.Date`)
});

/** PUT /api/goals/:id/plan — non-empty entries. "Topics belong to goal" is a
 *  DB ownership check and lives in the route, not here. */
export const planWriteSchema = z.strictObject({
  entries: z.array(planEntrySchema).min(1),
});

export type AttemptCreate = z.infer<typeof attemptCreateSchema>;
export type PlanEntryInput = z.infer<typeof planEntrySchema>;
export type PlanWrite = z.infer<typeof planWriteSchema>;

/* ── §6.3 AI touchpoints ──────────────────────────────────────────────────
 * Response schemas gate untrusted Gemini output: strict, finite bounds,
 * reject-not-repair. */

export const aiStructureRequestSchema = z.strictObject({
  material: z.string().min(1).max(MATERIAL_MAX),
});

export const aiStructureResponseSchema = z.strictObject({
  modules: z
    .array(
      z.strictObject({
        title: titleSchema,
        topics: z
          .array(z.strictObject({ title: titleSchema }))
          .min(1)
          .max(AI_TOPICS_MAX),
      }),
    )
    .min(1)
    .max(AI_MODULES_MAX),
});

export const aiQuestionsRequestSchema = z.strictObject({
  topicId: recordIdSchema,
  count: z.number().int().min(1).max(AI_COUNT_MAX),
});

export const aiQuestionsResponseSchema = z.strictObject({
  drafts: z.array(questionInputSchema),
});

export type AiStructureRequest = z.infer<typeof aiStructureRequestSchema>;
export type AiStructureResponse = z.infer<typeof aiStructureResponseSchema>;
export type AiQuestionsRequest = z.infer<typeof aiQuestionsRequestSchema>;
export type AiQuestionsResponse = z.infer<typeof aiQuestionsResponseSchema>;
