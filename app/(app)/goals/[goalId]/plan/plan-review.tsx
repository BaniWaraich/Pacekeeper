"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProposedEntryItem,
  RecalibrateResponse,
  TriagedTopicItem,
} from "@/lib/engine-io";
import {
  Alert,
  EmptyState,
  ErrorState,
  Skeleton,
  TONE,
  btnPrimary,
  linkClass,
} from "@/app/ui";
import { ReadinessBar, percent } from "../../../readiness-bar";
import { ApiError, fetchJson } from "../../fetch-json";

/**
 * Step 14 review screen — one component, every proposal shape: INITIAL /
 * INITIAL_TRIAGE (first plan for an unplanned goal), SLIPPING redistribution,
 * TRIAGE cut. The proposal lives only in client state (POST …/recalibrate is
 * pure); Confirm is the single write (PUT …/plan) and is review-only — no
 * editing (SPEC 5.4's "adjusts" is deferred; the PUT contract already accepts
 * arbitrary entries, so an edit UI needs no API change).
 *
 * Staleness: the proposal carries the basePlanVersion it was computed
 * against; a 409 on confirm means the plan moved underneath it — the screen
 * automatically refetches and re-presents the fresh proposal with a notice,
 * so a stale write is impossible rather than merely unlikely.
 */

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; proposal: RecalibrateResponse };

const rate = (x: number) => x.toFixed(1);

export function PlanReview({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [stale, setStale] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // The use-goal-reads effect shape: the initial state covers the first
  // load; retry and the 409 path (event handlers, not effects) reset to
  // loading and bump `attempt` to re-run.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    (async () => {
      const proposal = await fetchJson<RecalibrateResponse>(
        `/api/goals/${goalId}/recalibrate?tz=${encodeURIComponent(tz)}`,
        "POST",
      );
      if (!cancelled) setState({ status: "ready", proposal });
    })().catch((e: unknown) => {
      if (!cancelled) {
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Request failed",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [goalId, attempt]);

  const reload = () => {
    setState({ status: "loading" });
    setConfirmError(null);
    setAttempt((n) => n + 1);
  };

  const confirm = async () => {
    if (state.status !== "ready" || confirming) return;
    const proposal = state.proposal;
    if (proposal.mode === "ON_PACE") return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await fetchJson(`/api/goals/${goalId}/plan`, "PUT", {
        basePlanVersion: proposal.basePlanVersion,
        entries: proposal.proposedEntries.map((e) => ({
          topicId: e.topicId,
          plannedDate: e.plannedDate,
        })),
      });
      // Stay disabled through the navigation — the change is visible there.
      router.push("/dashboard");
    } catch (e) {
      setConfirming(false);
      if (e instanceof ApiError && e.status === 409) {
        // The plan moved between proposal and confirm: never retry the stale
        // payload — refetch and re-present.
        setStale(true);
        reload();
      } else {
        setConfirmError(e instanceof Error ? e.message : "Request failed");
      }
    }
  };

  if (state.status === "loading") {
    return <Skeleton rows={3} height="h-16" />;
  }

  if (state.status === "error") {
    return (
      <ErrorState
        message={`Couldn't compute the proposal: ${state.message}`}
        onRetry={reload}
      />
    );
  }

  const proposal = state.proposal;

  if (proposal.mode === "ON_PACE") {
    return (
      <EmptyState title="You're on pace — nothing to recalibrate.">
        <Link href="/dashboard" className={linkClass}>
          See where you stand →
        </Link>
      </EmptyState>
    );
  }

  if (proposal.mode === "INITIAL" && proposal.proposedEntries.length === 0) {
    return (
      <EmptyState title="No topics to schedule yet.">
        <Link href={`/goals/${goalId}`} className={linkClass}>
          Add modules and topics first →
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {stale && (
        <Alert tone="warn">
          Your plan changed since this proposal was computed — review the fresh
          proposal below.
        </Alert>
      )}

      <ProposalBody proposal={proposal} />

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={confirming || proposal.proposedEntries.length === 0}
          className={btnPrimary}
        >
          {confirming ? "Confirming…" : confirmLabel(proposal.mode)}
        </button>
        {proposal.proposedEntries.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nothing can be scheduled — no usable days remain before the exam.
          </p>
        )}
        {confirmError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t confirm: {confirmError}
          </p>
        )}
      </div>
    </div>
  );
}

function confirmLabel(
  mode: "INITIAL" | "INITIAL_TRIAGE" | "SLIPPING" | "TRIAGE",
): string {
  switch (mode) {
    case "INITIAL":
      return "Confirm plan";
    case "SLIPPING":
      return "Confirm redistribution";
    case "INITIAL_TRIAGE":
    case "TRIAGE":
      return "Confirm triaged plan";
  }
}

