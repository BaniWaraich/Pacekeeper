"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  questionInputSchema,
  type AiQuestionsResponse,
} from "@/lib/validations";
import { Card } from "@/app/ui";
import { ApiError, fetchJson } from "../../../fetch-json";
import {
  QuestionFields,
  actionClass,
  buttonClass,
  inputClass,
  toFormState,
  toQuestionInput,
  type FormState,
} from "./question-fields";

type DraftRow = {
  key: number;
  included: boolean;
  form: FormState;
  fieldErrors?: Record<string, string[] | undefined>;
};

/**
 * AI question drafting (step 13, flow 2). Drafts exist ONLY in this
 * component's state; confirm pre-validates each included draft with the
 * same `questionInputSchema` the server runs, then posts the included set
 * through POST /api/questions/batch — the identical write path manual
 * authoring uses. Leaving the page abandons the drafts, by design.
 */
type Panel =
  | { s: "idle"; error?: string }
  | { s: "loading" }
  | { s: "unavailable" }
  | { s: "no-material" }
  | { s: "empty" }
  | { s: "reviewing"; confirming: boolean; error?: string };

export function DraftPanel({
  topicId,
  materialDirty,
}: {
  topicId: string;
  materialDirty: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>({ s: "idle" });
  const [count, setCount] = useState(5);
  const [rows, setRows] = useState<DraftRow[]>([]);

  async function generate() {
    setPanel({ s: "loading" });
    try {
      const result = await fetchJson<AiQuestionsResponse>(
        "/api/ai/questions",
        "POST",
        { topicId, count },
      );
      if (result.drafts.length === 0) {
        setPanel({ s: "empty" });
        return;
      }
      setRows(
        result.drafts.map((draft, i) => ({
          key: i,
          included: true,
          form: toFormState(draft),
        })),
      );
      setPanel({ s: "reviewing", confirming: false });
    } catch (err) {
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
    }
  }

  async function confirm() {
    const included = rows.filter((r) => r.included);

    // Client-side pre-validation with the server's own schema: field errors
    // render inline before any round-trip. The server gate still runs.
    let anyInvalid = false;
    const checked = rows.map((row) => {
      if (!row.included) return { ...row, fieldErrors: undefined };
      const parsed = questionInputSchema.safeParse(toQuestionInput(row.form));
      if (parsed.success) return { ...row, fieldErrors: undefined };
      anyInvalid = true;
      return {
        ...row,
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[] | undefined
        >,
      };
    });
    setRows(checked);
    if (anyInvalid) {
      setPanel({
        s: "reviewing",
        confirming: false,
        error: "Fix the highlighted drafts (or exclude them) to continue.",
      });
      return;
    }

    setPanel({ s: "reviewing", confirming: true });
    try {
      await fetchJson("/api/questions/batch", "POST", {
        topicId,
        questions: included.map((r) => toQuestionInput(r.form)),
      });
      setRows([]);
      setPanel({ s: "idle" });
      router.refresh();
    } catch (err) {
      setPanel({
        s: "reviewing",
        confirming: false,
        error: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  const patchRow = (key: number, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const includedCount = rows.filter((r) => r.included).length;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        Draft questions with AI
      </h2>

      {(panel.s === "idle" || panel.s === "loading") && (
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
                disabled={panel.s === "loading"}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  )
                }
              />
            </label>
            <button
              className={buttonClass}
              disabled={panel.s === "loading" || materialDirty}
              onClick={generate}
            >
              {panel.s === "loading" ? "Asking the AI…" : "Draft with AI"}
            </button>
            {materialDirty && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Save material first — drafting reads the saved version.
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

      {panel.s === "reviewing" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            These are drafts — nothing is saved until you confirm. Edit each
            one, untick any you don&apos;t want.
          </p>

          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className={`flex flex-col gap-2 rounded-lg border p-3 ${
                  row.included
                    ? "border-slate-200 dark:border-slate-700"
                    : "border-slate-200 opacity-60 dark:border-slate-800"
                }`}
              >
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={row.included}
                    disabled={panel.confirming}
                    onChange={(e) =>
                      patchRow(row.key, { included: e.target.checked })
                    }
                  />
                  Include this question
                </label>
                <QuestionFields
                  value={row.form}
                  onChange={(form) => patchRow(row.key, { form })}
                  disabled={panel.confirming || !row.included}
                  fieldErrors={row.fieldErrors}
                />
              </li>
            ))}
          </ul>

          {panel.error && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {panel.error}
            </p>
          )}

          <div className="flex items-center gap-4">
            <button
              className={buttonClass}
              disabled={panel.confirming || includedCount === 0}
              onClick={confirm}
            >
              {panel.confirming
                ? "Adding…"
                : `Add ${includedCount} ${
                    includedCount === 1 ? "question" : "questions"
                  }`}
            </button>
            <button
              className={actionClass}
              disabled={panel.confirming}
              onClick={() => {
                setRows([]);
                setPanel({ s: "idle" });
              }}
            >
              Discard drafts
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
