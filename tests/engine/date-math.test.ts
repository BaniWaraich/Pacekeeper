/**
 * date-math.ts unit tests.
 *
 * Every expected value here is hand-derived from the calendar, NOT computed
 * by running date-math and pasting its output back — a failure against these
 * values is a genuine engine bug, not a test to repin. 2024 is a leap year
 * (divisible by 4, not a century), so February 2024 has 29 days and 2024 has
 * 366 days.
 */
import { describe, expect, it } from "vitest";

import { addDays, dayDiff, epochDay } from "@/lib/engine/date-math";

describe("addDays", () => {
  it("crosses month ends", () => {
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
    expect(addDays("2025-04-30", 1)).toBe("2025-05-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28"); // 2025 not a leap year
  });

  it("crosses year ends", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
  });

  it("zero and multi-month deltas", () => {
    expect(addDays("2025-06-15", 0)).toBe("2025-06-15");
    // Jun 15 → Jun 30 is 15 days, +31 (July) = 46 → Aug 3 at +49.
    expect(addDays("2025-06-15", 49)).toBe("2025-08-03");
  });

  it("leap day arithmetic: Feb 2024 has 29 days", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    // Feb 29 2024 + 365: 306 days remain in 2024 after Feb 29
    // (Mar 31 + Apr 30 + May 31 + Jun 30 + Jul 31 + Aug 31 + Sep 30 +
    //  Oct 31 + Nov 30 + Dec 31), then Jan 31 → 337, +28 → Feb 28 2025.
    expect(addDays("2024-02-29", 365)).toBe("2025-02-28");
    expect(addDays("2024-02-29", 366)).toBe("2025-03-01");
  });
});

describe("dayDiff", () => {
  it("is signed: positive when `to` is later", () => {
    expect(dayDiff("2025-06-15", "2025-06-16")).toBe(1);
    expect(dayDiff("2025-06-16", "2025-06-15")).toBe(-1);
    expect(dayDiff("2025-06-15", "2025-06-15")).toBe(0);
  });

  it("crosses month and year ends", () => {
    expect(dayDiff("2025-01-31", "2025-02-01")).toBe(1);
    expect(dayDiff("2024-12-30", "2025-01-02")).toBe(3);
  });

  it("leap year spans: 2024 has 366 days, and Feb 29 → Feb 28 next year is 365", () => {
    expect(dayDiff("2024-01-01", "2025-01-01")).toBe(366);
    expect(dayDiff("2025-01-01", "2026-01-01")).toBe(365);
    expect(dayDiff("2024-02-29", "2025-02-28")).toBe(365);
    expect(dayDiff("2024-02-29", "2025-03-01")).toBe(366);
  });
});

describe("epochDay", () => {
  it("is consistent with addDays/dayDiff round trips", () => {
    expect(epochDay("1970-01-01")).toBe(0);
    expect(epochDay("1970-01-02")).toBe(1);
    expect(epochDay("2024-02-29") - epochDay("2024-02-28")).toBe(1);
  });
});
