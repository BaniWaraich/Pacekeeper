/**
 * §5.1–5.3 — review scheduling, question strength, readiness.
 */
import { INTERVALS, READINESS_THRESHOLD } from "./constants";
import { addDays, dayDiff, epochDay } from "./date-math";
import type {
  AttemptProjection,
  LocalDate,
  QuestionProjection,
  QuestionStrength,
  TopicProjection,
  TopicReadiness,
} from "./types";

/** Consecutive CORRECT outcomes counting back from the most recent attempt. */
function streakOf(chronological: AttemptProjection[]): number {
  let streak = 0;
  for (let i = chronological.length - 1; i >= 0; i--) {
    if (chronological[i].outcome !== "CORRECT") break;
    streak++;
  }
  return streak;
}

/**
 * §5.1 + §5.2 for one question. `chronological` is the question's attempt
 * history, oldest first.
 */
export function questionStrength(
  question: QuestionProjection,
  chronological: AttemptProjection[],
  todayLocal: LocalDate,
): QuestionStrength {
  const streak = streakOf(chronological);
  const interval = INTERVALS[Math.min(streak, INTERVALS.length - 1)];
  const last = chronological[chronological.length - 1];

  if (!last) {
    // Never attempted: not due (§5.1), strength 0 (§5.2).
    return {
      questionId: question.id,
      topicId: question.topicId,
      streak,
      interval,
      dueDate: null,
      strength: 0,
    };
  }

  const dueDate = addDays(last.attemptedOnLocal, interval);
  const overdueDays = Math.max(0, dayDiff(dueDate, todayLocal));
  const base = 1 - Math.pow(0.5, streak);
  const strength = base * Math.pow(0.5, overdueDays / interval);

  return {
    questionId: question.id,
    topicId: question.topicId,
    streak,
    interval,
    dueDate,
    strength,
  };
}

/**
 * Strength for every active question. Attempts may arrive in any order; they
 * are stable-sorted by day so same-day attempts keep their journal order.
 */
export function computeStrengths(
  questions: QuestionProjection[],
  attempts: AttemptProjection[],
  todayLocal: LocalDate,
): QuestionStrength[] {
  const byQuestion = new Map<string, AttemptProjection[]>();
  const ordered = [...attempts].sort(
    (a, b) => epochDay(a.attemptedOnLocal) - epochDay(b.attemptedOnLocal),
  );
  for (const attempt of ordered) {
    const list = byQuestion.get(attempt.questionId);
    if (list) list.push(attempt);
    else byQuestion.set(attempt.questionId, [attempt]);
  }

  return questions
    .filter((q) => !q.archived)
    .map((q) => questionStrength(q, byQuestion.get(q.id) ?? [], todayLocal));
}

/**
 * §5.3 + the introduced fact (§5.4). Readiness averages active questions
 * only (archived questions leave the mean), but `introduced` is a journal
 * fact: an attempt on a since-archived question still marks the topic as
 * introduced.
 */
export function computeReadiness(
  topics: TopicProjection[],
  questions: QuestionProjection[],
  attempts: AttemptProjection[],
  strengths: QuestionStrength[],
): { topics: TopicReadiness[]; goalReadiness: number } {
  const topicOfQuestion = new Map(questions.map((q) => [q.id, q.topicId]));
  const introduced = new Set<string>();
  for (const attempt of attempts) {
    const topicId = topicOfQuestion.get(attempt.questionId);
    if (topicId !== undefined) introduced.add(topicId);
  }

  const strengthsByTopic = new Map<string, QuestionStrength[]>();
  for (const s of strengths) {
    const list = strengthsByTopic.get(s.topicId);
    if (list) list.push(s);
    else strengthsByTopic.set(s.topicId, [s]);
  }

  const topicReadiness = topics
    .filter((t) => !t.archived)
    .map((t) => {
      const qs = strengthsByTopic.get(t.id) ?? [];
      const readiness =
        qs.length === 0
          ? 0
          : qs.reduce((sum, q) => sum + q.strength, 0) / qs.length;
      return {
        topicId: t.id,
        readiness,
        introduced: introduced.has(t.id),
        notYetReady: readiness < READINESS_THRESHOLD,
      };
    });

  const goalReadiness =
    topicReadiness.length === 0
      ? 0
      : topicReadiness.reduce((sum, t) => sum + t.readiness, 0) /
        topicReadiness.length;

  return { topics: topicReadiness, goalReadiness };
}
