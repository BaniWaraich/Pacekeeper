"use client";

import Link from "next/link";
import type { TodayResponse } from "@/lib/engine-io";
import { useGoalReads, type GoalRead } from "../use-goal-reads";

/**
 * Due reviews + planned new topics per goal, uncapped (amended §5 ruling:
 * the Today list is never truncated). Every item links into the step 10
 * quiz session for its topic. Read-only: nothing here mutates anything.
 */
export function TodayView() {
  const { state, retry } = useGoalReads<TodayResponse>("today");

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-900 dark:text-red-100">
          Couldn&apos;t load today&apos;s session: {state.message}
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

  const reads = state.reads;

  if (reads.length === 0) {
    return (
      <div className="rounded border border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-900 dark:text-zinc-50">No goals yet.</p>
        <Link
          href="/goals"
          className="mt-2 inline-block text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Create your first goal →
        </Link>
      </div>
    );
  }

  const totalReviews = reads.reduce((n, r) => n + r.data.reviews.length, 0);
  const totalNew = reads.reduce((n, r) => n + r.data.newTopics.length, 0);

  if (totalReviews + totalNew === 0) {
    return (
      <div className="rounded border border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-900 dark:text-zinc-50">
          Nothing due today — you&apos;re clear.
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

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {totalReviews} {totalReviews === 1 ? "review" : "reviews"} · {totalNew}{" "}
        new {totalNew === 1 ? "topic" : "topics"}
      </p>
      {reads
        .filter((r) => r.data.reviews.length + r.data.newTopics.length > 0)
        .map((read) => (
          <GoalSection key={read.goalId} read={read} />
        ))}
    </div>
  );
}

function GoalSection({ read }: { read: GoalRead<TodayResponse> }) {
  const { goalId, title, data } = read;
  const sessionHref = (topicId: string) =>
    `/goals/${goalId}/topics/${topicId}/session`;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {title}
        <span className="ml-2 text-xs font-normal text-zinc-600 dark:text-zinc-400">
          {data.reviews.length} due · {data.newTopics.length} new
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {data.newTopics.map((topic) => (
          <li key={topic.topicId}>
            <Link
              href={sessionHref(topic.topicId)}
              className="flex items-baseline justify-between gap-3 rounded border border-zinc-300 px-4 py-3 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
                  New
                </span>
                <span className="truncate text-sm text-zinc-900 dark:text-zinc-50">
                  {topic.title}
                </span>
              </span>
              <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                {topic.moduleTitle} · planned {topic.plannedDate}
              </span>
            </Link>
          </li>
        ))}
        {data.reviews.map((review) => (
          <li key={review.questionId}>
            <Link
              href={sessionHref(review.topicId)}
              className="flex items-baseline justify-between gap-3 rounded border border-zinc-300 px-4 py-3 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  {review.type === "MCQ" ? "MCQ" : "Card"}
                </span>
                <span className="truncate text-sm text-zinc-900 dark:text-zinc-50">
                  {review.prompt}
                </span>
              </span>
              <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                {review.topicTitle} · strength {Math.round(review.strength * 100)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
