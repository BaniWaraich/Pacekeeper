/**
 * Ruling boundary tests — synthetic micro-fixtures.
 *
 * The seed fixtures deliberately avoid these edges; these tests pin the
 * step-6 boundary rulings themselves:
 *   (a)  daysUsable excludes the exam day, subtracts buffer, floors at 0
 *   (b)  notYetReady is a strict `readiness < READINESS_THRESHOLD`
 *   (c′) originalPlanLength is the immutable plan-v0 span
 *   requiredRate ≥ cap → TRIAGE, and TRIAGE is checked before ON_PACE
 *   ON_PACE's tolerance comparison is inclusive (≤)
 *
 * Numbers are chosen to be float-exact (powers of two where equality is
 * asserted) and hand-derived — never read back from the engine.
 */
import { describe, expect, it } from "vitest";

import {
  computeReadiness,
  computeRegime,
  daysUsable,
  originalPlanLength,
  READINESS_THRESHOLD,
  type TopicProjection,
  type TopicReadiness,
} from "@/lib/engine";
import { addDays } from "@/lib/engine/date-math";
import { makeGoal, makeQuestion, makeStrength, makeTopic } from "./fixture-bridge";

const TODAY = "2025-06-15";

/** `total` active topics (syllabus order t00, t01, …), first `introduced` marked introduced. */
function topicsAndReadiness(
  total: number,
  introduced: number,
): { topics: TopicProjection[]; readiness: TopicReadiness[] } {
  const topics = Array.from({ length: total }, (_, i) =>
    makeTopic(`t${String(i).padStart(2, "0")}`, { orderIndex: i }),
  );
  const readiness = topics.map((t, i) => ({
    topicId: t.id,
    readiness: i < introduced ? 0.9 : 0,
    introduced: i < introduced,
    notYetReady: i >= introduced,
  }));
  return { topics, readiness };
}

/** Plan v0 with one entry per topic, spread over `spanDays` days ending yesterday. */
function v0Span(topics: TopicProjection[], spanDays: number) {
  return topics.map((t, i) => ({
    topicId: t.id,
    plannedDate: addDays(TODAY, -spanDays + (i % spanDays)),
    planVersion: 0,
  }));
}

describe("cap boundary — requiredRate ≥ cap is TRIAGE (the ≥ ruling)", () => {
  it("requiredRate exactly == cap → TRIAGE, not SLIPPING", () => {
    // 10 topics, 2 introduced → remaining 8; exam in 4 days, no buffer →
    // daysUsable 4; requiredRate 8/4 = 2.0 == cap 2. Plan v0 spans 10 days →
    // baselineRate 1.0, threshold 1.25 < 2.0, so a strict `>` reading would
    // land SLIPPING; the ≥ ruling lands TRIAGE.
    const { topics, readiness } = topicsAndReadiness(10, 2);
    const goal = makeGoal({
      examDate: addDays(TODAY, 4),
      bufferDays: 0,
      dailyNewTopicCap: 2,
      planEntries: v0Span(topics, 10),
    });

    const result = computeRegime(goal, topics, readiness, TODAY);
    expect(result.metrics.requiredRate).toBe(2);
    expect(result.regime).toBe("TRIAGE");
  });
});

describe("triage-first precedence — the cap wins over a stretched ON_PACE band", () => {
  // Inflated baseline: 20 topics squeezed into a 4-day v0 span → baselineRate
  // 5.0, onPaceThreshold 6.25 — the ON_PACE band reaches past the cap of 2.
  const { topics, readiness: at8 } = topicsAndReadiness(20, 12); // remaining 8
  const planEntries = v0Span(topics, 4);

  it("requiredRate == cap with threshold > cap → still TRIAGE (checked first)", () => {
    const goal = makeGoal({
      examDate: addDays(TODAY, 4),
      bufferDays: 0,
      dailyNewTopicCap: 2,
      planEntries,
    });
    const result = computeRegime(goal, topics, at8, TODAY);
    expect(result.metrics.requiredRate).toBe(2); // 8 / 4
    expect(result.metrics.onPaceThreshold).toBe(6.25); // 5.0 × 1.25 — band past the cap
    expect(result.regime).toBe("TRIAGE"); // ON_PACE (2 ≤ 6.25) never gets a look
  });

  it("requiredRate just under cap → NOT triage (the other branches are reachable)", () => {
    const at7 = topicsAndReadiness(20, 13).readiness; // remaining 7
    const goal = makeGoal({
      examDate: addDays(TODAY, 4),
      bufferDays: 0,
      dailyNewTopicCap: 2,
      planEntries,
    });
    const result = computeRegime(goal, topics, at7, TODAY);
    expect(result.metrics.requiredRate).toBe(1.75); // 7 / 4 < cap 2
    expect(result.regime).toBe("ON_PACE"); // 1.75 ≤ 6.25
  });
});

