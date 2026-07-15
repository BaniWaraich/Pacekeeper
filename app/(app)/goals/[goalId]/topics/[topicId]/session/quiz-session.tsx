"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
  btnPrimary,
  btnSecondary,
  cardClass as uiCardClass,
  displayText,
  focusRing,
  linkClass,
  mutedText,
  Alert,
  EmptyState,
  TONE,
} from "@/app/ui";
import { ReadinessRing } from "@/app/readiness-ring";
import { fetchJson } from "../../../../fetch-json";
import {
  DEFAULT_QUESTION_COUNT,
  generateAndCommitQuestions,
} from "../generate-questions";

export type SessionQuestion =
  | { id: string; type: "MCQ"; prompt: string; options: string[] }
  | { id: string; type: "FLASHCARD"; prompt: string; back: string };

type AttemptResult = { outcome: "CORRECT" | "INCORRECT"; strength: number };
type CommitPayload =
  | { selectedOption: number }
  | { selfMark: "CORRECT" | "INCORRECT" };

const cardClass = `${uiCardClass} flex flex-col gap-4 p-5`;

/** Encouragement scaled to the honest score; 0.6 = READINESS_THRESHOLD, the
 *  same point where the ring flips emerald/amber, so tone matches color. */
function tierLine(score: number): string {
  if (score === 1) return "Every answer landed. Keep this rhythm.";
  if (score >= 0.6)
    return "Solid session. The ones you missed are scheduled to come back around.";
  return "A tough set. Every miss is queued for review — that's how it becomes strength.";
}

function VerdictIcon({ correct }: { correct: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {correct ? (
        <path d="M3 8.5l3.5 3.5L13 5" />
      ) : (
        <path d="M4 4l8 8M12 4l-8 8" />
      )}
    </svg>
  );
}

/**
 * Quiz session (§6.2). One attempt UUID is minted at answer-commit time and
 * held in state; a failed POST surfaces Retry, which replays the SAME id and
 * body — the id is never regenerated, so a network retry can only ever produce
 * one ledger row (idempotency, §3.2). MCQ grading is server-side; the client
 * shows only the returned outcome. All content rendered as text (invariant #9).
 */
