/**
 * Regime integration tests — the loop-closers.
 *
 * Each seed fixture goal is run through the full engine and must land in its
 * target regime with the exact arithmetic written out in the fixture file's
 * §5.5 comment blocks. Every expected value below is hand-derived from those
 * blocks (and from replaying the seed PRNG independently), never computed by
 * running the engine and pasting its output back.
 */
import { describe, expect, it } from "vitest";

import { computeEngineResult } from "@/lib/engine";
import { addDays } from "@/lib/engine/date-math";
import { buildProjections, goalFixture, topicIdOf } from "./fixture-bridge";

/** Day 0 for every projection in this file — an explicit literal, never the clock. */
const TODAY = "2025-06-15";

function run(key: "A" | "B" | "C") {
  const { goal, topics, questions, attempts } = buildProjections(
    goalFixture(key),
    TODAY,
  );
  return computeEngineResult(goal, topics, questions, attempts, TODAY);
}

describe("Goal A — Human Biology Final", () => {
  const result = run("A");

  it("lands in ON_PACE", () => {
    expect(result.regime.regime).toBe("ON_PACE");
  });

  it("matches the plan-review arithmetic (§5.5 block in seed-fixtures.ts)", () => {
    const m = result.regime.metrics;
    expect(m.totalActiveTopics).toBe(9);
    expect(m.remainingTopics).toBe(3); // topics planned +2, +8, +14 never introduced
    expect(m.daysUsable).toBe(19); // (21 − 0) − 2
    expect(m.originalPlanLength).toBe(45); // plan v0 spans day −30 … +14 inclusive
    expect(m.baselineRate).toBeCloseTo(9 / 45, 12); // 0.200
    expect(m.onPaceThreshold).toBeCloseTo(0.25, 12); // 0.200 × 1.25
    expect(m.requiredRate).toBeCloseTo(3 / 19, 12); // 0.158
    expect(m.requiredRate).toBeCloseTo(0.158, 3);
    expect(m.requiredRate).toBeLessThanOrEqual(m.onPaceThreshold);
  });

  it("carries no proposal payload — absorption is silent", () => {
    expect(result.regime).not.toHaveProperty("proposedEntries");
  });
});

