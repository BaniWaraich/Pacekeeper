"use client";

import Link from "next/link";
import type { DashboardResponse } from "@/lib/engine-io";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  TONE,
  REGIME_TONE,
  linkClass,
} from "@/app/ui";
import { percent, ReadinessBar } from "../readiness-bar";
import { useGoalReads } from "../use-goal-reads";

/**
 * Per-goal cards: regime banner + readiness bars against the 0.6 threshold
 * (SPEC 6.6 — weakest first, every weak topic actionable in one click).
 * Read-only; the SLIPPING/TRIAGE banners link into the step-14 plan-review
 * flow, and the arc discriminates on `behindCurrentPlan` ALONE (never
 * planVersion — a freshly confirmed v0 goal must read as "in effect").
 */

const rate = (x: number) => x.toFixed(1);

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
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {data.title}
        </h2>
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
          exam {data.examDate}
          {data.planned &&
            ` · ${data.planProgress.daysUsable} usable ${
              data.planProgress.daysUsable === 1 ? "day" : "days"
            } left`}
        </span>
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

  return (
    <>
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

      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">
          Goal readiness
        </span>
        <ReadinessBar value={data.goalReadiness} />
        <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
          {percent(data.goalReadiness)}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {data.topicReadiness.map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3">
            <span
              className="w-28 shrink-0 truncate text-xs text-slate-900 dark:text-slate-50"
              title={`${topic.title} (${topic.moduleTitle})`}
            >
              {topic.title}
            </span>
            <ReadinessBar value={topic.readiness} />
            <span className="w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
              {percent(topic.readiness)}
            </span>
            <Link
              href={`/goals/${data.goalId}/topics/${topic.topicId}/session`}
              className={`shrink-0 text-xs ${linkClass}`}
            >
              Quiz this now
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
