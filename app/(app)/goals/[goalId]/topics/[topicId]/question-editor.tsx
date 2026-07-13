"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuestionInput } from "@/lib/validations";
import { fetchJson } from "../../../fetch-json";

export type QuestionRow = {
  id: string;
  type: "MCQ" | "FLASHCARD";
  prompt: string;
  payload:
    | { options: string[]; correctIndex: number }
    | { back: string };
};

const inputClass =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const buttonClass =
  "rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";
const actionClass =
  "text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-500 dark:hover:text-zinc-100";

type FormState = {
  type: "MCQ" | "FLASHCARD";
  prompt: string;
  options: string[];
  correctIndex: number;
  back: string;
};

const emptyForm: FormState = {
  type: "MCQ",
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  back: "",
};

function toQuestionInput(form: FormState): QuestionInput {
  return form.type === "MCQ"
    ? {
        type: "MCQ",
        prompt: form.prompt,
        options: form.options,
        correctIndex: form.correctIndex,
      }
    : { type: "FLASHCARD", prompt: form.prompt, back: form.back };
}

/**
 * Manual authoring for both question types. Creation posts through
 * POST /api/questions/batch — the same confirmation-gate endpoint the AI
 * draft flow (step 13) will use. Edit is a full-replace PATCH; archive is
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
      q.type === "MCQ" && "options" in q.payload
        ? {
            type: "MCQ",
            prompt: q.prompt,
            options: [...q.payload.options],
            correctIndex: q.payload.correctIndex,
            back: "",
          }
        : {
            type: "FLASHCARD",
            prompt: q.prompt,
            options: ["", "", "", ""],
            correctIndex: 0,
            back: "back" in q.payload ? q.payload.back : "",
          },
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

        <div className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          {(["MCQ", "FLASHCARD"] as const).map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input
                type="radio"
                checked={form.type === t}
                onChange={() => setForm((f) => ({ ...f, type: t }))}
              />
              {t === "MCQ" ? "MCQ" : "Flashcard"}
            </label>
          ))}
        </div>

        <textarea
          className={inputClass}
          placeholder="Prompt"
          value={form.prompt}
          onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
          required
        />

        {form.type === "MCQ" ? (
          <div className="flex flex-col gap-2">
            {form.options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  title="Correct answer"
                  checked={form.correctIndex === i}
                  onChange={() => setForm((f) => ({ ...f, correctIndex: i }))}
                />
                <input
                  className={`${inputClass} flex-1`}
                  placeholder={`Option ${i + 1}`}
                  value={option}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      options: f.options.map((o, j) =>
                        j === i ? e.target.value : o,
                      ),
                    }))
                  }
                  required
                />
                <button
                  type="button"
                  className={actionClass}
                  disabled={form.options.length <= 2}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      options: f.options.filter((_, j) => j !== i),
                      correctIndex:
                        f.correctIndex === i
                          ? 0
                          : f.correctIndex > i
                            ? f.correctIndex - 1
                            : f.correctIndex,
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className={actionClass}
              disabled={form.options.length >= 6}
              onClick={() =>
                setForm((f) => ({ ...f, options: [...f.options, ""] }))
              }
            >
              Add option
            </button>
          </div>
        ) : (
          <textarea
            className={inputClass}
            placeholder="Back (the answer)"
            value={form.back}
            onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))}
            required
          />
        )}

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
