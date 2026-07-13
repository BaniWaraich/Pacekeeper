/**
 * strength.ts unit tests — §5.1 streaks/intervals, §5.2 decay, §5.3 readiness.
 * Expected strengths are hand-computed from the §5.2 formulas.
 */
import { describe, expect, it } from "vitest";

import {
  computeReadiness,
  computeStrengths,
  INTERVALS,
  questionStrength,
  type AttemptProjection,
} from "@/lib/engine";
import { addDays } from "@/lib/engine/date-math";
import { makeQuestion, makeTopic } from "./fixture-bridge";

const TODAY = "2025-06-15";
const Q = makeQuestion("q1", "t1");

/** One attempt per day-offset, oldest first, with the given outcomes. */
function history(
  ...entries: [dayOffset: number, outcome: "CORRECT" | "INCORRECT"][]
): AttemptProjection[] {
  return entries.map(([day, outcome]) => ({
    questionId: "q1",
    outcome,
    attemptedOnLocal: addDays(TODAY, day),
  }));
}

describe("streak counting (§5.1)", () => {
  it("counts consecutive CORRECT back from the latest attempt", () => {
    const s = questionStrength(
      Q,
      history([-9, "CORRECT"], [-8, "CORRECT"], [-7, "INCORRECT"], [-6, "CORRECT"]),
      TODAY,
    );
    expect(s.streak).toBe(1); // the INCORRECT at −7 reset it
  });

  it("an INCORRECT latest attempt → streak 0, due the next day", () => {
    const s = questionStrength(Q, history([-1, "INCORRECT"]), TODAY);
    expect(s.streak).toBe(0);
    expect(s.interval).toBe(1);
    expect(s.dueDate).toBe(TODAY); // −1 + interval 1
    expect(s.strength).toBe(0); // base = 1 − 0.5⁰ = 0
  });

  it("same-day attempts keep journal order (stable sort): [C, I] → 0, [I, C] → 1", () => {
    const day = addDays(TODAY, -1);
    const ci: AttemptProjection[] = [
      { questionId: "q1", outcome: "CORRECT", attemptedOnLocal: day },
      { questionId: "q1", outcome: "INCORRECT", attemptedOnLocal: day },
    ];
    const ic = [...ci].reverse();
    // The stable sort lives in computeStrengths — go through it.
    expect(computeStrengths([Q], ci, TODAY)[0].streak).toBe(0);
    expect(computeStrengths([Q], ic, TODAY)[0].streak).toBe(1);
  });

  it("cross-day attempts arriving out of order are sorted by day first", () => {
    // Journal reality: INCORRECT on −5, then CORRECT on −1 → streak 1,
    // regardless of the array arriving newest-first.
    const outOfOrder = history([-1, "CORRECT"], [-5, "INCORRECT"]);
    expect(computeStrengths([Q], outOfOrder, TODAY)[0].streak).toBe(1);
  });
});

describe("interval ladder (§5.1)", () => {
  it("streaks 0–5 walk the ladder [1, 2, 4, 7, 12, 20]", () => {
    expect(INTERVALS).toEqual([1, 2, 4, 7, 12, 20]);
    for (let streak = 0; streak <= 5; streak++) {
      const attempts = history(
        [-streak - 1, "INCORRECT"], // anchor so streak is exactly `streak`
        ...Array.from(
          { length: streak },
          (_, i) => [-streak + i, "CORRECT"] as [number, "CORRECT"],
        ),
      );
      const s = questionStrength(Q, attempts, TODAY);
      expect(s.streak).toBe(streak);
      expect(s.interval).toBe([1, 2, 4, 7, 12, 20][streak]);
    }
  });

  it("clamps at index 5: streak 8 still gets interval 20", () => {
    const attempts = history(
      ...Array.from(
        { length: 8 },
        (_, i) => [-8 + i, "CORRECT"] as [number, "CORRECT"],
      ),
    );
    const s = questionStrength(Q, attempts, TODAY);
    expect(s.streak).toBe(8);
    expect(s.interval).toBe(20);
  });
});