describe("Goal B — World History Midterm", () => {
  const result = run("B");

  it("lands in SLIPPING", () => {
    expect(result.regime.regime).toBe("SLIPPING");
  });

  it("matches the plan-review arithmetic", () => {
    const m = result.regime.metrics;
    expect(m.totalActiveTopics).toBe(9);
    expect(m.remainingTopics).toBe(5); // the five-day gap swallowed −5 and −1
    expect(m.daysUsable).toBe(12); // (14 − 0) − 2
    expect(m.originalPlanLength).toBe(33); // plan v0 spans day −21 … +11 inclusive
    expect(m.baselineRate).toBeCloseTo(9 / 33, 12);
    expect(m.onPaceThreshold).toBeCloseTo(0.341, 3); // 0.273 × 1.25
    expect(m.requiredRate).toBeCloseTo(5 / 12, 12);
    expect(m.requiredRate).toBeCloseTo(0.417, 3);
    expect(m.requiredRate).toBeGreaterThan(m.onPaceThreshold);
    expect(m.requiredRate).toBeLessThan(5); // under the cap — replan, not triage
  });

  it("spreads the 5 remaining topics over 12 days, cap-respecting, syllabus order", () => {
    if (result.regime.regime !== "SLIPPING") throw new Error("wrong regime");
    const entries = result.regime.proposedEntries;

    // The five not-yet-introduced topics in syllabus order: the two swallowed
    // by the gap (module 1, topics 1–2) then all of module 2.
    expect(entries.map((e) => e.topicId)).toEqual([
      topicIdOf("B", 1, 1), // Feudal Europe and the Crusades (planned −5)
      topicIdOf("B", 1, 2), // Renaissance and Reformation (planned −1)
      topicIdOf("B", 2, 0), // The Age of Exploration
      topicIdOf("B", 2, 1), // The Industrial Revolution
      topicIdOf("B", 2, 2), // The World Wars
    ]);

    // Even spread: topic i of 5 lands on day floor(i·12/5) → 0, 2, 4, 7, 9.
    expect(entries.map((e) => e.plannedDate)).toEqual(
      [0, 2, 4, 7, 9].map((d) => addDays(TODAY, d)),
    );

    // Never more than the daily cap on any proposed day.
    const perDay = new Map<string, number>();
    for (const e of entries) {
      perDay.set(e.plannedDate, (perDay.get(e.plannedDate) ?? 0) + 1);
    }
    for (const count of perDay.values()) {
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  it("proposes entries only for not-introduced topics", () => {
    if (result.regime.regime !== "SLIPPING") throw new Error("wrong regime");
    const introduced = new Set(
      result.topicReadiness.filter((t) => t.introduced).map((t) => t.topicId),
    );
    expect(introduced.size).toBe(4); // topics planned −21, −17, −13, −9
    for (const e of result.regime.proposedEntries) {
      expect(introduced.has(e.topicId)).toBe(false);
    }
  });
});

describe("Goal C — Statistics Exam", () => {
  const result = run("C");

  it("lands in TRIAGE", () => {
    expect(result.regime.regime).toBe("TRIAGE");
  });

  it("matches the plan-review arithmetic", () => {
    const m = result.regime.metrics;
    expect(m.totalActiveTopics).toBe(12);
    expect(m.remainingTopics).toBe(11); // only "Measures of central tendency" studied
    expect(m.daysUsable).toBe(4); // (5 − 0) − 1
    expect(m.originalPlanLength).toBe(19); // plan v0 spans day −14 … +4 inclusive
    expect(m.requiredRate).toBe(2.75); // 11 / 4
    expect(m.requiredRate).toBeGreaterThanOrEqual(2); // ≥ cap — the triage trigger
    expect(m.capacity).toBe(8); // 4 days × cap 2
  });

  it("keeps 8 and defers 4, with the 0.281-readiness introduced topic deferred last", () => {
    if (result.regime.regime !== "TRIAGE") throw new Error("wrong regime");
    const { kept, deferred } = result.regime;

    expect(kept).toHaveLength(8);
    expect(deferred).toHaveLength(4);

    // Kept: the eight weakest — all untouched (readiness 0), syllabus order.
    expect(kept.map((t) => t.topicId)).toEqual([
      topicIdOf("C", 0, 1),
      topicIdOf("C", 0, 2),
      topicIdOf("C", 0, 3),
      topicIdOf("C", 1, 0),
      topicIdOf("C", 1, 1),
      topicIdOf("C", 1, 2),
      topicIdOf("C", 1, 3),
      topicIdOf("C", 2, 0),
    ]);
    for (const t of kept) expect(t.readiness).toBe(0);

    // Deferred: three more untouched topics, then the introduced topic —
    // the STRONGEST not-yet-ready topic is the first sacrificed to the cut.
    expect(deferred.map((t) => t.topicId)).toEqual([
      topicIdOf("C", 2, 1),
      topicIdOf("C", 2, 2),
      topicIdOf("C", 2, 3),
      topicIdOf("C", 0, 0), // Measures of central tendency
    ]);
    // Hand-derived from the seed PRNG replay: question strengths
    // 0.25, 0, 0, 0.875 → readiness (0.25 + 0 + 0 + 0.875) / 4 = 0.28125.
    expect(deferred[3].readiness).toBeCloseTo(0.28125, 10);
    expect(deferred[3].readiness).toBeCloseTo(0.281, 3);
  });

  it("schedules the kept set at ≤ 2/day from today; deferred topics get no entries", () => {
    if (result.regime.regime !== "TRIAGE") throw new Error("wrong regime");
    const { kept, deferred, proposedEntries } = result.regime;

    expect(proposedEntries.map((e) => e.topicId)).toEqual(
      kept.map((t) => t.topicId),
    );
    // Weakest-first at the cap: entry i lands on day floor(i / 2).
    expect(proposedEntries.map((e) => e.plannedDate)).toEqual(
      [0, 0, 1, 1, 2, 2, 3, 3].map((d) => addDays(TODAY, d)),
    );

    const perDay = new Map<string, number>();
    for (const e of proposedEntries) {
      perDay.set(e.plannedDate, (perDay.get(e.plannedDate) ?? 0) + 1);
    }
    for (const count of perDay.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }

    const scheduled = new Set(proposedEntries.map((e) => e.topicId));
    for (const t of deferred) expect(scheduled.has(t.topicId)).toBe(false);
  });
});
