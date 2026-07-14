import { prisma } from "@/lib/prisma";
import { instantToLocalDate, todayLocalInZone } from "@/lib/dates";
import { computeEngineResult } from "@/lib/engine";
import type {
  AttemptProjection,
  EngineResult,
  GoalProjection,
  LocalDate,
  PaceMetrics,
  PaceRegime,
  QuestionProjection,
  TopicProjection,
} from "@/lib/engine/types";

/**
 * lib/engine-io.ts — the projection boundary between Prisma and the engine
 * (step 11). The ONLY place rows become engine projections: both §6.2 read
 * routes (today, dashboard) load through here, so ownership scoping, archived
 * propagation, and date localization can't drift apart. The engine itself
 * stays I/O-free (invariant #2 — no Prisma under lib/engine/) and nothing
 * derived here is ever persisted (invariant #3, compute-on-read).
 */

export type QuestionKind = "MCQ" | "FLASHCARD";

export type TopicMeta = { title: string; moduleTitle: string };
export type QuestionMeta = {
  topicId: string;
  prompt: string;
  type: QuestionKind;
};

export type GoalEngineState = {
  goal: {
    id: string;
    title: string;
    examDate: LocalDate;
    dailyNewTopicCap: number;
    bufferDays: number;
    currentPlanVersion: number;
  };
  /**
   * True when plan-v0 entries exist. A goal created via POST /api/goals has
   * none until PUT …/plan lands (step 14); the engine won't throw on it
   * (`originalPlanLength` floors at 1) but its regime would misreport as
   * ON_PACE — so unplanned goals get `regime: null` on the wire instead.
   */
  planned: boolean;
  todayLocal: LocalDate;
  result: EngineResult;
  /** Enrichment for wire responses — engine outputs carry ids only. */
  topicMeta: Map<string, TopicMeta>;
  questionMeta: Map<string, QuestionMeta>;
  /** topicId → plannedDate for the current plan version (newTopics items). */
  currentPlanDates: Map<string, LocalDate>;
};

/* ── Wire shapes for the §6.2 read routes ──────────────────────────────────
 * Discriminated on `planned` so an unclassifiable goal's regime can never
 * cross the route boundary as ON_PACE. Step 14 consumes these same shapes.
 * `proposedEntries` are deliberately absent: they are the payload of
 * POST …/recalibrate (§6.2), not of these read-only views. */

export type TodayReviewItem = {
  questionId: string;
  topicId: string;
  topicTitle: string;
  prompt: string;
  type: QuestionKind;
  strength: number;
  dueDate: LocalDate;
};

export type TodayNewTopicItem = {
  topicId: string;
  title: string;
  moduleTitle: string;
  plannedDate: LocalDate;
};

export type TodayResponse =
  | {
      planned: true;
      todayLocal: LocalDate;
      regime: PaceRegime;
      reviews: TodayReviewItem[];
      newTopics: TodayNewTopicItem[];
    }
  | {
      planned: false;
      todayLocal: LocalDate;
      regime: null;
      /** Due reviews are journal facts, plan-independent — still surfaced. */
      reviews: TodayReviewItem[];
      /** No plan entries → no plannable topics, by definition. */
      newTopics: TodayNewTopicItem[];
    };

export type DashboardTopicReadiness = {
  topicId: string;
  title: string;
  moduleTitle: string;
  readiness: number;
  introduced: boolean;
  notYetReady: boolean;
};

export type DashboardDeferredTopic = {
  topicId: string;
  title: string;
  readiness: number;
};

export type DashboardRegime = {
  regime: PaceRegime;
  metrics: PaceMetrics;
  /** TRIAGE only: size of the kept set. */
  keptCount?: number;
  /** TRIAGE only: the explicit "won't reach" list — shown, never hidden. */
  deferred?: DashboardDeferredTopic[];
};

export type DashboardPlanProgress = {
  totalActiveTopics: number;
  introducedTopics: number;
  remainingTopics: number;
  daysUsable: number;
  requiredRate: number;
  baselineRate: number;
  planVersion: number;
};

export type DashboardResponse =
  | {
      planned: true;
      goalId: string;
      title: string;
      examDate: LocalDate;
      todayLocal: LocalDate;
      /** Goal config the banner copy needs ("at your cap of N/day"). */
      dailyNewTopicCap: number;
      goalReadiness: number;
      /** Weakest-first (SPEC 6.6); ties keep syllabus order. */
      topicReadiness: DashboardTopicReadiness[];
      regime: DashboardRegime;
      planProgress: DashboardPlanProgress;
    }
  | {
      planned: false;
      goalId: string;
      title: string;
      examDate: LocalDate;
      todayLocal: LocalDate;
      regime: null;
    };

