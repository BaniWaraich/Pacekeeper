/**
 * Seed script — MECHANISM.
 *
 * Turns the declarative fixtures in `seed-fixtures.ts` into rows. Three jobs:
 *   1. demo content for the submission video and evaluator exploration,
 *   2. the fixture step 7's engine unit tests assert against,
 *   3. one-command recovery if the public demo account is vandalised
 *      (tech doc §8, mitigation #6).
 *
 * The seed produces RAW FACTS ONLY. It never computes strength, readiness or
 * pace — those are derived on read by the engine (invariant 3). The regime each
 * goal lands in is a consequence of the numbers in the fixtures, and the §5
 * arithmetic proving it is written out in the fixture file's comment blocks.
 *
 * Run with:  pnpm db:seed
 */
import { randomUUID } from "node:crypto";

import { PrismaClient, type Outcome, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_PASSWORD,
  DEMO_TIMEZONE,
  GOALS,
  TEST_USER_EMAIL,
  type FixtureGoal,
  type FixtureQuestion,
} from "./seed-fixtures";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

/* ── Dates ─────────────────────────────────────────────────────────────────
 * Every date in the fixtures is an integer day offset from "now". The demo
 * account's day boundaries are Asia/Kolkata (IST = UTC+5:30, no DST), so the
 * seed anchors on today's *Kolkata* calendar date. Calling `new Date()` here is
 * correct and deliberate: this script is what establishes the "moment the seed
 * runs" anchor. The no-`new Date()` rule (invariant 2) governs `lib/engine/`,
 * which must stay pure — it does not govern a one-shot script.
 * ──────────────────────────────────────────────────────────────────────────*/

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC-midnight Date for today's calendar date in Asia/Kolkata. */
function kolkataToday(): Date {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

const TODAY = kolkataToday();

/** A calendar day `offset` days from today — for the `@db.Date` columns. */
function dateOnly(offset: number): Date {
  return new Date(TODAY.getTime() + offset * DAY_MS);
}

/**
 * An instant for an attempt: an evening study session on the given day, at
 * ~19:00 IST (13:30 UTC), with each attempt in the session a minute apart so
 * rows within a session have a stable, plausible order.
 */
function instant(dayOffset: number, minuteInSession: number): Date {
  const base = dateOnly(dayOffset).getTime();
  return new Date(base + 13.5 * 60 * 60 * 1000 + minuteInSession * 60 * 1000);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ── Deterministic outcomes ────────────────────────────────────────────────
 * Outcomes must look human — mostly correct, with scattered, non-uniform
 * misses — and must be identical on every run so the fixture is stable for the
 * engine tests. A seeded PRNG (mulberry32) over a hash of the row's coordinates
 * gives both: no `Math.random()`, no uniform pattern.
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

/**
 * Accuracy ramps from `firstAccuracy` on the introducing session toward
 * `steadyAccuracy`, closing half the remaining gap each subsequent session —
 * a learner getting better at material she keeps returning to.
 */
function accuracyForSession(
  first: number,
  steady: number,
  sessionIndex: number,
): number {
  return steady - (steady - first) * Math.pow(0.5, sessionIndex);
}

/* ── Question payloads (§4.1) ──────────────────────────────────────────────*/

function payloadOf(q: FixtureQuestion): Prisma.InputJsonValue {
  return q.type === "MCQ"
    ? { options: q.options, correctIndex: q.correctIndex }
    : { back: q.back };
}

/**
 * The option a learner picked. Correct → the right index. Incorrect → a
 * deterministically chosen wrong index. Flashcards have no options: null.
 */
function selectedOptionOf(
  q: FixtureQuestion,
  correct: boolean,
  roll: number,
): number | null {
  if (q.type !== "MCQ") return null;
  if (correct) return q.correctIndex;
  const wrong = Array.from({ length: q.options.length }, (_, i) => i).filter(
    (i) => i !== q.correctIndex,
  );
  return wrong[Math.floor(roll * wrong.length) % wrong.length];
}

/* ── Reset (idempotency) ───────────────────────────────────────────────────
 * SANCTIONED HARD DELETE — this is the one place in the codebase where rows are
 * physically removed. It is a fixture reset inside a script, not a product code
 * path: the soft-delete-only invariant (#5, mitigation #9) governs the API
 * surface, which never row-deletes anything.
 *
 * Two safety properties, both load-bearing:
 *   - Every deleteMany below is scoped strictly by the target user's `userId`
 *     (directly, or up the FK tree via goal → module → topic). No other user's
 *     rows can be reached from here.
 *   - Deletion is explicitly ordered child-to-parent and wrapped in one
 *     transaction. Attempt → Question is `onDelete: Restrict` on purpose
 *     (§4.1), so attempts MUST go before questions; the constraint is a
 *     tripwire, not something to route around.
 * ──────────────────────────────────────────────────────────────────────────*/
async function deleteUserTree(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return false;

  const userId = user.id;
  const ofUser = { module: { goal: { userId } } };

  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { userId } }),
    prisma.note.deleteMany({ where: { userId } }),
    prisma.planEntry.deleteMany({ where: { goal: { userId } } }),
    prisma.question.deleteMany({ where: { topic: ofUser } }),
    prisma.topic.deleteMany({ where: { module: { goal: { userId } } } }),
    prisma.module.deleteMany({ where: { goal: { userId } } }),
    prisma.goal.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return true;
}

