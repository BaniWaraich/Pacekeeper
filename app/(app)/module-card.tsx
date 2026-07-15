import Link from "next/link";
import { ReadinessRing } from "@/app/readiness-ring";
import { focusRing, linkClass, TONE } from "@/app/ui";

/** Module container for readiness lists (dashboard, today). Dumb on purpose:
 *  the caller derives each topic's state (via deriveTopicState) and builds
 *  the quiz href, so screens with different wire shapes can share it. */

export type TopicState = "at-risk" | "upcoming" | "building" | "strong";

/** At-risk (TRIAGE deferred membership) takes precedence over all others. */
export function deriveTopicState(
  topic: { introduced: boolean; notYetReady: boolean },
  deferred: boolean,
): TopicState {
  if (deferred) return "at-risk";
  if (!topic.introduced) return "upcoming";
  return topic.notYetReady ? "building" : "strong";
}

export type ModuleCardTopic = {
  topicId: string;
  title: string;
  /** Engine 0–1 readiness, verbatim. */
  readiness: number;
  state: TopicState;
  quizHref: string;
};

const CHIP: Record<TopicState, { label: string; classes: string }> = {
  "at-risk": { label: "At risk", classes: TONE.danger },
  // Dimmed, but text stays slate-600/400 — 10px uppercase needs AA margin.
  upcoming: {
    label: "Upcoming",
    classes:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
  },
  building: { label: "Building", classes: TONE.warn },
  // The win state: emerald + check + a one-time pop. Nothing louder —
  // pulse-glow stays reserved for the session's threshold-crossing moment.
  strong: {
    label: "Strong",
    classes: `${TONE.positive} motion-safe:animate-pop`,
  },
};

const CHIP_ICON: Record<TopicState, React.ReactNode> = {
  "at-risk": (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V9m0 2.5v.5" />
    </>
  ),
  upcoming: (
    <>
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
      <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
    </>
  ),
  building: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" />
    </>
  ),
  strong: <path d="M3 8.5l3.5 3.5L13 5" />,
};

function StateChip({ state }: { state: TopicState }) {
  const { label, classes } = CHIP[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${classes}`}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {CHIP_ICON[state]}
      </svg>
      {label}
    </span>
  );
}

export function ModuleCard({
  title,
  topics,
}: {
  title: string;
  topics: ModuleCardTopic[];
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <ul className="flex flex-col">
        {topics.map((t) => (
          <li
            key={t.topicId}
            className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1"
          >
            <ReadinessRing
              value={t.readiness}
              size="inline"
              animate={false}
              label={`${t.title} readiness`}
            />
            {/* basis floor: on narrow screens the chip + link wrap to a
                second line instead of crushing the title. */}
            <span
              className="min-w-0 flex-[1_1_10rem] truncate text-sm text-slate-900 dark:text-slate-50"
              title={t.title}
            >
              {t.title}
            </span>
            <StateChip state={t.state} />
            <Link
              href={t.quizHref}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-sm text-xs ${linkClass} ${focusRing}`}
            >
              Quiz this now
              <span className="sr-only"> — {t.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
