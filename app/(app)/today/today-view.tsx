"use client";

import Link from "next/link";
import type { TodayResponse } from "@/lib/engine-io";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  RegimeBadge,
  Skeleton,
  TONE,
  displayText,
  focusRing,
  linkClass,
  mutedText,
} from "@/app/ui";
import { ReadinessRing } from "@/app/readiness-ring";
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
        <Link href="/goals" className={`${linkClass} rounded-sm ${focusRing}`}>
          Create your first goal →
        </Link>
      </EmptyState>
    );
  }

  const totalReviews = reads.reduce((n, r) => n + r.data.reviews.length, 0);
  const totalNew = reads.reduce((n, r) => n + r.data.newTopics.length, 0);

  if (totalReviews + totalNew === 0) {
    return (
      <EmptyState
        className="py-14"
        title={
          <span className="flex flex-col items-center gap-3">
            <span
              aria-hidden
              className={`inline-flex rounded-full border p-3 motion-safe:animate-pop ${TONE.positive}`}
            >
              <svg
                viewBox="0 0 16 16"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8.5l3.5 3.5L13 5" />
              </svg>
            </span>
            <span
              className={`${displayText} text-xl text-slate-900 dark:text-slate-50`}
            >
              You&apos;re clear for today.
            </span>
          </span>
        }
      >
        <p>
          No reviews due and no new topics scheduled — today&apos;s work is
          done.
        </p>
        <Link
          href="/dashboard"
          className={`${linkClass} rounded-sm ${focusRing}`}
        >
          See where you stand →
        </Link>
      </EmptyState>
    );
  }

  const breakdown =
    totalReviews > 0 && totalNew > 0
      ? `${totalReviews} ${totalReviews === 1 ? "review" : "reviews"} due · ${totalNew} new ${totalNew === 1 ? "topic" : "topics"} planned`
      : totalReviews > 0
        ? `${totalReviews} ${totalReviews === 1 ? "review" : "reviews"} due — no new topics scheduled today.`
        : `${totalNew} new ${totalNew === 1 ? "topic" : "topics"} planned — nothing due for review.`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p
          className={`${displayText} text-4xl text-slate-900 dark:text-slate-50`}
        >
          {totalReviews + totalNew} to clear today
        </p>
        <p className={`text-sm ${mutedText}`}>{breakdown}</p>
      </div>
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

  // Springy hover = motion-safe lift + shadow-sm (glow stays reserved for the
  // gradient CTA). Basis-floor on the main text cell wraps the meta to a
  // second line at narrow widths instead of crushing the title.
  const rowClass = `flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm motion-safe:hover:-translate-y-0.5 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50 ${focusRing}`;

  return (
    <Card className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2
          className={`${displayText} min-w-0 flex-[1_1_12rem] truncate text-lg text-slate-900 dark:text-slate-50`}
          title={title}
        >
          {title}
        </h2>
        {data.planned ? (
          <RegimeBadge regime={data.regime} />
        ) : (
          <Link
            href={`/goals/${goalId}/plan`}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-sm text-xs ${linkClass} ${focusRing}`}
          >
            No plan yet — create a plan →
          </Link>
        )}
        <span className={`shrink-0 text-xs tabular-nums ${mutedText}`}>
          {data.reviews.length} due · {data.newTopics.length} new
        </span>
      </header>
      <ul className="flex flex-col gap-2">
        {data.newTopics.map((topic) => (
          <li key={topic.topicId}>
            <Link href={sessionHref(topic.topicId)} className={rowClass}>
              <Badge tone="accent">New</Badge>
              <span
                className="min-w-0 flex-[1_1_10rem] truncate text-sm font-medium text-slate-900 dark:text-slate-50"
                title={topic.title}
              >
                {topic.title}
              </span>
              <span className={`shrink-0 text-xs ${mutedText}`}>
                {topic.moduleTitle} · planned {topic.plannedDate}
              </span>
            </Link>
          </li>
        ))}
        {data.reviews.map((review) => (
          <li key={review.questionId}>
            <Link href={sessionHref(review.topicId)} className={rowClass}>
              <ReadinessRing
                value={review.strength}
                size="inline"
                animate={false}
                label={`${review.topicTitle} — strength`}
              />
              <Badge tone="outline">
                {review.type === "MCQ" ? "MCQ" : "Card"}
              </Badge>
              <span
                className="min-w-0 flex-[1_1_10rem] truncate text-sm text-slate-900 dark:text-slate-50"
                title={review.prompt}
              >
                {review.prompt}
              </span>
              <span className={`shrink-0 text-xs ${mutedText}`}>
                {review.topicTitle}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