/* ── Build ─────────────────────────────────────────────────────────────────*/

type GoalSummary = {
  key: string;
  title: string;
  regime: string;
  examDate: string;
  modules: number;
  topics: number;
  introducedTopics: number;
  questions: number;
  attempts: number;
  attemptRange: [string, string] | null;
  planRange: [string, string];
};

const REGIME_OF: Record<FixtureGoal["key"], string> = {
  A: "ON_PACE (silent absorption)",
  B: "SLIPPING (visible replan)",
  C: "TRIAGE (kept/deferred cut)",
};

async function buildGoal(userId: string, fx: FixtureGoal): Promise<GoalSummary> {
  const goal = await prisma.goal.create({
    data: {
      userId,
      title: fx.title,
      examDate: dateOnly(fx.examDay),
      dailyNewTopicCap: fx.dailyNewTopicCap,
      bufferDays: fx.bufferDays,
      currentPlanVersion: 0,
    },
  });

  const skip = new Set(fx.skipDays);
  const attemptRows: Prisma.AttemptCreateManyInput[] = [];
  const planRows: Prisma.PlanEntryCreateManyInput[] = [];

  let topicCount = 0;
  let introducedTopics = 0;
  let questionCount = 0;

  for (const [moduleIndex, fxModule] of fx.modules.entries()) {
    const dbModule = await prisma.module.create({
      data: { goalId: goal.id, title: fxModule.title, orderIndex: moduleIndex },
    });

    for (const [topicIndex, fxTopic] of fxModule.topics.entries()) {
      const dbTopic = await prisma.topic.create({
        data: {
          moduleId: dbModule.id,
          title: fxTopic.title,
          material: fxTopic.material,
          orderIndex: topicIndex,
        },
      });
      topicCount++;

      const questions = await Promise.all(
        fxTopic.questions.map((q) =>
          prisma.question.create({
            data: {
              topicId: dbTopic.id,
              type: q.type,
              prompt: q.prompt,
              payload: payloadOf(q),
            },
          }),
        ),
      );
      questionCount += questions.length;

      // Plan version 0: every topic gets exactly one entry on its planned day.
      planRows.push({
        goalId: goal.id,
        topicId: dbTopic.id,
        plannedDate: dateOnly(fxTopic.plannedDay),
        planVersion: 0,
      });

      const spec = fxTopic.attempts;
      if (!spec) continue; // never introduced — no attempts, readiness 0

      // Sessions the learner actually sat: the pattern, minus the days she
      // skipped entirely. This is where "missed a day" / "missed a week" is
      // enforced — declaratively, from the goal's skipDays.
      const sessionDays = [spec.introducedDay, ...spec.reviewDays]
        .filter((day) => !skip.has(day))
        .sort((a, b) => a - b);

      if (sessionDays.length === 0) continue;
      introducedTopics++;

      for (const [sessionIndex, day] of sessionDays.entries()) {
        const accuracy = accuracyForSession(
          spec.firstAccuracy,
          spec.steadyAccuracy,
          sessionIndex,
        );

        for (const [qIndex, question] of questions.entries()) {
          const fxQuestion = fxTopic.questions[qIndex];
          const roll = mulberry32(
            hashSeed(
              fx.key,
              moduleIndex,
              topicIndex,
              qIndex,
              sessionIndex,
              day,
            ),
          );
          const correct = roll < accuracy;
          const outcome: Outcome = correct ? "CORRECT" : "INCORRECT";

          attemptRows.push({
            id: randomUUID(), // client-generated UUID is the PK (§4.1)
            questionId: question.id,
            userId,
            outcome,
            selectedOption: selectedOptionOf(fxQuestion, correct, roll),
            attemptedAt: instant(day, qIndex),
          });
        }
      }
    }
  }

  await prisma.planEntry.createMany({ data: planRows });
  // Append-only: attempts are inserted once and never updated (invariant 1).
  await prisma.attempt.createMany({ data: attemptRows });

  const attemptDays = attemptRows
    .map((a) => (a.attemptedAt as Date).getTime())
    .sort((a, b) => a - b);
  const planDays = planRows
    .map((p) => (p.plannedDate as Date).getTime())
    .sort((a, b) => a - b);

  return {
    key: fx.key,
    title: fx.title,
    regime: REGIME_OF[fx.key],
    examDate: isoDay(dateOnly(fx.examDay)),
    modules: fx.modules.length,
    topics: topicCount,
    introducedTopics,
    questions: questionCount,
    attempts: attemptRows.length,
    attemptRange: attemptDays.length
      ? [
          isoDay(new Date(attemptDays[0])),
          isoDay(new Date(attemptDays[attemptDays.length - 1])),
        ]
      : null,
    planRange: [
      isoDay(new Date(planDays[0])),
      isoDay(new Date(planDays[planDays.length - 1])),
    ],
  };
}

