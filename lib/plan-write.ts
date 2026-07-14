/**
 * lib/plan-write.ts — the pure version guard for PUT /api/goals/:id/plan.
 *
 * Encodes the step-14 staleness ruling as a total function so the confirm
 * transaction's most dangerous property — that plan v0 (the immutable OPL
 * baseline, §5.5) can never be written for an already-planned goal — is
 * provable by unit test rather than asserted in a comment. The route calls
 * this inside its transaction with values re-read under the tx.
 *
 * `basePlanVersion` is what the client's proposal was computed against:
 * - `null`  → the goal was unplanned. Valid only while it STILL has no v0
 *   entries; writes version 0 and does NOT bump `currentPlanVersion`
 *   (first-write-is-v0-no-bump, step-9 ruling).
 * - number → a recalibration of that version. Valid only while v0 exists AND
 *   `currentPlanVersion` still equals it; writes version N+1 and bumps.
 *
 * Anything else is a stale proposal → "CONFLICT" (route returns 409).
 */

export type PlanWriteResolution =
  | { targetVersion: number; bump: boolean }
  | "CONFLICT";

export function resolvePlanWrite(
  basePlanVersion: number | null,
  currentPlanVersion: number,
  hasV0: boolean,
): PlanWriteResolution {
  if (basePlanVersion === null) {
    return hasV0 ? "CONFLICT" : { targetVersion: 0, bump: false };
  }
  if (!hasV0 || basePlanVersion !== currentPlanVersion) return "CONFLICT";
  return { targetVersion: basePlanVersion + 1, bump: true };
}
