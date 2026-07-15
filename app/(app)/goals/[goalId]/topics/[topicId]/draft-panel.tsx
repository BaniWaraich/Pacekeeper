"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  questionInputSchema,
  type AiQuestionsResponse,
  type QuestionInput,
} from "@/lib/validations";
import { Card } from "@/app/ui";
import { ApiError, fetchJson } from "../../../fetch-json";
import { actionClass, buttonClass, inputClass } from "./question-fields";

/**
 * AI question generation (step 13, flow 2) — auto-commit, no review step.
 * The AI route stays draft-only; drafts returned to the client are filtered
 * through the same `questionInputSchema` the server runs, then immediately
 * posted through POST /api/questions/batch — the identical write path manual
 * authoring uses. The Generate click is the confirmation. Invalid drafts are
 * silently dropped; if none survive, nothing is written.
 */
type Panel =
  | { s: "idle"; error?: string }
  | { s: "generating" }
  | { s: "saving" }
  | { s: "unavailable" }
  | { s: "no-material" }
  | { s: "empty" }
  | { s: "success"; added: number };

export function DraftPanel({
  goalId,
  topicId,
  materialDirty,
}: {
  goalId: string;
  topicId: string;
  materialDirty: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>({ s: "idle" });
  const [count, setCount] = useState(5);

  // Navigating away mid-pipeline must neither set state nor fire the batch
  // POST — leaving the page abandons unsaved drafts, same as the review era.
  const aliveRef = useRef(true);
  useEffect(
    () => () => {
      aliveRef.current = false;
    },
    [],
  );

  async function generate() {
    if (panel.s === "generating" || panel.s === "saving") return;
    setPanel({ s: "generating" });

    let drafts: QuestionInput[];
    try {
      const result = await fetchJson<AiQuestionsResponse>(
        "/api/ai/questions",
        "POST",
        { topicId, count },
      );
      drafts = result.drafts;
    } catch (err) {
      if (!aliveRef.current) return;
      if (err instanceof ApiError && err.code === "AI_UNAVAILABLE") {
        setPanel({ s: "unavailable" });
      } else if (err instanceof ApiError && err.code === "NO_MATERIAL") {
        setPanel({ s: "no-material" });
      } else {
        setPanel({
          s: "idle",
          error: err instanceof Error ? err.message : "Request failed",
        });
      }
      return;
    }
    if (!aliveRef.current) return;

    // The batch route is all-or-nothing, so partial tolerance lives here:
    // keep the drafts the server schema accepts, silently drop the rest.
    const valid = drafts.flatMap((d) => {
      const parsed = questionInputSchema.safeParse(d);
      return parsed.success ? [parsed.data] : [];
    });
    if (valid.length === 0) {
      setPanel({ s: "empty" });
      return;
    }

    setPanel({ s: "saving" });
    try {
      const res = await fetchJson<{ questions: unknown[] }>(
        "/api/questions/batch",
        "POST",
        { topicId, questions: valid },
      );
      if (!aliveRef.current) return;
      setPanel({ s: "success", added: res.questions.length });
      router.refresh();
    } catch (err) {
      if (!aliveRef.current) return;
      setPanel({
        s: "idle",
        error: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  const busy = panel.s === "generating" || panel.s === "saving";

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        Generate questions with AI
      </h2>

      {(panel.s === "idle" || busy) && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              How many
              <input
                type="number"
                min={1}
                max={20}
                className={`${inputClass} w-20`}
                value={count}
                disabled={busy}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  )
                }
              />
            </label>
            <button
              className={buttonClass}
              disabled={busy || materialDirty}
              onClick={generate}
            >
              {panel.s === "generating"
                ? "Generating…"
                : panel.s === "saving"
                  ? "Adding questions…"
                  : "Generate questions"}
            </button>
            {materialDirty && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Save material first — generating reads the saved version.
              </span>
            )}
          </div>
          {panel.s === "idle" && panel.error && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {panel.error}
            </p>
          )}
        </>
      )}

      {panel.s === "unavailable" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            AI assist is unavailable right now. You can write questions by
            hand in the editor below — it&apos;s the same write path.
          </p>
          <div>
            <button
              className={actionClass}
              onClick={() => setPanel({ s: "idle" })}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {panel.s === "no-material" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This topic has no material to draft from. Add material above and
            save it, then try again.
          </p>
          <div>
            <button
              className={actionClass}
              onClick={() => setPanel({ s: "idle" })}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {panel.s === "empty" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The AI returned no usable questions. Try again, or write them by
            hand in the editor below.
          </p>
          <div>
            <button
              className={actionClass}
              onClick={() => setPanel({ s: "idle" })}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {panel.s === "success" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {panel.added} {panel.added === 1 ? "question" : "questions"} added
            to this topic.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={`/goals/${goalId}/topics/${topicId}/session`}
              className={buttonClass}
            >
              Start studying
            </Link>
            <button
              className={actionClass}
              onClick={() => setPanel({ s: "idle" })}
            >
              Generate more
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
