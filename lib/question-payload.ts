import type { QuestionInput } from "@/lib/validations";

/** QuestionInput (wire union, §6.1) → the type-discriminated `payload`
 *  column shape (§4.1): MCQ `{ options, correctIndex }`, flashcard `{ back }`.
 *  Shared by POST /api/questions/batch and PATCH /api/questions/:id — the
 *  only two writers of Question rows. */
export function toQuestionRow(q: QuestionInput) {
  return {
    type: q.type,
    prompt: q.prompt,
    payload:
      q.type === "MCQ"
        ? { options: q.options, correctIndex: q.correctIndex }
        : { back: q.back },
  };
}
