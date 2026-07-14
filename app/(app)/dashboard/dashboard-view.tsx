"use client";

import Link from "next/link";
import type { DashboardResponse } from "@/lib/engine-io";
import { percent, ReadinessBar } from "../readiness-bar";
import { useGoalReads } from "../use-goal-reads";

/**
 * Per-goal cards: regime banner + readiness bars against the 0.6 threshold
 * (SPEC 6.6 — weakest first, every weak topic actionable in one click).
 * Read-only; the SLIPPING/TRIAGE banners link into the step-14 plan-review
 * flow, and the arc discriminates on `behindCurrentPlan` ALONE (never
 * planVersion — a freshly confirmed v0 goal must read as "in effect").
 */

const REGIME_BANNER: Record<string, string> = {
  ON_PACE:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  SLIPPING:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  TRIAGE:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
};

const rate = (x: number) => x.toFixed(1);

export function DashboardView() {
  const { state, retry } = useGoalReads<DashboardResponse>("dashboard");

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-900 dark:text-red-100">
          Couldn&apos;t load the dashboard: {state.message}
        </p>
        <button
          type="button"
          onClick={retry}
          className="rounded border border-red-300 px-3 py-1 text-sm text-red-900 hover:bg-red-100 dark:border-red-800 dark:text-red-100 dark:hover:bg-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.reads.length === 0) {
    return (
      <div className="rounded border border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-900 dark:text-zinc-50">
          No goals yet — nothing to measure.
        </p>
        <Link
          href="/goals"
          className="mt-2 inline-block text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Create your first goal →
        </Link>
      </div>
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
    <section className="flex flex-col gap-4 rounded border border-zinc-300 px-4 py-4 dark:border-zinc-700">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {data.title}
        </h2>
        <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
          exam {data.examDate}
          {data.planned &&
            ` · ${data.planProgress.daysUsable} usable ${
              data.planProgress.daysUsable === 1 ? "day" : "days"
            } left`}
        </span>
      </header>

      {data.planned ? <PlannedBody data={data} /> : <UnplannedBody data={data} />}
    </section>
  );
}

function UnplannedBody({
  data,
}: {
  data: Extract<DashboardResponse, { planned: false }>;
}) {
  return (
    <div className="rounded border border-dashed border-zinc-300 px-4 py-6 text-center dark:border-zinc-700">
      <p className="text-sm text-zinc-900 dark:text-zinc-50">
        No plan yet — pace can&apos;t be measured.
      </p>
      <Link
        href={`/goals/${data.goalId}/plan`}
        className="mt-2 inline-block text-sm font-medium text-zinc-900 underline hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
      >
        Create your study plan →
      </Link>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        or{" "}
        <Link
          href={`/goals/${data.goalId}`}
          className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          keep building structure
        </Link>{" "}
        first.
      </p>
    </div>
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
      <div className={`rounded border px-4 py-3 ${REGIME_BANNER[regime.regime]}`}>
        <p className="text-sm">
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
      </div>

      {regime.regime === "TRIAGE" && (regime.deferred?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2 rounded border border-red-300 px-4 py-3 dark:border-red-900">
          <h3 className="text-xs font-semibold uppercase text-red-900 dark:text-red-100">
            At risk — won&apos;t be reached at the current cap
          </h3>
          <ul className="flex flex-col gap-1.5">
            {regime.deferred?.map((topic) => (
              <li
                key={topic.topicId}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate text-sm text-zinc-900 dark:text-zinc-50">
                  {topic.title}
                </span>
                <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                  readiness {percent(topic.readiness)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
          Goal readiness
        </span>
        <ReadinessBar value={data.goalReadiness} />
        <span className="w-10 shrink-0 text-right text-xs text-zinc-600 dark:text-zinc-400">
          {percent(data.goalReadiness)}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {data.topicReadiness.map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3">
            <span
              className="w-28 shrink-0 truncate text-xs text-zinc-900 dark:text-zinc-50"
              title={`${topic.title} (${topic.moduleTitle})`}
            >
              {topic.title}
            </span>
            <ReadinessBar value={topic.readiness} />
            <span className="w-10 shrink-0 text-right text-xs text-zinc-600 dark:text-zinc-400">
              {percent(topic.readiness)}
            </span>
            <Link
              href={`/goals/${data.goalId}/topics/${topic.topicId}/session`}
              className="shrink-0 text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Quiz this now
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
