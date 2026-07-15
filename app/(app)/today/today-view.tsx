"use client";

import Link from "next/link";
import type { TodayResponse } from "@/lib/engine-io";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  linkClass,
} from "@/app/ui";
import { useGoalReads, type GoalRead } from "../use-goal-reads";

/**
 * Due reviews + planned new topics per goal, uncapped (amended §5 ruling:
 * the Today list is never truncated). Every item links into the step 10
 * quiz session for its topic. Read-only: nothing here mutates anything.
 */
export function TodayView() {
  const { state, retry } = useGoalReads<TodayResponse>("today");

  if (state.status === "loading") {
    return <Skeleton rows={4} height="h-14" />;
  }

  if (state.status === "error") {
    return (
      <ErrorState
        message={`Couldn't load today's session: ${state.message}`}
        onRetry={retry}
      />
    );
  }

  const reads = state.reads;

  if (reads.length === 0) {
    return (
      <EmptyState title="No goals yet.">
        <Link href="/goals" className={linkClass}>
          Create your first goal →
        </Link>
      </EmptyState>
    );
  }

  const totalReviews = reads.reduce((n, r) => n + r.data.reviews.length, 0);
  const totalNew = reads.reduce((n, r) => n + r.data.newTopics.length, 0);

  if (totalReviews + totalNew === 0) {
    return (
      <EmptyState title="Nothing due today — you're clear.">
        <Link href="/dashboard" className={linkClass}>
          See where you stand →
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {totalReviews} {totalReviews === 1 ? "review" : "reviews"} · {totalNew}{" "}
        new {totalNew === 1 ? "topic" : "topics"} today
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

  const rowClass =
    "flex items-baseline justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50";

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </span>
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
          {data.reviews.length} due · {data.newTopics.length} new
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {data.newTopics.map((topic) => (
          <li key={topic.topicId}>
            <Link href={sessionHref(topic.topicId)} className={rowClass}>
              <span className="flex min-w-0 items-baseline gap-2">
                <Badge tone="accent">New</Badge>
                <span className="truncate text-sm text-slate-900 dark:text-slate-50">
                  {topic.title}
                </span>
              </span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {topic.moduleTitle} · planned {topic.plannedDate}
              </span>
            </Link>
          </li>
        ))}
        {data.reviews.map((review) => (
          <li key={review.questionId}>
            <Link href={sessionHref(review.topicId)} className={rowClass}>
              <span className="flex min-w-0 items-baseline gap-2">
                <Badge tone="outline">
                  {review.type === "MCQ" ? "MCQ" : "Card"}
                </Badge>
                <span className="truncate text-sm text-slate-900 dark:text-slate-50">
                  {review.prompt}
                </span>
              </span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {review.topicTitle} · strength{" "}
                {Math.round(review.strength * 100)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
