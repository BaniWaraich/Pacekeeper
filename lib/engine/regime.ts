/**
 * §5.5 + §5.7 — the three-regime classifier and slip handling.
 */
import { PACE_TOLERANCE } from "./constants";
import { addDays, epochDay } from "./date-math";
import { daysUsable, redistribute, syllabusOrder } from "./schedule";
import type {
  GoalProjection,
  LocalDate,
  PaceMetrics,
  RegimeResult,
  TopicProjection,
  TopicReadiness,
  TriagedTopic,
} from "./types";

/**
 * Resolution (c′): the span of the immutable plan v0, first through last
 * planned day inclusive. Derived on every read, never stored, and never
 * rebased by recalibration — later plan versions don't touch v0, so this
 * stays the fixed baseline slip is measured against.
 */
export function originalPlanLength(goal: GoalProjection): number {
  const v0Days = goal.planEntries
    .filter((e) => e.planVersion === 0)
    .map((e) => epochDay(e.plannedDate));
  if (v0Days.length === 0) return 1;
  return Math.max(...v0Days) - Math.min(...v0Days) + 1;
}

export function computeRegime(
  goal: GoalProjection,
  topics: TopicProjection[],
  readiness: TopicReadiness[],
  todayLocal: LocalDate,
): RegimeResult {
  const active = topics.filter((t) => !t.archived);
  const readinessOf = new Map(readiness.map((r) => [r.topicId, r]));
  const isIntroduced = (t: TopicProjection) =>
    readinessOf.get(t.id)?.introduced ?? false;

  const remaining = active.filter((t) => !isIntroduced(t));
  const usable = daysUsable(goal, todayLocal);
  const planLength = originalPlanLength(goal);

  const metrics: PaceMetrics = {
    totalActiveTopics: active.length,
    remainingTopics: remaining.length,
    daysUsable: usable,
    originalPlanLength: planLength,
    requiredRate: remaining.length / Math.max(usable, 1),
    baselineRate: active.length / planLength,
    onPaceThreshold: (active.length / planLength) * PACE_TOLERANCE,
    capacity: usable * goal.dailyNewTopicCap,
  };

  // TRIAGE is checked first, and hitting the cap exactly counts as over it
  // (conservative boundary ruling — §5.5's prose writes a strict `>`). The
  // cap is the user's stated ceiling and "the honest trigger for triage";
  // when a generous plan-v0 baseline stretches the ON_PACE band past the
  // cap, the cap still wins.
  if (metrics.requiredRate >= goal.dailyNewTopicCap) {
    return { regime: "TRIAGE", metrics, ...triage(goal, active, readinessOf, metrics, todayLocal) };
  }

  if (metrics.requiredRate <= metrics.onPaceThreshold) {
    // Silent absorption: the Today view already surfaces behind-plan topics,
    // so there is nothing to propose or persist (§5.6).
    return { regime: "ON_PACE", metrics };
  }

  return {
    regime: "SLIPPING",
    metrics,
    proposedEntries: redistribute(remaining, todayLocal, usable),
  };
}

/**
 * §5.7: capacity-constrained selection ranked by measured weakness alone.
 * Ties (e.g. many untouched topics at readiness 0) break by syllabus order
 * so the split is deterministic. The kept set is scheduled weakest-first at
 * the daily cap; deferred topics are returned with their readiness so the
 * cut is transparent, and get no schedule.
 */
function triage(
  goal: GoalProjection,
  activeTopics: TopicProjection[],
  readinessOf: Map<string, TopicReadiness>,
  metrics: PaceMetrics,
  todayLocal: LocalDate,
): { kept: TriagedTopic[]; deferred: TriagedTopic[]; proposedEntries: { topicId: string; plannedDate: LocalDate }[] } {
  const ranked = activeTopics
    .map((topic) => ({
      topic,
      readiness: readinessOf.get(topic.id)?.readiness ?? 0,
      notYetReady: readinessOf.get(topic.id)?.notYetReady ?? true,
    }))
    .filter((r) => r.notYetReady)
    .sort(
      (a, b) => a.readiness - b.readiness || syllabusOrder(a.topic, b.topic),
    );

  const kept = ranked.slice(0, metrics.capacity);
  const deferred = ranked.slice(metrics.capacity);
  const cap = Math.max(goal.dailyNewTopicCap, 1);

  return {
    kept: kept.map((r) => ({ topicId: r.topic.id, readiness: r.readiness })),
    deferred: deferred.map((r) => ({
      topicId: r.topic.id,
      readiness: r.readiness,
    })),
    proposedEntries: kept.map((r, i) => ({
      topicId: r.topic.id,
      plannedDate: addDays(todayLocal, Math.floor(i / cap)),
    })),
  };
}
