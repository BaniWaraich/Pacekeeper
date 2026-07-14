"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../../../fetch-json";
import {
  QuestionFields,
  actionClass,
  buttonClass,
  emptyForm,
  toFormState,
  toQuestionInput,
  type FormState,
} from "./question-fields";

export type QuestionRow = {
  id: string;
  type: "MCQ" | "FLASHCARD";
  prompt: string;
  payload:
    | { options: string[]; correctIndex: number }
    | { back: string };
};

/**
 * Manual authoring for both question types. Creation posts through
 * POST /api/questions/batch — the same confirmation-gate endpoint the AI
 * draft flow (step 13) uses. Edit is a full-replace PATCH; archive is
 * DELETE. All content rendered as text only (invariant 9).
 */
export function QuestionEditor({
  topicId,
  questions,
}: {
  topicId: string;
  questions: QuestionRow[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(q: QuestionRow) {
    setEditingId(q.id);
    setForm(
      toFormState(
        q.type === "MCQ" && "options" in q.payload
          ? {
              type: "MCQ",
              prompt: q.prompt,
              options: q.payload.options,
              correctIndex: q.payload.correctIndex,
            }
          : {
              type: "FLASHCARD",
              prompt: q.prompt,
              back: "back" in q.payload ? q.payload.back : "",
            },
      ),
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      if (editingId) {
        await fetchJson(
          `/api/questions/${editingId}`,
          "PATCH",
          toQuestionInput(form),
        );
      } else {
        await fetchJson("/api/questions/batch", "POST", {
          topicId,
          questions: [toQuestionInput(form)],
        });
      }
      setForm(emptyForm);
      setEditingId(null);
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <ul className="flex flex-col gap-2">
        {questions.map((q) => (
          <li
            key={q.id}
            className="flex flex-col gap-1 rounded border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase text-zinc-500">{q.type}</span>
              <span className="text-sm text-zinc-900 dark:text-zinc-50">
                {q.prompt}
              </span>
              <span className="ml-auto flex gap-2">
                <button className={actionClass} onClick={() => startEdit(q)}>
                  Edit
                </button>
                <button
                  className={actionClass}
                  onClick={() =>
                    run(() => fetchJson(`/api/questions/${q.id}`, "DELETE"))
                  }
                >
                  Archive
                </button>
              </span>
            </div>
            {"options" in q.payload ? (
              <ol className="ml-5 list-decimal text-xs text-zinc-600 dark:text-zinc-400">
                {q.payload.options.map((option, i) => (
                  <li key={i}>
                    {option}
                    {"correctIndex" in q.payload &&
                      i === q.payload.correctIndex &&
                      " ✓"}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ml-5 text-xs text-zinc-600 dark:text-zinc-400">
                {q.payload.back}
              </p>
            )}
          </li>
        ))}
        {questions.length === 0 && (
          <li className="text-sm text-zinc-600 dark:text-zinc-400">
            No questions yet.
          </li>
        )}
      </ul>

      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded border border-zinc-300 p-4 dark:border-zinc-700"
      >
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {editingId ? "Edit question" : "New question"}
        </h2>

        <QuestionFields value={form} onChange={setForm} />

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={buttonClass}>
            {editingId ? "Save changes" : "Add question"}
          </button>
          {editingId && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
