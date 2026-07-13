/**
 * Fixture bridge — shared test infrastructure for the step-7 engine tests.
 *
 * Converts the declarative scenarios in `prisma/seed-fixtures.ts` into the
 * plain-object projections the engine consumes, replicating exactly what
 * `prisma/seed.ts` does with them (skipDays filtering, session ordering, the
 * seeded PRNG outcomes). Day offsets anchor on a `todayLocal` the test passes
 * in — always an explicit literal, never the clock.
 *
 * Imports are restricted to `lib/engine/` and the fixture module (which is
 * data-only, zero imports). `seed.ts` itself cannot be imported here because
 * it pulls in `@prisma/client`.
 */
import { addDays } from "@/lib/engine/date-math";
import type {
  AttemptProjection,
  GoalProjection,
  LocalDate,
  PlanEntryProjection,
  QuestionProjection,
  QuestionStrength,
  TopicProjection,
} from "@/lib/engine";
import { GOALS, type FixtureGoal } from "@/prisma/seed-fixtures";

/* ── Deterministic outcomes — copied verbatim from prisma/seed.ts ──────────
 * These three functions MUST stay byte-identical to their seed.ts originals:
 * the integration tests assert against the exact attempt outcomes the seed
 * writes to the database. (Recorded debt: duplicated because seed.ts imports
 * @prisma/client and the tests may not.)
 * ──────────────────────────────────────────────────────────────────────────*/

function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x2f;
  }
  return h >>> 0;
}

function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function accuracyForSession(
  first: number,
  steady: number,
  sessionIndex: number,
): number {
  return steady - (steady - first) * Math.pow(0.5, sessionIndex);
}

/* ── Fixture goal → engine projections ─────────────────────────────────────*/

export type Projections = {
  goal: GoalProjection;
  topics: TopicProjection[];
  questions: QuestionProjection[];
  attempts: AttemptProjection[];
};

export function goalFixture(key: FixtureGoal["key"]): FixtureGoal {
  const fx = GOALS.find((g) => g.key === key);
  if (!fx) throw new Error(`no fixture goal ${key}`);
  return fx;
}

/** Deterministic ids so assertions can name topics: `A-m0-t1`, `A-m0-t1-q2`. */
export function topicIdOf(
  key: string,
  moduleIndex: number,
  topicIndex: number,
): string {
  return `${key}-m${moduleIndex}-t${topicIndex}`;
}

/**
 * Mirrors `buildGoal` in prisma/seed.ts: one plan-v0 entry per topic on its
 * planned day; for topics with an attempts spec, sessions are
 * `[introducedDay, ...reviewDays]` minus the goal's skipDays, sorted
 * ascending, and every question is attempted once per session with the
 * PRNG-rolled outcome. Attempts are pushed in session → question order, the
 * journal order seed.ts establishes with its per-minute timestamps.
 */
export function buildProjections(
  fx: FixtureGoal,
  todayLocal: LocalDate,
): Projections {
  const skip = new Set(fx.skipDays);
  const topics: TopicProjection[] = [];
  const questions: QuestionProjection[] = [];
  const attempts: AttemptProjection[] = [];
  const planEntries: PlanEntryProjection[] = [];

  for (const [moduleIndex, fxModule] of fx.modules.entries()) {
    for (const [topicIndex, fxTopic] of fxModule.topics.entries()) {
      const topicId = topicIdOf(fx.key, moduleIndex, topicIndex);
      topics.push({
        id: topicId,
        moduleOrderIndex: moduleIndex,
        orderIndex: topicIndex,
        archived: false,
      });
      planEntries.push({
        topicId,
        plannedDate: addDays(todayLocal, fxTopic.plannedDay),
        planVersion: 0,
      });

      const questionIds = fxTopic.questions.map(
        (_, qIndex) => `${topicId}-q${qIndex}`,
      );
      for (const id of questionIds) {
        questions.push({ id, topicId, archived: false });
      }

      const spec = fxTopic.attempts;
      if (!spec) continue;

      const sessionDays = [spec.introducedDay, ...spec.reviewDays]
        .filter((day) => !skip.has(day))
        .sort((a, b) => a - b);

      for (const [sessionIndex, day] of sessionDays.entries()) {
        const accuracy = accuracyForSession(
          spec.firstAccuracy,
          spec.steadyAccuracy,
          sessionIndex,
        );
        for (const [qIndex, questionId] of questionIds.entries()) {
          const roll = mulberry32(
            hashSeed(fx.key, moduleIndex, topicIndex, qIndex, sessionIndex, day),
          );
          attempts.push({
            questionId,
            outcome: roll < accuracy ? "CORRECT" : "INCORRECT",
            attemptedOnLocal: addDays(todayLocal, day),
          });
        }
      }
    }
  }

  return {
    goal: {
      id: `goal-${fx.key}`,
      examDate: addDays(todayLocal, fx.examDay),
      dailyNewTopicCap: fx.dailyNewTopicCap,
      bufferDays: fx.bufferDays,
      currentPlanVersion: 0,
      planEntries,
    },
    topics,
    questions,
    attempts,
  };
}

/* ── Synthetic micro-fixture helpers (boundary + unit tests) ───────────────*/

export function makeTopic(
  id: string,
  overrides: Partial<Omit<TopicProjection, "id">> = {},
): TopicProjection {
  return { id, moduleOrderIndex: 0, orderIndex: 0, archived: false, ...overrides };
}

export function makeQuestion(
  id: string,
  topicId: string,
  archived = false,
): QuestionProjection {
  return { id, topicId, archived };
}

export function makeGoal(
  overrides: Partial<GoalProjection> = {},
): GoalProjection {
  return {
    id: "goal-synth",
    examDate: "2025-06-30",
    dailyNewTopicCap: 5,
    bufferDays: 0,
    currentPlanVersion: 0,
    planEntries: [],
    ...overrides,
  };
}

/** A synthetic QuestionStrength for tests that feed strengths in directly. */
export function makeStrength(
  questionId: string,
  topicId: string,
  overrides: Partial<QuestionStrength> = {},
): QuestionStrength {
  return {
    questionId,
    topicId,
    streak: 0,
    interval: 1,
    dueDate: null,
    strength: 0,
    ...overrides,
  };
}
