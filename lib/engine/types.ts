/**
 * The engine's contract (§5): plain-object projections in, plain results out.
 *
 * These types are frozen — the API layer maps Prisma rows onto the input
 * projections and builds responses from the outputs; nothing the engine
 * returns is ever persisted (compute-on-read, invariant 3). No Prisma types
 * appear on either side.
 */

/**
 * A calendar date, `YYYY-MM-DD`, already in the user's timezone. The caller
 * computes these (§6 `?tz=` convention) — the engine never converts timezones
 * and never reads the clock.
 */
export type LocalDate = string;

export type AttemptOutcome = "CORRECT" | "INCORRECT";

/* ── Input projections ─────────────────────────────────────────────────── */

export type PlanEntryProjection = {
  topicId: string;
  plannedDate: LocalDate;
  planVersion: number;
};

export type GoalProjection = {
  id: string;
  examDate: LocalDate;
  dailyNewTopicCap: number;
  bufferDays: number;
  currentPlanVersion: number;
  /** All plan entries for the goal, every version — v0 is the immutable
   * baseline `originalPlanLength` is derived from. */
  planEntries: PlanEntryProjection[];
};

export type TopicProjection = {
  id: string;
  /** The parent module's orderIndex — redistribution and tie-breaks preserve
   * syllabus order (§5.6). */
  moduleOrderIndex: number;
  orderIndex: number;
  archived: boolean;
};

export type QuestionProjection = {
  id: string;
  topicId: string;
  archived: boolean;
};

export type AttemptProjection = {
  questionId: string;
  outcome: AttemptOutcome;
  /** Calendar day of the attempt in the user's timezone — caller converts
   * the stored UTC instant. Same-day attempts must arrive in journal order. */
  attemptedOnLocal: LocalDate;
};

/* ── Outputs ───────────────────────────────────────────────────────────── */

export type QuestionStrength = {
  questionId: string;
  topicId: string;
  /** Consecutive CORRECT outcomes counting back from the latest attempt. */
  streak: number;
  /** Current review interval in days (§5.1 ladder). */
  interval: number;
  /** Next review date; null when never attempted (§5.1). */
  dueDate: LocalDate | null;
  /** 0–1 memory strength, decayed by lateness (§5.2). */
  strength: number;
};

export type TopicReadiness = {
  topicId: string;
  /** Mean strength of the topic's active questions; no questions → 0 (§5.3). */
  readiness: number;
  /** True once any of the topic's questions has an attempt (§5.4). */
  introduced: boolean;
  /** Measured now: readiness below READINESS_THRESHOLD (resolution b). */
  notYetReady: boolean;
};

export type TodayView = {
  /** Due reviews (dueDate ≤ today), weakest strength first. */
  reviews: QuestionStrength[];
  /** Topics with a current-version plan entry due on/before today and zero
   * attempts, in planned order (§5.4). */
  newTopicIds: string[];
};

/** Mirrors the entry shape of `PUT /api/goals/:id/plan` (§6.2). */
export type ProposedPlanEntry = {
  topicId: string;
  plannedDate: LocalDate;
};

export type TriagedTopic = {
  topicId: string;
  readiness: number;
};

export type PaceMetrics = {
  totalActiveTopics: number;
  /** Active topics not yet introduced. */
  remainingTopics: number;
  /** Days from today through the day before examDate, minus bufferDays
   * (resolution a — the exam day itself is never usable). */
  daysUsable: number;
  /** Span of the immutable plan v0, first → last planned day inclusive
   * (resolution c′) — the baseline slip is measured against. */
  originalPlanLength: number;
  /** remainingTopics / max(daysUsable, 1) — topics/day needed now. */
  requiredRate: number;
  /** totalActiveTopics / originalPlanLength — topics/day as planned. */
  baselineRate: number;
  /** baselineRate × PACE_TOLERANCE. */
  onPaceThreshold: number;
  /** daysUsable × dailyNewTopicCap (§5.7). */
  capacity: number;
};

export type PaceRegime = "ON_PACE" | "SLIPPING" | "TRIAGE";

/**
 * ON_PACE carries no payload: absorption is silent because the Today view
 * already surfaces overdue plan entries — there is nothing to confirm or
 * persist. SLIPPING proposes a redistribution; TRIAGE proposes a cut. Both
 * proposals are drafts for the user to confirm via `PUT …/plan` (§3.4).
 */
export type RegimeResult =
  | { regime: "ON_PACE"; metrics: PaceMetrics }
  | {
      regime: "SLIPPING";
      metrics: PaceMetrics;
      proposedEntries: ProposedPlanEntry[];
    }
  | {
      regime: "TRIAGE";
      metrics: PaceMetrics;
      /** Weakest-first topics that fit within capacity (§5.7). */
      kept: TriagedTopic[];
      /** The explicit "won't reach" list — shown, never hidden (§5.7). */
      deferred: TriagedTopic[];
      /** Schedule for the kept set only — deferred topics get no entries. */
      proposedEntries: ProposedPlanEntry[];
    };

export type EngineResult = {
  /** Strength for every active question of the goal. */
  strengths: QuestionStrength[];
  /** Readiness for every active topic of the goal. */
  topicReadiness: TopicReadiness[];
  /** Mean of topic readiness across active topics; no topics → 0 (§5.3). */
  goalReadiness: number;
  today: TodayView;
  regime: RegimeResult;
};
