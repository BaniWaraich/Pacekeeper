import type { Metadata } from "next";
import Link from "next/link";
import { ReadinessRing } from "@/app/readiness-ring";
import {
  btnBase,
  btnPrimary,
  btnSecondary,
  cardClass,
  displayText,
  focusRing,
  linkClass,
  mutedText,
  RegimeBadge,
  TONE,
} from "@/app/ui";

export const metadata: Metadata = {
  title: "PaceKeeper — Be ready by the date that matters",
  description:
    "Set a goal and a date. PaceKeeper builds a day-by-day study plan, quizzes you daily, and tells you the truth about whether you'll be ready in time.",
  keywords: [
    "study planner",
    "exam readiness",
    "study schedule",
    "exam countdown",
    "spaced repetition",
    "adaptive quizzes",
    "deadline study plan",
    "exam preparation",
  ],
  openGraph: {
    type: "website",
    siteName: "PaceKeeper",
    title: "PaceKeeper — Be ready by the date that matters",
    description:
      "Set a goal and a date. PaceKeeper builds a day-by-day study plan, quizzes you daily, and tells you the truth about whether you'll be ready in time.",
  },
};

const container = "mx-auto w-full max-w-6xl px-6";

/** Illustrative marketing data — clearly labeled example, never real engine
 *  output. The full four-state ModuleCard belongs to the dashboard pass;
 *  these rows are a deliberately lightweight sketch of it. */
const EXAMPLE_MODULES = [
  { title: "Networking basics", state: "mastered" as const },
  { title: "Identity & access", state: "in-progress" as const },
  { title: "Storage & databases", state: "ready" as const },
];

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

