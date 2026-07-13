/**
 * The engine's tunable constants, in one place (§5.5).
 */

/** Expanding review intervals in days, indexed by min(streak, 5) (§5.1). */
export const INTERVALS = [1, 2, 4, 7, 12, 20] as const;

/**
 * requiredRate may exceed baselineRate by this factor and stay ON_PACE —
 * the tolerance that keeps one slow weekend from flipping regimes (§5.5).
 */
export const PACE_TOLERANCE = 1.25;

/**
 * A topic is notYetReady while its measured readiness is below this
 * (resolution b). Absent from §5 — value chosen by product ruling.
 */
export const READINESS_THRESHOLD = 0.6;
