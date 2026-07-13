/**
 * Known-behavior documentation tests.
 *
 * These pin behavior that is intentional-but-surprising or simply
 * whatever-shipped-in-step-6, so a future change to it is a conscious,
 * test-breaking decision rather than an accident.
 */
import { describe, expect, it } from "vitest";

import { computeEngineResult, type AttemptProjection } from "@/lib/engine";
import { addDays } from "@/lib/engine/date-math";
import { makeGoal, makeQuestion, makeTopic } from "./fixture-bridge";

const TODAY = "2025-06-15";

describe("§5.4 blind spot — unattempted question in an introduced topic", () => {
  // INTENTIONAL, DOC-FAITHFUL, ROADMAP ITEM. §5.4 defines the today view as
  // due reviews (requires a dueDate, i.e. at least one attempt) plus new
  // topics (requires ZERO attempts on the whole topic). A question that was
  // never attempted inside a topic that HAS been started falls between the
  // two sets: it is not due (never attempted → dueDate null, §5.1) and its
  // topic is not "new" (introduced once any question has an attempt). The
  // question still drags topic readiness down as a 0 in the mean (§5.3) —
  // it is invisible to Today, not to readiness. Surfacing these is a
  // roadmap refinement, not a v1 bug.
  it("appears in neither today.reviews nor today.newTopicIds", () => {
    const topics = [makeTopic("t1")];
    const questions = [
      makeQuestion("q-attempted", "t1"),
      makeQuestion("q-never-attempted", "t1"),
    ];
    // One attempt yesterday, CORRECT → streak 1, interval 2, due tomorrow.
    const attempts: AttemptProjection[] = [
      {
        questionId: "q-attempted",
        outcome: "CORRECT",
        attemptedOnLocal: addDays(TODAY, -1),
      },
    ];
    const goal = makeGoal({
      examDate: addDays(TODAY, 10),
      planEntries: [
        { topicId: "t1", plannedDate: addDays(TODAY, -1), planVersion: 0 },
      ],
    });

    const result = computeEngineResult(goal, topics, questions, attempts, TODAY);

    // The topic is introduced, so it is not a "new" topic…
    expect(result.today.newTopicIds).toEqual([]);
    // …and neither question is due, so reviews are empty: the unattempted
    // question surfaces nowhere in the today view.
    expect(result.today.reviews).toEqual([]);
    // But readiness sees it: mean(0.5, 0) = 0.25, not 0.5.
    expect(result.topicReadiness[0].readiness).toBe(0.25);
  });
});

describe("newTopics and dailyNewTopicCap", () => {
  // PINNED CURRENT BEHAVIOR (step 6 as shipped): the today view's newTopics
  // list is UNCAPPED — dailyNewTopicCap constrains the regime math
  // (§5.5 triage trigger, §5.7 capacity/scheduling) and redistribution, but
  // buildTodayView returns EVERY current-version, due, not-introduced active
  // topic, however many that is. If the cap should ever also truncate the
  // Today list, that is an engine change with its own review — this test is
  // the tripwire that makes it deliberate.
  it("returns all due not-introduced topics even beyond the cap (uncapped)", () => {
    const topics = [
      makeTopic("t1", { orderIndex: 0 }),
      makeTopic("t2", { orderIndex: 1 }),
      makeTopic("t3", { orderIndex: 2 }),
    ];
    const goal = makeGoal({
      examDate: addDays(TODAY, 10),
      dailyNewTopicCap: 1, // cap 1, yet all 3 come back
      planEntries: [
        { topicId: "t1", plannedDate: addDays(TODAY, -2), planVersion: 0 },
        { topicId: "t2", plannedDate: addDays(TODAY, -1), planVersion: 0 },
        { topicId: "t3", plannedDate: TODAY, planVersion: 0 },
      ],
    });

    const result = computeEngineResult(goal, topics, [], [], TODAY);

    expect(result.today.newTopicIds).toEqual(["t1", "t2", "t3"]);
    expect(result.today.newTopicIds.length).toBeGreaterThan(
      goal.dailyNewTopicCap,
    );
  });
});
