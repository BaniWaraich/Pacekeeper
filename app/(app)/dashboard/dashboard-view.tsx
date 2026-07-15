"use client";

import Link from "next/link";
import type { DashboardResponse, DashboardTopicReadiness } from "@/lib/engine-io";
import type { PaceRegime } from "@/lib/engine/types";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  RegimeBadge,
  Skeleton,
  TONE,
  REGIME_TONE,
  displayText,
  linkClass,
} from "@/app/ui";
import { ReadinessRing } from "@/app/readiness-ring";
import { percent } from "../readiness-bar";
import { Countdown } from "../countdown";
import { ModuleCard, deriveTopicState } from "../module-card";
import { useGoalReads } from "../use-goal-reads";

/**
 * Per-goal cards: hero readiness ring + regime banner + module-grouped topic
 * rows against the 0.6 threshold (SPEC 6.6 — weakest first, every weak topic
 * actionable in one click). Read-only; the SLIPPING/TRIAGE banners link into
 * the step-14 plan-review flow, and the arc discriminates on
 * `behindCurrentPlan` ALONE (never planVersion — a freshly confirmed v0 goal
 * must read as "in effect").
 */

const rate = (x: number) => x.toFixed(1);

/** What the hero ring measures, with a calm regime inflection. The Alert
 *  banner below owns the numbers — these lines never repeat them. */
const HONEST_LINE: Record<PaceRegime, string> = {
  ON_PACE: "Readiness across every active topic — building on schedule.",
  SLIPPING: "Readiness across every active topic — the pace needs attention.",
  TRIAGE: "Readiness across every active topic — focused on what's still reachable.",
};

/** Group topics by module in first-encounter order: topicReadiness arrives
 *  weakest-first, so modules order by their weakest topic and topics stay
 *  weakest-first within — no sorting here. */
function groupByModule(
  topics: DashboardTopicReadiness[],
): [string, DashboardTopicReadiness[]][] {
  const groups = new Map<string, DashboardTopicReadiness[]>();
  for (const topic of topics) {
    const group = groups.get(topic.moduleTitle);
    if (group) group.push(topic);
    else groups.set(topic.moduleTitle, [topic]);
  }
  return [...groups.entries()];
}

export function DashboardView() {
  const { state, retry } = useGoalReads<DashboardResponse>("dashboard");

  if (state.status === "loading") {
    return <Skeleton rows={3} height="h-52" />;
  }

  if (state.status === "error") {
    return (
      <ErrorState
        message={`Couldn't load the dashboard: ${state.message}`}
        onRetry={retry}
      />
    );
  }

  if (state.reads.length === 0) {
    return (
      <EmptyState title="No goals yet — nothing to measure.">
        <Link href="/goals" className={linkClass}>
          Create your first goal →
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.reads.map((read) => (
        <GoalCard key={read.goalId} data={read.data} />
      ))}
    </div>
  );
}

function GoalCard({ data }: { data: DashboardResponse }) {
  return (
    <Card className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          className={`${displayText} min-w-0 flex-1 truncate text-lg text-slate-900 dark:text-slate-50`}
          title={data.title}
        >
          {data.title}
        </h2>
        {data.planned && <RegimeBadge regime={data.regime.regime} />}
        <Countdown
          daysUsable={data.planned ? data.planProgress.daysUsable : undefined}
          examDate={data.examDate}
        />
      </header>

      {data.planned ? <PlannedBody data={data} /> : <UnplannedBody data={data} />}
    </Card>
  );
}

function UnplannedBody({
  data,
}: {
  data: Extract<DashboardResponse, { planned: false }>;
}) {
  return (
    <EmptyState title="No plan yet — pace can't be measured.">
      <Link
        href={`/goals/${data.goalId}/plan`}
        className={`inline-block ${linkClass}`}
      >
        Create your study plan →
      </Link>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        or{" "}
        <Link href={`/goals/${data.goalId}`} className={linkClass}>
          keep building structure
        </Link>{" "}
        first.
      </p>
    </EmptyState>
  );
}

