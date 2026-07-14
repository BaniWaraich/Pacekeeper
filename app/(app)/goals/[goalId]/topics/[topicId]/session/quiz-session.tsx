"use client";

import { useState } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { fetchJson } from "../../../../fetch-json";

export type SessionQuestion =
  | { id: string; type: "MCQ"; prompt: string; options: string[] }
  | { id: string; type: "FLASHCARD"; prompt: string; back: string };

type AttemptResult = { outcome: "CORRECT" | "INCORRECT"; strength: number };
type CommitPayload =
  | { selectedOption: number }
  | { selfMark: "CORRECT" | "INCORRECT" };

const buttonClass =
  "rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";
const cardClass =
  "flex flex-col gap-4 rounded border border-zinc-300 p-4 dark:border-zinc-700";

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
}: {
  goalId: string;
  topicId: string;
  questions: SessionQuestion[];
}) {
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

  const topicHref = `/goals/${goalId}/topics/${topicId}`;

  if (questions.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No active questions in this topic yet.{" "}
        <Link
          href={topicHref}
          className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Add some
        </Link>
        .
      </p>
    );
  }

  const question = questions[index];

  if (!question) {
    return (
      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Session complete
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {answered} answered · {correct} correct
        </p>
        <Link href={topicHref} className={`${buttonClass} w-fit`}>
          Back to topic
        </Link>
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

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Question {index + 1} of {questions.length}
      </p>

      <div className={cardClass}>
        <p className="text-sm text-zinc-900 dark:text-zinc-50">
          {question.prompt}
        </p>

        {question.type === "MCQ" ? (
          <ul className="flex flex-col gap-2">
            {question.options.map((option, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selected === i}
                    disabled={graded || busy}
                    onChange={() => setSelected(i)}
                  />
                  {option}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            {revealed ? (
              <p className="rounded bg-zinc-100 px-3 py-2 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
                {question.back}
              </p>
            ) : (
              <button
                type="button"
                className={`${buttonClass} w-fit`}
                onClick={() => setRevealed(true)}
              >
                Reveal answer
              </button>
            )}
          </div>
        )}

        {graded && (
          <p className="text-sm">
            <span
              className={
                result.outcome === "CORRECT"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {result.outcome === "CORRECT" ? "Correct" : "Incorrect"}
            </span>
            <span className="text-zinc-500">
              {" "}
              · strength {Math.round(result.strength * 100)}%
            </span>
          </p>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-2">
          {graded ? (
            <button type="button" className={buttonClass} onClick={next}>
              {index + 1 < questions.length ? "Next question" : "Finish"}
            </button>
          ) : error ? (
            // Retry replays the same id + payload — never regenerates the id.
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => pending && commit(pending)}
            >
              Retry
            </button>
          ) : question.type === "MCQ" ? (
            <button
              type="button"
              className={buttonClass}
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
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => commit({ selfMark: "CORRECT" })}
                >
                  I got it right
                </button>
                <button
                  type="button"
                  className={buttonClass}
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
