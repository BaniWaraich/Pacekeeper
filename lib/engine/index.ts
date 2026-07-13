/**
 * The scheduling engine (§5) — pure functions, zero I/O.
 *
 * This module is the only import surface the API layer uses. Inputs are
 * plain projections plus `todayLocal` (computed by the caller in the user's
 * timezone); the result is derived fresh on every call and never persisted.
 */
import { computeRegime } from "./regime";
import { buildTodayView } from "./schedule";
import { computeReadiness, computeStrengths } from "./strength";
import type {
  AttemptProjection,
  EngineResult,
  GoalProjection,
  LocalDate,
  QuestionProjection,
  TopicProjection,
} from "./types";

export function computeEngineResult(
  goal: GoalProjection,
  topics: TopicProjection[],
  questions: QuestionProjection[],
  attempts: AttemptProjection[],
  todayLocal: LocalDate,
): EngineResult {
  const strengths = computeStrengths(questions, attempts, todayLocal);
  const { topics: topicReadiness, goalReadiness } = computeReadiness(
    topics,
    questions,
    attempts,
    strengths,
  );
  const today = buildTodayView(goal, topics, strengths, topicReadiness, todayLocal);
  const regime = computeRegime(goal, topics, topicReadiness, todayLocal);

  return { strengths, topicReadiness, goalReadiness, today, regime };
}

export * from "./types";
export * from "./constants";
export { questionStrength, computeStrengths, computeReadiness } from "./strength";
export { daysUsable, buildTodayView, redistribute } from "./schedule";
export { computeRegime, originalPlanLength } from "./regime";