function PlannedBody({
  data,
}: {
  data: Extract<DashboardResponse, { planned: true }>;
}) {
  const { regime, planProgress } = data;
  const m = regime.metrics;
  const deferredCount = regime.deferred?.length ?? 0;
  // The triage pool is the not-yet-ready set (kept + deferred) — it can
  // exceed metrics.remainingTopics by the introduced-but-weak topics, and
  // the banner's arithmetic must agree with the at-risk list below it.
  const triagePool = (regime.keptCount ?? 0) + deferredCount;
  const deferredIds = new Set(regime.deferred?.map((d) => d.topicId));

  return (
    <>
      <div className="flex flex-wrap items-center gap-5">
        <ReadinessRing
          value={data.goalReadiness}
          size="hero"
          animate
          label={`Goal readiness — ${data.title}`}
        />
        <div className="min-w-0 flex-1 basis-52">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
            Goal readiness
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {HONEST_LINE[regime.regime]}
          </p>
        </div>
      </div>

      <Alert tone={REGIME_TONE[regime.regime]}>
        <p>
          {regime.regime === "ON_PACE" && (
            <>
              <strong>On pace.</strong> {planProgress.introducedTopics} of{" "}
              {planProgress.totalActiveTopics} topics introduced ·{" "}
              {planProgress.daysUsable} usable{" "}
              {planProgress.daysUsable === 1 ? "day" : "days"} left. Keep this
              rhythm and everything is covered before {data.examDate}.
            </>
          )}
          {regime.regime === "SLIPPING" &&
            (regime.behindCurrentPlan ? (
              <>
                <strong>Falling behind.</strong> Covering the remaining{" "}
                {m.remainingTopics} topics now takes {rate(m.requiredRate)}
                /day, up from the planned {rate(m.baselineRate)}/day.{" "}
                <Link
                  href={`/goals/${data.goalId}/plan`}
                  className="font-medium underline"
                >
                  Review the recalibrated plan →
                </Link>
              </>
            ) : (
              <>
                <strong>Plan redistributed.</strong> Following your
                recalibrated pace of {rate(m.requiredRate)}/day.
              </>
            ))}
          {regime.regime === "TRIAGE" &&
            (regime.behindCurrentPlan ? (
              <>
                <strong>Full coverage is no longer realistic.</strong> At your
                cap of {data.dailyNewTopicCap} new topics/day, only{" "}
                {regime.keptCount} of the {triagePool} topics not yet ready fit
                before {data.examDate}.{" "}
                <strong>
                  {deferredCount}{" "}
                  {deferredCount === 1 ? "topic is" : "topics are"} at risk
                </strong>{" "}
                — listed below, weakest first.{" "}
                <Link
                  href={`/goals/${data.goalId}/plan`}
                  className="font-medium underline"
                >
                  Review triage →
                </Link>
              </>
            ) : (
              <>
                <strong>Triaged plan in effect.</strong> {regime.keptCount}{" "}
                kept {regime.keptCount === 1 ? "topic" : "topics"} on schedule;{" "}
                {deferredCount} deferred, at risk — listed below, weakest
                first.
              </>
            ))}
        </p>
      </Alert>

      {regime.regime === "TRIAGE" && (regime.deferred?.length ?? 0) > 0 && (
        <div
          className={`flex flex-col gap-2 rounded-lg border px-4 py-3 ${TONE.danger}`}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide">
            At risk — won&apos;t be reached at the current cap
          </h3>
          <ul className="flex flex-col gap-1.5">
            {regime.deferred?.map((topic) => (
              <li
                key={topic.topicId}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate text-sm">{topic.title}</span>
                <span className="shrink-0 text-xs opacity-80">
                  readiness {percent(topic.readiness)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {groupByModule(data.topicReadiness).map(([moduleTitle, topics]) => (
          <ModuleCard
            key={moduleTitle}
            title={moduleTitle}
            topics={topics.map((topic) => ({
              topicId: topic.topicId,
              title: topic.title,
              readiness: topic.readiness,
              state: deriveTopicState(topic, deferredIds.has(topic.topicId)),
              quizHref: `/goals/${data.goalId}/topics/${topic.topicId}/session`,
            }))}
          />
        ))}
      </div>
    </>
  );
}