/** `@db.Date` columns come back as UTC-midnight instants; the calendar day
 *  is the first 10 chars of the ISO string — lossless, no tz math. */
function dateColumnToLocalDate(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

/**
 * Load a goal's rows (scoped to the session user, per the lib/ownership.ts
 * root pattern: `{ id, userId, archivedAt: null }`), convert them to engine
 * projections, and run the engine. Exactly two queries. `null` → 404.
 */
export async function loadGoalEngineState(
  userId: string,
  goalId: string,
  tz: string,
): Promise<GoalEngineState | null> {
  const goal = await prisma.goal.findFirst({
    // getOwnedGoal's where-clause (lib/ownership.ts) — root-level scope.
    where: { id: goalId, userId, archivedAt: null },
    select: {
      id: true,
      title: true,
      examDate: true,
      dailyNewTopicCap: true,
      bufferDays: true,
      currentPlanVersion: true,
      planEntries: {
        // Every version: v0 is the originalPlanLength baseline, the current
        // version drives today's newTopics (GoalProjection contract).
        select: { topicId: true, plannedDate: true, planVersion: true },
      },
      modules: {
        // No archivedAt filters below the goal: the engine receives archived
        // rows WITH flags — "introduced" is a journal fact even for
        // since-archived questions, so pre-filtering would change results.
        orderBy: { orderIndex: "asc" },
        select: {
          title: true,
          orderIndex: true,
          archivedAt: true,
          topics: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              title: true,
              orderIndex: true,
              archivedAt: true,
              questions: {
                select: {
                  id: true,
                  type: true,
                  prompt: true,
                  archivedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!goal) return null;

  const attemptRows = await prisma.attempt.findMany({
    where: { userId, question: { topic: { module: { goalId } } } },
    // Journal order — AttemptProjection requires same-day attempts in
    // insertion order (lib/engine/types.ts).
    orderBy: [{ attemptedAt: "asc" }, { createdAt: "asc" }],
    select: { questionId: true, outcome: true, attemptedAt: true },
  });

  const todayLocal = todayLocalInZone(tz);

  const topics: TopicProjection[] = [];
  const questions: QuestionProjection[] = [];
  const topicMeta = new Map<string, TopicMeta>();
  const questionMeta = new Map<string, QuestionMeta>();
  for (const mod of goal.modules) {
    const moduleArchived = mod.archivedAt !== null;
    for (const topic of mod.topics) {
      // Archiving an ancestor hides the whole subtree (lib/ownership.ts) —
      // the flags propagate down so the engine agrees with the API surface.
      const topicArchived = moduleArchived || topic.archivedAt !== null;
      topics.push({
        id: topic.id,
        moduleOrderIndex: mod.orderIndex,
        orderIndex: topic.orderIndex,
        archived: topicArchived,
      });
      topicMeta.set(topic.id, { title: topic.title, moduleTitle: mod.title });
      for (const question of topic.questions) {
        questions.push({
          id: question.id,
          topicId: topic.id,
          archived: topicArchived || question.archivedAt !== null,
        });
        questionMeta.set(question.id, {
          topicId: topic.id,
          prompt: question.prompt,
          type: question.type,
        });
      }
    }
  }

  const attempts: AttemptProjection[] = attemptRows.map((a) => ({
    questionId: a.questionId,
    outcome: a.outcome,
    attemptedOnLocal: instantToLocalDate(a.attemptedAt, tz),
  }));

  const goalProjection: GoalProjection = {
    id: goal.id,
    examDate: dateColumnToLocalDate(goal.examDate),
    dailyNewTopicCap: goal.dailyNewTopicCap,
    bufferDays: goal.bufferDays,
    currentPlanVersion: goal.currentPlanVersion,
    planEntries: goal.planEntries.map((e) => ({
      topicId: e.topicId,
      plannedDate: dateColumnToLocalDate(e.plannedDate),
      planVersion: e.planVersion,
    })),
  };

  const result = computeEngineResult(
    goalProjection,
    topics,
    questions,
    attempts,
    todayLocal,
  );

  const currentPlanDates = new Map<string, LocalDate>(
    goalProjection.planEntries
      .filter((e) => e.planVersion === goal.currentPlanVersion)
      .map((e) => [e.topicId, e.plannedDate]),
  );

  return {
    goal: {
      id: goal.id,
      title: goal.title,
      examDate: goalProjection.examDate,
      dailyNewTopicCap: goal.dailyNewTopicCap,
      bufferDays: goal.bufferDays,
      currentPlanVersion: goal.currentPlanVersion,
    },
    planned: goalProjection.planEntries.some((e) => e.planVersion === 0),
    todayLocal,
    result,
    topicMeta,
    questionMeta,
    currentPlanDates,
  };
}