function ProposalBody({
  proposal,
}: {
  proposal: Exclude<RecalibrateResponse, { mode: "ON_PACE" }>;
}) {
  if (proposal.mode === "INITIAL") {
    return (
      <>
        <Alert tone="neutral">
          <strong>Your study plan.</strong> {proposal.proposedEntries.length}{" "}
          {proposal.proposedEntries.length === 1 ? "topic" : "topics"} across{" "}
          {proposal.daysUsable} usable{" "}
          {proposal.daysUsable === 1 ? "day" : "days"} before {proposal.examDate}
          . Confirming makes this the baseline your pace is measured against.
        </Alert>
        <DaySchedule entries={proposal.proposedEntries} today={proposal.todayLocal} />
      </>
    );
  }

  if (proposal.mode === "SLIPPING") {
    const m = proposal.metrics;
    return (
      <>
        <Alert tone="warn">
          <strong>Catch-up pace.</strong> Covering the remaining{" "}
          {m.remainingTopics} topics now takes {rate(m.requiredRate)}/day, up
          from the planned {rate(m.baselineRate)}/day. The redistribution below
          spreads them across your {proposal.daysUsable} usable{" "}
          {proposal.daysUsable === 1 ? "day" : "days"}.
        </Alert>
        <DaySchedule entries={proposal.proposedEntries} today={proposal.todayLocal} />
      </>
    );
  }

  // TRIAGE and INITIAL_TRIAGE share the kept/deferred rendering; only the
  // framing differs — a goal with no history hasn't "fallen behind", it just
  // doesn't fit at the stated cap (step-14 ruling 5).
  const pool = proposal.kept.length + proposal.deferred.length;
  return (
    <>
      <Alert tone="danger">
        {proposal.mode === "TRIAGE" ? (
          <>
            <strong>Full coverage is no longer realistic.</strong> At your cap
            of {proposal.dailyNewTopicCap} new topics/day, only{" "}
            {proposal.kept.length} of the {pool} topics not yet ready fit
            before {proposal.examDate}.
          </>
        ) : (
          <>
            <strong>This goal doesn&apos;t fit at your cap.</strong> At your
            cap of {proposal.dailyNewTopicCap}/day, only {proposal.kept.length}{" "}
            of the {pool} topics fit before {proposal.examDate}.
          </>
        )}{" "}
        Confirming commits the kept schedule; the deferred topics stay at
        risk, weakest first.
      </Alert>

      <TriagedSection
        heading={`Kept — scheduled weakest first (${proposal.kept.length})`}
        topics={proposal.kept}
        tone="kept"
      />
      <TriagedSection
        heading={`Deferred — won't be reached at the current cap (${proposal.deferred.length})`}
        topics={proposal.deferred}
        tone="deferred"
      />
      <DaySchedule entries={proposal.proposedEntries} today={proposal.todayLocal} />
    </>
  );
}

/** Proposed entries grouped by planned day — what lands on which date. The
 *  proposal arrives date-ascending, so first-seen key order is already
 *  chronological. */
function DaySchedule({
  entries,
  today,
}: {
  entries: ProposedEntryItem[];
  today: string;
}) {
  if (entries.length === 0) return null;
  const days = new Map<string, ProposedEntryItem[]>();
  for (const entry of entries) {
    const list = days.get(entry.plannedDate) ?? [];
    list.push(entry);
    days.set(entry.plannedDate, list);
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Day by day
      </h3>
      <ul className="flex flex-col gap-2">
        {[...days.entries()].map(([date, dayEntries]) => (
          <li
            key={date}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {date}
              {date === today && (
                <span className="text-indigo-600 dark:text-indigo-400">
                  {" "}
                  · today
                </span>
              )}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {dayEntries.map((entry) => (
                <li
                  key={entry.topicId}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate text-sm text-slate-900 dark:text-slate-50">
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {entry.moduleTitle}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kept/deferred list with a readiness bar per topic — the cut is shown with
 *  its evidence on BOTH sides, never hidden (§5.7). */
function TriagedSection({
  heading,
  topics,
  tone,
}: {
  heading: string;
  topics: TriagedTopicItem[];
  tone: "kept" | "deferred";
}) {
  if (topics.length === 0) return null;
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 ${
        tone === "deferred"
          ? TONE.danger
          : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      }`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide">
        {heading}
      </h3>
      <ul className="flex flex-col gap-2">
        {topics.map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3">
            <span
              className="w-40 shrink-0 truncate text-xs text-slate-900 dark:text-slate-50"
              title={`${topic.title} (${topic.moduleTitle})`}
            >
              {topic.title}
            </span>
            <ReadinessBar value={topic.readiness} />
            <span className="w-10 shrink-0 text-right text-xs opacity-80">
              {percent(topic.readiness)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