describe("ON_PACE boundary — the tolerance comparison is inclusive (≤)", () => {
  // Float-exact setup: 8 topics over a 4-day v0 span → baselineRate 2.0,
  // onPaceThreshold 2.5 (both exact binary). Cap 3 keeps triage out of play.
  const { topics } = topicsAndReadiness(8, 0);
  const planEntries = v0Span(topics, 4);

  it("requiredRate exactly == baseline × 1.25 → ON_PACE (tolerance, not a cap)", () => {
    const { readiness } = topicsAndReadiness(8, 3); // remaining 5
    const goal = makeGoal({
      examDate: addDays(TODAY, 2), // daysUsable 2 → requiredRate 5/2 = 2.5
      bufferDays: 0,
      dailyNewTopicCap: 3,
      planEntries,
    });
    const result = computeRegime(goal, topics, readiness, TODAY);
    expect(result.metrics.requiredRate).toBe(2.5);
    expect(result.metrics.onPaceThreshold).toBe(2.5);
    expect(result.regime).toBe("ON_PACE");
  });

  it("requiredRate just over the threshold → SLIPPING", () => {
    const { readiness } = topicsAndReadiness(8, 0); // remaining 8
    const goal = makeGoal({
      examDate: addDays(TODAY, 3), // daysUsable 3 → requiredRate 8/3 ≈ 2.667
      bufferDays: 0,
      dailyNewTopicCap: 3,
      planEntries,
    });
    const result = computeRegime(goal, topics, readiness, TODAY);
    expect(result.metrics.requiredRate).toBeGreaterThan(2.5);
    expect(result.metrics.requiredRate).toBeLessThan(3);
    expect(result.regime).toBe("SLIPPING");
  });
});

describe("readiness threshold — strict `<` (resolution b)", () => {
  it("READINESS_THRESHOLD is 0.6", () => {
    expect(READINESS_THRESHOLD).toBe(0.6);
  });

  it("readiness exactly 0.6 → ready (not notYetReady)", () => {
    const topics = [makeTopic("t1")];
    const questions = [makeQuestion("q1", "t1")];
    const strengths = [makeStrength("q1", "t1", { strength: 0.6 })];
    const { topics: readiness } = computeReadiness(topics, questions, [], strengths);
    expect(readiness[0].readiness).toBe(0.6);
    expect(readiness[0].notYetReady).toBe(false);
  });

  it("readiness just below 0.6 → notYetReady", () => {
    const topics = [makeTopic("t1")];
    const questions = [makeQuestion("q1", "t1")];
    const strengths = [makeStrength("q1", "t1", { strength: 0.59 })];
    const { topics: readiness } = computeReadiness(topics, questions, [], strengths);
    expect(readiness[0].notYetReady).toBe(true);
  });
});

describe("originalPlanLength — the immutable plan-v0 span (resolution c′)", () => {
  it("derives from the v0 span even when a wider v1 is current", () => {
    // v0 spans 5 days (−10 … −6). v1 — the current version — spans 41 days,
    // and the exam is 30 days out: a createdAt- or exam-derived span would be
    // anything but 5. Ruling c′ pins it to the v0 span forever.
    const goal = makeGoal({
      examDate: addDays(TODAY, 30),
      currentPlanVersion: 1,
      planEntries: [
        { topicId: "t1", plannedDate: addDays(TODAY, -10), planVersion: 0 },
        { topicId: "t2", plannedDate: addDays(TODAY, -6), planVersion: 0 },
        { topicId: "t1", plannedDate: addDays(TODAY, -20), planVersion: 1 },
        { topicId: "t2", plannedDate: addDays(TODAY, 20), planVersion: 1 },
      ],
    });
    expect(originalPlanLength(goal)).toBe(5);

    // And the regime math uses it: 2 active topics / 5 days.
    const { topics, readiness } = topicsAndReadiness(2, 2);
    const goalWithTopics = makeGoal({
      ...goal,
      planEntries: goal.planEntries.map((e, i) => ({
        ...e,
        topicId: topics[i % 2].id,
      })),
    });
    const result = computeRegime(goalWithTopics, topics, readiness, TODAY);
    expect(result.metrics.originalPlanLength).toBe(5);
    expect(result.metrics.baselineRate).toBe(2 / 5);
  });

  it("a single v0 entry → span 1; no v0 entries → guarded to 1", () => {
    expect(
      originalPlanLength(
        makeGoal({
          planEntries: [
            { topicId: "t1", plannedDate: TODAY, planVersion: 0 },
          ],
        }),
      ),
    ).toBe(1);
    expect(originalPlanLength(makeGoal({ planEntries: [] }))).toBe(1);
  });
});

describe("daysUsable (resolution a) and the requiredRate guard", () => {
  it("exam tomorrow, no buffer → 1 (the exam day itself is never usable)", () => {
    const goal = makeGoal({ examDate: addDays(TODAY, 1), bufferDays: 0 });
    expect(daysUsable(goal, TODAY)).toBe(1);
  });

  it("bufferDays subtract", () => {
    const goal = makeGoal({ examDate: addDays(TODAY, 10), bufferDays: 3 });
    expect(daysUsable(goal, TODAY)).toBe(7);
  });

  it("floors at 0 when the buffer swallows the runway", () => {
    const goal = makeGoal({ examDate: addDays(TODAY, 2), bufferDays: 5 });
    expect(daysUsable(goal, TODAY)).toBe(0);
  });

  it("exam today → 0", () => {
    const goal = makeGoal({ examDate: TODAY, bufferDays: 0 });
    expect(daysUsable(goal, TODAY)).toBe(0);
  });

  it("requiredRate divides by max(daysUsable, 1): 0 usable days, 3 remaining → rate 3", () => {
    const { topics, readiness } = topicsAndReadiness(3, 0);
    const goal = makeGoal({
      examDate: TODAY, // daysUsable 0
      bufferDays: 0,
      dailyNewTopicCap: 10, // keep the cap out of the way of the assertion
      planEntries: v0Span(topics, 3),
    });
    const result = computeRegime(goal, topics, readiness, TODAY);
    expect(result.metrics.daysUsable).toBe(0);
    expect(result.metrics.requiredRate).toBe(3); // 3 / max(0, 1)
  });
});