function ExampleModuleRow({
  title,
  state,
}: {
  title: string;
  state: "mastered" | "in-progress" | "ready";
}) {
  const row =
    "relative flex items-center justify-between gap-3 overflow-hidden rounded-lg border px-3 py-2 text-sm";
  if (state === "mastered") {
    return (
      <li className={`${row} ${TONE.positive}`}>
        <span className="flex items-center gap-2 font-medium">
          <CheckGlyph />
          {title}
        </span>
        <span className="text-xs font-semibold">Mastered</span>
      </li>
    );
  }
  const neutral =
    "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
  if (state === "in-progress") {
    return (
      <li className={`${row} ${neutral}`}>
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-momentum-from to-momentum-to dark:from-indigo-500 dark:to-violet-500"
        />
        <span className="pl-1 font-medium text-slate-900 dark:text-slate-50">
          {title}
        </span>
        <span className={`text-xs ${mutedText}`}>In progress · 4 of 7 topics</span>
      </li>
    );
  }
  return (
    <li className={`${row} ${neutral}`}>
      <span className="font-medium text-slate-900 dark:text-slate-50">
        {title}
      </span>
      <span className={`text-xs font-medium ${mutedText}`}>Ready</span>
    </li>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* 85% opacity, not lower: header-text AA must hold even where
          backdrop-filter is unsupported and the gradient band scrolls under. */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/85">
        <div className={`${container} flex h-16 items-center justify-between`}>
          <Link
            href="/"
            className={`${focusRing} rounded-md text-lg font-semibold tracking-tight`}
          >
            PaceKeeper
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link
              href="/login"
              className={`${focusRing} inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white`}
            >
              Log in
            </Link>
            {/* Second gradient CTA appears in the hero below — a deliberate
                exception to one-per-view: same label, same destination. */}
            <Link href="/login" className={btnPrimary}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-heading">
          <div
            className={`${container} grid animate-rise-in items-center gap-12 py-16 sm:py-24 lg:grid-cols-2`}
          >
            <div className="flex flex-col items-start gap-6">
              <p
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${TONE.neutral}`}
              >
                Deadline-aware studying
              </p>
              <h1
                id="hero-heading"
                className={`${displayText} text-4xl text-slate-900 sm:text-5xl dark:text-slate-50`}
              >
                Other tools tell you if you understand it. PaceKeeper tells you
                if you&apos;ll be ready by the date that matters.
              </h1>
              <p className={`${mutedText} max-w-prose text-base sm:text-lg`}>
                Set a goal and a date. PaceKeeper turns your material into
                modules and topics, plans every day between now and then, and
                scores your readiness after each session — so &quot;am I on
                track?&quot; always has a number.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/login" className={btnPrimary}>
                  Get started
                </Link>
                <a href="#how-it-works" className={btnSecondary}>
                  See how it works
                </a>
              </div>
            </div>

            <div className={`${cardClass} flex flex-col gap-5 p-6`}>
              <p className="sr-only">
                Illustrative example of a PaceKeeper goal.
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">AWS Solutions Architect</p>
                <RegimeBadge regime="ON_PACE" />
              </div>
              <div className="flex items-center gap-6">
                <ReadinessRing
                  size="hero"
                  value={0.87}
                  label="Example goal readiness"
                />
                <div className="flex flex-col gap-1">
                  <p className={`${displayText} text-2xl`}>12 days</p>
                  <p className={`${mutedText} text-xs`}>until exam day</p>
                </div>
              </div>
              <ul className="flex flex-col gap-2">
                {EXAMPLE_MODULES.map((m) => (
                  <ExampleModuleRow key={m.title} {...m} />
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="scroll-mt-20"
        >
          <div className={`${container} py-16`}>
            <h2
              id="how-heading"
              className={`${displayText} text-2xl text-slate-900 dark:text-slate-50`}
            >
              How it works
            </h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-3">
              {[
                {
                  title: "Upload",
                  body: "Bring your material. PaceKeeper structures it into a goal — modules, topics, and the questions that prove you know them.",
                },
                {
                  title: "Plan",
                  body: "Pick the date. You get a day-by-day plan that fits every topic into the days you actually have.",
                },
                {
                  title: "Practice",
                  body: "One short session a day. Every answer updates your readiness and checks your pace against the date.",
                },
              ].map((step, i) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm ${displayText} ${TONE.neutral}`}
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className={`${mutedText} text-sm`}>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="difference-heading">
          <div className={`${container} py-16`}>
            <h2
              id="difference-heading"
              className={`${displayText} text-2xl text-slate-900 dark:text-slate-50`}
            >
              Honest about the pace
            </h2>
            <p className={`${mutedText} mt-3 max-w-prose text-sm sm:text-base`}>
              Most tools go quiet when you fall behind. PaceKeeper recalculates
              and says so — in numbers, never in shame.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className={`${cardClass} flex flex-col gap-3 p-5`}>
                <RegimeBadge regime="ON_PACE" className="self-start" />
                <h3 className="text-lg font-semibold">When you&apos;re moving</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  On pace. 12 of 20 topics introduced · 9 usable days left.
                  Keep this rhythm and everything is covered before the exam.
                </p>
              </article>
              <article className={`${cardClass} flex flex-col gap-3 p-5`}>
                <RegimeBadge regime="SLIPPING" className="self-start" />
                <h3 className="text-lg font-semibold">When you slip</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Falling behind. Covering the remaining 8 topics now takes 2.1
                  a day, up from the planned 1.5. The plan recalibrates the
                  moment the math changes — you see exactly what moved.
                </p>
              </article>
              <article className={`${cardClass} flex flex-col gap-3 p-5`}>
                <RegimeBadge regime="TRIAGE" className="self-start" />
                <h3 className="text-lg font-semibold">When the date is close</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Full coverage is no longer realistic. At a cap of 2 new
                  topics a day, 6 of the 10 topics not yet ready fit before the
                  exam. The plan re-sorts to protect what matters most —
                  weakest first, nothing hidden.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Band carries only display-size text + the inverse button: white on
            the dark from-stop is ~4.4:1, below AA for small text. */}
        <section
          aria-labelledby="cta-heading"
          className="bg-gradient-to-r from-momentum-from to-momentum-to dark:from-indigo-500 dark:to-violet-500"
        >
          <div
            className={`${container} flex flex-col items-center gap-6 py-16 text-center`}
          >
            <h2
              id="cta-heading"
              className={`${displayText} text-3xl text-white`}
            >
              Be ready by the date that matters.
            </h2>
            {/* Inverse button: band is the brand gradient in both themes, so
                the dark: variants are intentionally identical. */}
            <Link
              href="/login"
              className={`${btnBase} bg-white text-indigo-700 shadow-sm hover:bg-indigo-50 dark:bg-white dark:text-indigo-700 dark:hover:bg-indigo-50`}
            >
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div
          className={`${container} flex flex-col gap-2 py-10 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold tracking-tight">
              PaceKeeper
            </span>
            <p className={`${mutedText} text-sm`}>
              Set a goal and a date. We&apos;ll tell you the truth about
              whether you&apos;re on track.
            </p>
          </div>
          <Link
            href="/login"
            className={`${focusRing} ${linkClass} inline-flex min-h-11 items-center rounded-md`}
          >
            Log in
          </Link>
        </div>
      </footer>
    </div>
  );
}
