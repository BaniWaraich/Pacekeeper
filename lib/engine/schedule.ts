/**
 * §5.4 + §5.6 — the daily plan and redistribution mechanics.
 */
import { addDays, dayDiff } from "./date-math";
import type {
  GoalProjection,
  LocalDate,
  ProposedPlanEntry,
  QuestionStrength,
  TodayView,
  TopicProjection,
  TopicReadiness,
} from "./types";

/**
 * Resolution (a): counts from todayLocal through the day before examDate —
 * the exam day itself is never usable — then subtracts the buffer.
 */
export function daysUsable(goal: GoalProjection, todayLocal: LocalDate): number {
  return Math.max(dayDiff(todayLocal, goal.examDate) - goal.bufferDays, 0);
}

/** Module order, then topic order, then id — the deterministic tie-break. */
export function syllabusOrder(a: TopicProjection, b: TopicProjection): number {
  return (
    a.moduleOrderIndex - b.moduleOrderIndex ||
    a.orderIndex - b.orderIndex ||
    a.id.localeCompare(b.id)
  );
}

/**
 * §5.4. Reviews are ordered weakest strength first (§5 fixes no order; this
 * puts the most fragile memories at the top), tie-broken by most overdue,
 * then id.
 */
export function buildTodayView(
  goal: GoalProjection,
  topics: TopicProjection[],
  strengths: QuestionStrength[],
  readiness: TopicReadiness[],
  todayLocal: LocalDate,
): TodayView {
  const activeTopics = topics.filter((t) => !t.archived);
  const activeTopicIds = new Set(activeTopics.map((t) => t.id));

  const overdue = (s: QuestionStrength) =>
    s.dueDate === null ? 0 : dayDiff(s.dueDate, todayLocal);

  const reviews = strengths
    .filter(
      (s) =>
        s.dueDate !== null &&
        overdue(s) >= 0 &&
        activeTopicIds.has(s.topicId),
    )
    .sort(
      (a, b) =>
        a.strength - b.strength ||
        overdue(b) - overdue(a) ||
        a.questionId.localeCompare(b.questionId),
    );

  const introduced = new Set(
    readiness.filter((r) => r.introduced).map((r) => r.topicId),
  );
  const topicById = new Map(activeTopics.map((t) => [t.id, t]));

  const newTopicIds = goal.planEntries
    .filter(
      (e) =>
        e.planVersion === goal.currentPlanVersion &&
        dayDiff(e.plannedDate, todayLocal) >= 0 &&
        topicById.has(e.topicId) &&
        !introduced.has(e.topicId),
    )
    .sort(
      (a, b) =>
        dayDiff(b.plannedDate, a.plannedDate) ||
        syllabusOrder(topicById.get(a.topicId)!, topicById.get(b.topicId)!),
    )
    .map((e) => e.topicId);

  return { reviews, newTopicIds };
}

/**
 * §5.6: spread topics evenly across the usable days in syllabus order.
 * Topic i of n lands on day floor(i·D/n), so each day carries ⌈n/D⌉ or
 * ⌊n/D⌋ topics — within the daily cap whenever n ≤ D × cap, which SLIPPING
 * guarantees (requiredRate below the cap).
 */
export function redistribute(
  remainingTopics: TopicProjection[],
  todayLocal: LocalDate,
  usableDays: number,
): ProposedPlanEntry[] {
  const ordered = [...remainingTopics].sort(syllabusOrder);
  const days = Math.max(usableDays, 1);
  return ordered.map((topic, i) => ({
    topicId: topic.id,
    plannedDate: addDays(todayLocal, Math.floor((i * days) / ordered.length)),
  }));
}