export function QuizSession({
  goalId,
  topicId,
  questions,
  hasMaterial,
}: {
  goalId: string;
  topicId: string;
  questions: SessionQuestion[];
  hasMaterial: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [pending, setPending] = useState<CommitPayload | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);

  // Empty-session auto-generation. The user asked to be quizzed; if the topic
  // has material but no questions yet, we run the same AI generate → auto-commit
  // pipeline DraftPanel uses and flow straight into the quiz — no dead end.
  const [prep, setPrep] = useState<
    { s: "idle" } | { s: "preparing" } | { s: "error"; message: string }
  >({ s: "idle" });
  // Re-armed on setup so StrictMode's setup→cleanup→setup leaves it true;
  // going false on unmount stops a mid-flight batch write and any setState.
  const aliveRef = useRef(true);
  const startedRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  async function runGenerate() {
    setPrep({ s: "preparing" });
    const outcome = await generateAndCommitQuestions({
      topicId,
      count: DEFAULT_QUESTION_COUNT,
      isAlive: () => aliveRef.current,
    });
    if (!aliveRef.current || outcome.status === "aborted") return;
    if (outcome.status === "success") {
      // Re-fetch server-side: the new questions come back through the same
      // projection that strips the MCQ answer key (invariant #8), and the
      // render short-circuits into the quiz before this zero-branch. Keep the
      // "Preparing" UI up until those props arrive — zero extra clicks.
      router.refresh();
      return;
    }
    setPrep({
      s: "error",
      message:
        outcome.status === "unavailable"
          ? "AI assist is unavailable right now."
          : outcome.status === "empty"
            ? "The AI couldn't draft usable questions from this material."
            : outcome.status === "no-material"
              ? "This topic needs study material before it can be quizzed."
              : outcome.message,
    });
  }

  // Fire once per page load, only when there are no questions to quiz and there
  // is material to draft from (no doomed AI call otherwise).
  useEffect(() => {
    if (questions.length > 0 || !hasMaterial || startedRef.current) return;
    startedRef.current = true;
    runGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topicHref = `/goals/${goalId}/topics/${topicId}`;

  if (questions.length === 0) {
    // No material: don't fire a doomed AI call — route the user to add it.
    if (!hasMaterial) {
      return (
        <EmptyState title="This topic needs study material first.">
          <Link
            href={topicHref}
            className={`${linkClass} rounded-sm ${focusRing}`}
          >
            Add study material →
          </Link>
        </EmptyState>
      );
    }

    // Generation failed (AI down / rate limit / no usable drafts): never a
    // dead end — retry, or fall back to writing questions by hand.
    if (prep.s === "error") {
      return (
        <Alert tone="danger" className="flex flex-col items-start gap-3">
          <p>{prep.message}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnPrimary} onClick={runGenerate}>
              Try again
            </button>
            <Link href={topicHref} className={btnSecondary}>
              Add questions manually
            </Link>
          </div>
        </Alert>
      );
    }

    // Preparing (idle before the effect fires, or generating): the copy is
    // about the quiz, not the AI plumbing behind it.
    return (
      <section
        className={`${cardClass} items-center gap-4 p-8 text-center`}
        role="status"
        aria-live="polite"
      >
        <h2 className={`${displayText} text-xl text-slate-900 dark:text-slate-50`}>
          Preparing your quiz…
        </h2>
        <p className={`text-sm ${mutedText}`}>
          Writing questions from your material — this takes a few seconds.
        </p>
        <div
          aria-hidden
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <div className="h-full w-full rounded-full bg-gradient-to-r from-momentum-from to-momentum-to motion-safe:animate-pulse dark:from-indigo-500 dark:to-violet-500" />
        </div>
      </section>
    );
  }

  const question = questions[index];

  if (!question) {
    const score = answered ? correct / answered : 0;
    return (
      <section className={`${cardClass} items-center gap-5 p-8 text-center`}>
        <ReadinessRing value={score} size="hero" animate label="Session score" />
        <div className="flex flex-col gap-1">
          <h2
            className={`${displayText} text-2xl text-slate-900 motion-safe:animate-pop dark:text-slate-50`}
          >
            Session complete
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {answered} answered · {correct} correct
          </p>
          <p className={`text-sm ${mutedText}`}>{tierLine(score)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/today" className={btnPrimary}>
            Back to today
          </Link>
          <Link href={topicHref} className={btnSecondary}>
            Review this topic
          </Link>
        </div>
      </section>
    );
  }

  async function commit(payload: CommitPayload) {
    const id = attemptId ?? uuidv4();
    setAttemptId(id);
    setPending(payload);
    setBusy(true);
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetchJson<AttemptResult>(
        `/api/attempts?tz=${encodeURIComponent(tz)}`,
        "POST",
        {
          id,
          questionId: question.id,
          attemptedAt: new Date().toISOString(),
          ...payload,
        },
      );
      setResult(res);
      setAnswered((n) => n + 1);
      if (res.outcome === "CORRECT") setCorrect((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
    setAttemptId(null);
    setPending(null);
    setResult(null);
    setError(null);
  }

  const graded = result !== null;

  // Fills at the moment of grading; after next() the fraction is unchanged
  // (graded resets as index increments), so the bar never twitches on Next.
  const pct = `${Math.round(((index + (graded ? 1 : 0)) / questions.length) * 100)}%`;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Question {index + 1} of {questions.length}
          </p>
          <p className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
            {correct} correct
          </p>
        </div>
        <div
          aria-hidden
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-momentum-from to-momentum-to ease-momentum motion-safe:transition-[width] motion-safe:duration-[800ms] dark:from-indigo-500 dark:to-violet-500"
            style={{ width: pct }}
          />
        </div>
      </div>

      <div className={cardClass}>
        {question.type === "MCQ" ? (
          <fieldset className="min-w-0">
            <legend className="mb-4 text-sm text-slate-900 dark:text-slate-50">
              {question.prompt}
            </legend>
            <ul className="flex flex-col gap-2">
              {question.options.map((option, i) => {
                const isSelected = selected === i;
                const gradedClass =
                  graded && isSelected
                    ? result.outcome === "CORRECT"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100"
                      : "border-red-500 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100"
                    : graded
                      ? "opacity-60"
                      : "";
                return (
                  <li key={i}>
                    <label className="flex cursor-pointer">
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        checked={selected === i}
                        disabled={graded || busy}
                        onChange={() => setSelected(i)}
                        className="peer sr-only"
                      />
                      <span
                        className={`flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 motion-safe:active:scale-[0.98] peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-900 motion-safe:peer-checked:animate-pop peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white peer-disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:peer-checked:border-indigo-400 dark:peer-checked:bg-indigo-950 dark:peer-checked:text-indigo-100 dark:peer-focus-visible:ring-offset-slate-950 ${gradedClass}`}
                      >
                        {option}
                        {graded && isSelected && (
                          <span className="ml-auto">
                            <VerdictIcon
                              correct={result.outcome === "CORRECT"}
                            />
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-900 dark:text-slate-50">
              {question.prompt}
            </p>
            {revealed ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 motion-safe:animate-rise-in dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-50">
                {question.back}
              </p>
            ) : (
              <button
                type="button"
                className={`${btnSecondary} w-fit`}
                onClick={() => setRevealed(true)}
              >
                Reveal answer
              </button>
            )}
          </div>
        )}

        {/* Always-mounted live region: a region must exist before its content
            changes for screen readers to announce the verdict reliably. */}
        <p role="status" aria-live="polite" className="sr-only">
          {graded
            ? question.type === "MCQ"
              ? `${result.outcome === "CORRECT" ? "Correct" : "Incorrect"} · strength ${Math.round(result.strength * 100)}%`
              : "Answer recorded."
            : (error ?? "")}
        </p>

        {/* MCQ outcome is the server's verdict and worth echoing; a flashcard
            outcome is the user's own self-mark, so echoing "Correct/Incorrect"
            (or a strength delta) back at them is noise — acknowledge and move on. */}
        {graded &&
          (question.type === "MCQ" ? (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                result.outcome === "CORRECT"
                  ? `${TONE.positive} motion-safe:animate-pulse-glow`
                  : TONE.danger
              }`}
            >
              <VerdictIcon correct={result.outcome === "CORRECT"} />
              <p>
                <span className="font-medium">
                  {result.outcome === "CORRECT"
                    ? "Correct — nice work"
                    : "Not quite — you'll see this again soon"}
                </span>
                <span className="opacity-70">
                  {" "}
                  · strength {Math.round(result.strength * 100)}%
                </span>
              </p>
            </div>
          ) : (
            <div className={`rounded-lg border px-3 py-2 text-sm ${TONE.neutral}`}>
              Answer recorded.
            </div>
          ))}

        {error && (
          <p className={`rounded-lg border px-3 py-2 text-sm ${TONE.danger}`}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          {graded ? (
            <button type="button" className={btnPrimary} onClick={next}>
              {index + 1 < questions.length ? "Next question" : "Finish"}
            </button>
          ) : error ? (
            // Retry replays the same id + payload — never regenerates the id.
            <button
              type="button"
              className={btnPrimary}
              disabled={busy}
              onClick={() => pending && commit(pending)}
            >
              Retry
            </button>
          ) : question.type === "MCQ" ? (
            <button
              type="button"
              className={btnPrimary}
              disabled={selected === null || busy}
              onClick={() =>
                selected !== null && commit({ selectedOption: selected })
              }
            >
              Submit
            </button>
          ) : (
            revealed && (
              <>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() => commit({ selfMark: "CORRECT" })}
                >
                  I got it right
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() => commit({ selfMark: "INCORRECT" })}
                >
                  I got it wrong
                </button>
              </>
            )
          )}
        </div>
      </div>
    </section>
  );
}
