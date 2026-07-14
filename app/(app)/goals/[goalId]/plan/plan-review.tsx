"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProposedEntryItem,
  RecalibrateResponse,
  TriagedTopicItem,
} from "@/lib/engine-io";
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
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-900 dark:text-red-100">
          Couldn&apos;t compute the proposal: {state.message}
        </p>
        <button
          type="button"
          onClick={reload}
          className="rounded border border-red-300 px-3 py-1 text-sm text-red-900 hover:bg-red-100 dark:border-red-800 dark:text-red-100 dark:hover:bg-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  const proposal = state.proposal;

  if (proposal.mode === "ON_PACE") {
    return (
      <div className="rounded border border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-900 dark:text-zinc-50">
          You&apos;re on pace — nothing to recalibrate.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          See where you stand →
        </Link>
      </div>
    );
  }

  if (proposal.mode === "INITIAL" && proposal.proposedEntries.length === 0) {
    return (
      <div className="rounded border border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-900 dark:text-zinc-50">
          No topics to schedule yet.
        </p>
        <Link
          href={`/goals/${goalId}`}
          className="mt-2 inline-block text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Add modules and topics first →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {stale && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Your plan changed since this proposal was computed — review the
          fresh proposal below.
        </div>
      )}

      <ProposalBody proposal={proposal} />

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={confirming || proposal.proposedEntries.length === 0}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {confirming ? "Confirming…" : confirmLabel(proposal.mode)}
        </button>
        {proposal.proposedEntries.length === 0 && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Nothing can be scheduled — no usable days remain before the exam.
          </p>
        )}
        {confirmError && (
          <p className="text-sm text-red-900 dark:text-red-100">
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
        <div className="rounded border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50">
          <strong>Your study plan.</strong> {proposal.proposedEntries.length}{" "}
          {proposal.proposedEntries.length === 1 ? "topic" : "topics"} across{" "}
          {proposal.daysUsable} usable{" "}
          {proposal.daysUsable === 1 ? "day" : "days"} before {proposal.examDate}
          . Confirming makes this the baseline your pace is measured against.
        </div>
        <DaySchedule entries={proposal.proposedEntries} today={proposal.todayLocal} />
      </>
    );
  }

  if (proposal.mode === "SLIPPING") {
    const m = proposal.metrics;
    return (
      <>
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <strong>Catch-up pace.</strong> Covering the remaining{" "}
          {m.remainingTopics} topics now takes {rate(m.requiredRate)}/day, up
          from the planned {rate(m.baselineRate)}/day. The redistribution below
          spreads them across your {proposal.daysUsable} usable{" "}
          {proposal.daysUsable === 1 ? "day" : "days"}.
        </div>
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
      <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
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
      </div>

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
      <h3 className="text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">
        Day by day
      </h3>
      <ul className="flex flex-col gap-2">
        {[...days.entries()].map(([date, dayEntries]) => (
          <li
            key={date}
            className="rounded border border-zinc-300 px-4 py-3 dark:border-zinc-700"
          >
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {date}
              {date === today && " · today"}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {dayEntries.map((entry) => (
                <li
                  key={entry.topicId}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate text-sm text-zinc-900 dark:text-zinc-50">
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
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
      className={`flex flex-col gap-2 rounded border px-4 py-3 ${
        tone === "deferred"
          ? "border-red-300 dark:border-red-900"
          : "border-zinc-300 dark:border-zinc-700"
      }`}
    >
      <h3
        className={`text-xs font-semibold uppercase ${
          tone === "deferred"
            ? "text-red-900 dark:text-red-100"
            : "text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {heading}
      </h3>
      <ul className="flex flex-col gap-2">
        {topics.map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3">
            <span
              className="w-40 shrink-0 truncate text-xs text-zinc-900 dark:text-zinc-50"
              title={`${topic.title} (${topic.moduleTitle})`}
            >
              {topic.title}
            </span>
            <ReadinessBar value={topic.readiness} />
            <span className="w-10 shrink-0 text-right text-xs text-zinc-600 dark:text-zinc-400">
              {percent(topic.readiness)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
