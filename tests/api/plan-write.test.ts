/**
 * resolvePlanWrite unit tests — the step-14 staleness ruling, exhaustively.
 *
 * The property that matters most: once v0 exists, NO input can resolve to a
 * write at version 0 — plan v0 is the immutable OPL baseline (§5.5) and the
 * confirm transaction leans on this function for that guarantee.
 */
import { describe, expect, it } from "vitest";

import { resolvePlanWrite } from "@/lib/plan-write";

describe("resolvePlanWrite (step 14)", () => {
  it("null base + no v0 → writes v0 and does NOT bump (first-write-is-v0)", () => {
    expect(resolvePlanWrite(null, 0, false)).toEqual({
      targetVersion: 0,
      bump: false,
    });
  });

  it("null base + v0 exists → CONFLICT (initial confirm raced a landed plan)", () => {
    expect(resolvePlanWrite(null, 0, true)).toBe("CONFLICT");
    expect(resolvePlanWrite(null, 3, true)).toBe("CONFLICT");
  });

  it("matching base + v0 exists → writes base+1 and bumps", () => {
    // The ambiguous version-0 case the null discriminator exists for: a
    // PLANNED goal at version 0 (post v0-no-bump) recalibrating to v1.
    expect(resolvePlanWrite(0, 0, true)).toEqual({ targetVersion: 1, bump: true });
    expect(resolvePlanWrite(2, 2, true)).toEqual({ targetVersion: 3, bump: true });
  });

  it("mismatching base → CONFLICT (another confirm moved the version)", () => {
    expect(resolvePlanWrite(0, 1, true)).toBe("CONFLICT");
    expect(resolvePlanWrite(2, 1, true)).toBe("CONFLICT");
    expect(resolvePlanWrite(3, 2, true)).toBe("CONFLICT");
  });

  it("numbered base without v0 → CONFLICT (no plan to recalibrate)", () => {
    expect(resolvePlanWrite(0, 0, false)).toBe("CONFLICT");
    expect(resolvePlanWrite(1, 1, false)).toBe("CONFLICT");
  });

  it("v0 is unreachable once it exists: no hasV0 input yields targetVersion 0", () => {
    for (const base of [null, 0, 1, 2, 3]) {
      for (const current of [0, 1, 2, 3]) {
        const resolution = resolvePlanWrite(base, current, true);
        if (resolution !== "CONFLICT") {
          expect(resolution.targetVersion).toBeGreaterThan(0);
        }
      }
    }
  });
});