describe("strength decay (§5.2) at exact interval boundaries", () => {
  // streak 2 → base = 1 − 0.5² = 0.75, interval 4.
  const streak2 = (lastDay: number) =>
    history([lastDay - 1, "CORRECT"], [lastDay, "CORRECT"]);

  it("due exactly today (overdue 0) → no decay: strength 0.75", () => {
    const s = questionStrength(Q, streak2(-4), TODAY); // due −4 + 4 = today
    expect(s.dueDate).toBe(TODAY);
    expect(s.strength).toBe(0.75);
  });

  it("overdue exactly one full interval → strength halves: 0.375", () => {
    const s = questionStrength(Q, streak2(-8), TODAY); // due −4, overdue 4 = interval
    expect(s.strength).toBe(0.75 * 0.5);
  });

  it("overdue half an interval → ×0.5^0.5", () => {
    const s = questionStrength(Q, streak2(-6), TODAY); // due −2, overdue 2 = interval/2
    expect(s.strength).toBeCloseTo(0.75 * Math.pow(0.5, 0.5), 12);
  });

  it("not yet due → no decay (overdue clamps at 0)", () => {
    const s = questionStrength(Q, streak2(-1), TODAY); // due +3
    expect(s.strength).toBe(0.75);
  });
});

describe("unattempted questions", () => {
  it("→ streak 0, no due date, strength 0", () => {
    const s = questionStrength(Q, [], TODAY);
    expect(s.streak).toBe(0);
    expect(s.dueDate).toBeNull();
    expect(s.strength).toBe(0);
  });

  it("count as 0 inside the readiness mean — readiness is honest about untested material", () => {
    const topics = [makeTopic("t1")];
    const questions = [makeQuestion("q1", "t1"), makeQuestion("q2", "t1")];
    // q1: single CORRECT today → base 0.5, due +2, overdue 0 → strength 0.5.
    const attempts: AttemptProjection[] = [
      { questionId: "q1", outcome: "CORRECT", attemptedOnLocal: TODAY },
    ];
    const strengths = computeStrengths(questions, attempts, TODAY);
    const { topics: readiness } = computeReadiness(topics, questions, attempts, strengths);
    expect(readiness[0].readiness).toBe(0.25); // mean(0.5, 0)
  });
});

describe("archived questions", () => {
  const topics = [makeTopic("t1")];
  const archived = makeQuestion("q-archived", "t1", true);
  const active = makeQuestion("q-active", "t1");
  const attempts: AttemptProjection[] = [
    // The only attempt in the journal is on the since-archived question.
    { questionId: "q-archived", outcome: "CORRECT", attemptedOnLocal: addDays(TODAY, -1) },
  ];

  it("are excluded from computeStrengths", () => {
    const strengths = computeStrengths([archived, active], attempts, TODAY);
    expect(strengths.map((s) => s.questionId)).toEqual(["q-active"]);
  });

  it("leave the readiness mean, but their attempts still mark the topic introduced", () => {
    const strengths = computeStrengths([archived, active], attempts, TODAY);
    const { topics: readiness } = computeReadiness(
      topics,
      [archived, active],
      attempts,
      strengths,
    );
    expect(readiness[0].readiness).toBe(0); // mean over the active question only
    expect(readiness[0].introduced).toBe(true); // the journal fact survives archiving
  });
});

describe("readiness empty cases (§5.3)", () => {
  it("a topic with no questions → readiness 0", () => {
    const topics = [makeTopic("t-empty")];
    const { topics: readiness } = computeReadiness(topics, [], [], []);
    expect(readiness[0].readiness).toBe(0);
    expect(readiness[0].notYetReady).toBe(true);
  });

  it("no active topics → goalReadiness 0", () => {
    const { goalReadiness } = computeReadiness([], [], [], []);
    expect(goalReadiness).toBe(0);
  });
});
