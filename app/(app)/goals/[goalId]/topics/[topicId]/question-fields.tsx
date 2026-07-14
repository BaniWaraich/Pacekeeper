"use client";

import type { QuestionInput } from "@/lib/validations";

/**
 * Shared question form fields — one source of truth for the type-specific
 * field UI (MCQ option add/remove with correctIndex adjustment, flashcard
 * back). Used by the manual QuestionEditor and by each AI draft row
 * (step 13): both edit the same FormState and serialize through the same
 * toQuestionInput, so a draft is edited with exactly the manual editor's
 * affordances.
 */

export const inputClass =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
export const buttonClass =
  "rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";
export const actionClass =
  "text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-500 dark:hover:text-zinc-100";

export type FormState = {
  type: "MCQ" | "FLASHCARD";
  prompt: string;
  options: string[];
  correctIndex: number;
  back: string;
};

export const emptyForm: FormState = {
  type: "MCQ",
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  back: "",
};

export function toQuestionInput(form: FormState): QuestionInput {
  return form.type === "MCQ"
    ? {
        type: "MCQ",
        prompt: form.prompt,
        options: form.options,
        correctIndex: form.correctIndex,
      }
    : { type: "FLASHCARD", prompt: form.prompt, back: form.back };
}

/** Pre-fill the form from a QuestionInput (AI draft or existing row). The
 *  inactive variant's fields get the emptyForm defaults so switching type
 *  mid-edit behaves like the manual editor. */
export function toFormState(q: QuestionInput): FormState {
  return q.type === "MCQ"
    ? {
        type: "MCQ",
        prompt: q.prompt,
        options: [...q.options],
        correctIndex: q.correctIndex,
        back: "",
      }
    : {
        type: "FLASHCARD",
        prompt: q.prompt,
        options: ["", "", "", ""],
        correctIndex: 0,
        back: q.back,
      };
}

function FieldErrors({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="text-xs text-red-600 dark:text-red-400">
      {messages.join("; ")}
    </p>
  );
}

/**
 * Controlled field group. `fieldErrors` (optional) maps Zod-flattened field
 * names (prompt/options/correctIndex/back) to messages rendered inline —
 * the draft rows use it for client-side pre-validation feedback.
 */
export function QuestionFields({
  value,
  onChange,
  disabled = false,
  fieldErrors,
}: {
  value: FormState;
  onChange: (next: FormState) => void;
  disabled?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
}) {
  const set = (patch: Partial<FormState>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        {(["MCQ", "FLASHCARD"] as const).map((t) => (
          <label key={t} className="flex items-center gap-1">
            <input
              type="radio"
              checked={value.type === t}
              disabled={disabled}
              onChange={() => set({ type: t })}
            />
            {t === "MCQ" ? "MCQ" : "Flashcard"}
          </label>
        ))}
      </div>

      <textarea
        className={inputClass}
        placeholder="Prompt"
        value={value.prompt}
        disabled={disabled}
        onChange={(e) => set({ prompt: e.target.value })}
        required
      />
      <FieldErrors messages={fieldErrors?.prompt} />

      {value.type === "MCQ" ? (
        <div className="flex flex-col gap-2">
          {value.options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                title="Correct answer"
                checked={value.correctIndex === i}
                disabled={disabled}
                onChange={() => set({ correctIndex: i })}
              />
              <input
                className={`${inputClass} flex-1`}
                placeholder={`Option ${i + 1}`}
                value={option}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    options: value.options.map((o, j) =>
                      j === i ? e.target.value : o,
                    ),
                  })
                }
                required
              />
              <button
                type="button"
                className={actionClass}
                disabled={disabled || value.options.length <= 2}
                onClick={() =>
                  set({
                    options: value.options.filter((_, j) => j !== i),
                    correctIndex:
                      value.correctIndex === i
                        ? 0
                        : value.correctIndex > i
                          ? value.correctIndex - 1
                          : value.correctIndex,
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className={actionClass}
            disabled={disabled || value.options.length >= 6}
            onClick={() => set({ options: [...value.options, ""] })}
          >
            Add option
          </button>
          <FieldErrors messages={fieldErrors?.options} />
          <FieldErrors messages={fieldErrors?.correctIndex} />
        </div>
      ) : (
        <>
          <textarea
            className={inputClass}
            placeholder="Back (the answer)"
            value={value.back}
            disabled={disabled}
            onChange={(e) => set({ back: e.target.value })}
            required
          />
          <FieldErrors messages={fieldErrors?.back} />
        </>
      )}
    </div>
  );
}
