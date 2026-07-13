/**
 * schedule.ts unit tests — §5.4 today view, §5.6 redistribution.
 */
import { describe, expect, it } from "vitest";

import {
  buildTodayView,
  redistribute,
  type QuestionStrength,
  type TopicReadiness,
} from "@/lib/engine";
import { addDays } from "@/lib/engine/date-math";
import { makeGoal, makeStrength, makeTopic } from "./fixture-bridge";

const TODAY = "2025-06-15";

function ready(
  topicId: string,
  introduced: boolean,
  readiness = introduced ? 0.5 : 0,
): TopicReadiness {
  return { topicId, readiness, introduced, notYetReady: readiness < 0.6 };
}

describe("today view — reviews (§5.4)", () => {
  it("orders by strength asc, then most overdue, then questionId", () => {
    const topics = [makeTopic("t1")];
    const readiness = [ready("t1", true)];
    const strengths: QuestionStrength[] = [
      makeStrength("q-weak-late", "t1", { strength: 0.1, dueDate: addDays(TODAY, -3) }),
      makeStrength("q-strong", "t1", { strength: 0.4, dueDate: TODAY }),
      makeStrength("q-weak-today", "t1", { strength: 0.1, dueDate: TODAY }),
      // questionId tie-break: identical strength and due date.
      makeStrength("q-tie-b", "t1", { strength: 0.2, dueDate: TODAY }),
      makeStrength("q-tie-a", "t1", { strength: 0.2, dueDate: TODAY }),
    ];
    const view = buildTodayView(makeGoal(), topics, strengths, readiness, TODAY);
    expect(view.reviews.map((r) => r.questionId)).toEqual([
      "q-weak-late", // 0.1, overdue 3
      "q-weak-today", // 0.1, overdue 0
      "q-tie-a", // 0.2, id tie-break
      "q-tie-b",
      "q-strong", // 0.4
    ]);
  });

  it("includes only due questions of active topics", () => {
    const topics = [makeTopic("t1"), makeTopic("t-archived", { archived: true })];
    const readiness = [ready("t1", true), ready("t-archived", true)];
    const strengths: QuestionStrength[] = [
      makeStrength("q-due", "t1", { strength: 0.3, dueDate: TODAY }),
      makeStrength("q-future", "t1", { strength: 0.3, dueDate: addDays(TODAY, 1) }),
      makeStrength("q-unattempted", "t1", { dueDate: null }),
      makeStrength("q-archived-topic", "t-archived", { strength: 0.1, dueDate: TODAY }),
    ];
    const view = buildTodayView(makeGoal(), topics, strengths, readiness, TODAY);
    expect(view.reviews.map((r) => r.questionId)).toEqual(["q-due"]);
  });
});

describe("today view — newTopics (§5.4)", () => {
  it("earliest planned first, then syllabus order; only current-version, due, not-introduced, active", () => {
    const topics = [
      makeTopic("t-old", { moduleOrderIndex: 1, orderIndex: 0 }),
      makeTopic("t-today", { moduleOrderIndex: 0, orderIndex: 0 }),
      makeTopic("t-tie-m0", { moduleOrderIndex: 0, orderIndex: 1 }),
      makeTopic("t-tie-m1", { moduleOrderIndex: 1, orderIndex: 1 }),
      makeTopic("t-future", { moduleOrderIndex: 2, orderIndex: 0 }),
      makeTopic("t-introduced", { moduleOrderIndex: 2, orderIndex: 1 }),
      makeTopic("t-archived", { moduleOrderIndex: 2, orderIndex: 2, archived: true }),
      makeTopic("t-stale-version", { moduleOrderIndex: 2, orderIndex: 3 }),
    ];
    const readiness = topics.map((t) => ready(t.id, t.id === "t-introduced"));
    const goal = makeGoal({
      currentPlanVersion: 1,
      planEntries: [
        { topicId: "t-old", plannedDate: addDays(TODAY, -4), planVersion: 1 },
        // Same planned date — syllabus order breaks the tie.
        { topicId: "t-tie-m1", plannedDate: addDays(TODAY, -1), planVersion: 1 },
        { topicId: "t-tie-m0", plannedDate: addDays(TODAY, -1), planVersion: 1 },
        { topicId: "t-today", plannedDate: TODAY, planVersion: 1 },
        { topicId: "t-future", plannedDate: addDays(TODAY, 1), planVersion: 1 },
        { topicId: "t-introduced", plannedDate: addDays(TODAY, -2), planVersion: 1 },
        { topicId: "t-archived", plannedDate: addDays(TODAY, -2), planVersion: 1 },
        // A v0 leftover dated long ago — not the current version, ignored.
        { topicId: "t-stale-version", plannedDate: addDays(TODAY, -30), planVersion: 0 },
      ],
    });
    const view = buildTodayView(goal, topics, [], readiness, TODAY);
    expect(view.newTopicIds).toEqual([
      "t-old", // −4
      "t-tie-m0", // −1, module 0 before module 1
      "t-tie-m1", // −1
      "t-today", // 0
    ]);
  });
});

describe("redistribute (§5.6)", () => {
  const topicsN = (n: number) =>
    Array.from({ length: n }, (_, i) => makeTopic(`t${i}`, { orderIndex: i }));

  it("spreads 5 topics over 12 days at floor(i·D/n): days 0, 2, 4, 7, 9", () => {
    const entries = redistribute(topicsN(5), TODAY, 12);
    expect(entries.map((e) => e.plannedDate)).toEqual(
      [0, 2, 4, 7, 9].map((d) => addDays(TODAY, d)),
    );
  });

  it("n == D·cap edge: 8 topics over 4 days land exactly cap-per-day, never over", () => {
    // The ⌈n/D⌉ ≤ cap guarantee at its tightest: n = 8, D = 4, cap = 2.
    const entries = redistribute(topicsN(8), TODAY, 4);
    expect(entries.map((e) => e.plannedDate)).toEqual(
      [0, 0, 1, 1, 2, 2, 3, 3].map((d) => addDays(TODAY, d)),
    );
    const perDay = new Map<string, number>();
    for (const e of entries) {
      perDay.set(e.plannedDate, (perDay.get(e.plannedDate) ?? 0) + 1);
    }
    expect([...perDay.values()]).toEqual([2, 2, 2, 2]);
  });

  it("fewer topics than days → even gaps, one per day at most", () => {
    const entries = redistribute(topicsN(3), TODAY, 12);
    expect(entries.map((e) => e.plannedDate)).toEqual(
      [0, 4, 8].map((d) => addDays(TODAY, d)),
    );
  });

  it("0 usable days is guarded to 1: everything lands today", () => {
    const entries = redistribute(topicsN(3), TODAY, 0);
    expect(entries.map((e) => e.plannedDate)).toEqual([TODAY, TODAY, TODAY]);
  });

  it("preserves syllabus order regardless of input order", () => {
    const shuffled = [
      makeTopic("t-m1-o0", { moduleOrderIndex: 1, orderIndex: 0 }),
      makeTopic("t-m0-o1", { moduleOrderIndex: 0, orderIndex: 1 }),
      makeTopic("t-m0-o0", { moduleOrderIndex: 0, orderIndex: 0 }),
    ];
    const entries = redistribute(shuffled, TODAY, 3);
    expect(entries.map((e) => e.topicId)).toEqual([
      "t-m0-o0",
      "t-m0-o1",
      "t-m1-o0",
    ]);
  });
});