/* ── Summary ───────────────────────────────────────────────────────────────*/

async function printSummary(summaries: GoalSummary[]): Promise<void> {
  console.log(`\nSeeded ${DEMO_EMAIL} — today (${DEMO_TIMEZONE}) is ${isoDay(TODAY)}\n`);

  for (const s of summaries) {
    console.log(`  Goal ${s.key} — ${s.title}`);
    console.log(`    target regime  ${s.regime}`);
    console.log(`    exam date      ${s.examDate}`);
    console.log(
      `    content        ${s.modules} modules · ${s.topics} topics (${s.introducedTopics} introduced, ${s.topics - s.introducedTopics} remaining) · ${s.questions} questions`,
    );
    console.log(
      `    attempts       ${s.attempts}` +
        (s.attemptRange
          ? ` · ${s.attemptRange[0]} → ${s.attemptRange[1]}`
          : " · none"),
    );
    console.log(`    plan v0        ${s.planRange[0]} → ${s.planRange[1]}\n`);
  }

  // Counted fresh from the database, not from the builder's own tallies — this
  // is what makes "run it twice, get identical counts" a real check.
  const [users, goals, modules, topics, questions, attempts, planEntries, notes] =
    await Promise.all([
      prisma.user.count(),
      prisma.goal.count(),
      prisma.module.count(),
      prisma.topic.count(),
      prisma.question.count(),
      prisma.attempt.count(),
      prisma.planEntry.count(),
      prisma.note.count(),
    ]);

  console.log("  Row counts (whole database)");
  for (const [table, n] of [
    ["User", users],
    ["Goal", goals],
    ["Module", modules],
    ["Topic", topics],
    ["Question", questions],
    ["Attempt", attempts],
    ["PlanEntry", planEntries],
    ["Note", notes],
  ] as const) {
    console.log(`    ${table.padEnd(10)} ${n}`);
  }

  console.log(`\n  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`);
}

/* ── Main ──────────────────────────────────────────────────────────────────*/

async function main(): Promise<void> {
  // Idempotency: wipe the demo user's tree, then rebuild it. Nothing outside
  // these two accounts is touched.
  const hadDemo = await deleteUserTree(DEMO_EMAIL);
  const hadTestUser = await deleteUserTree(TEST_USER_EMAIL);

  if (hadDemo) console.log(`Reset existing ${DEMO_EMAIL} data tree.`);
  if (hadTestUser) console.log(`Removed superseded ${TEST_USER_EMAIL} account.`);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash: bcrypt.hashSync(DEMO_PASSWORD, BCRYPT_ROUNDS),
    },
  });

  const summaries: GoalSummary[] = [];
  for (const fx of GOALS) {
    summaries.push(await buildGoal(user.id, fx));
  }

  await printSummary(summaries);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
