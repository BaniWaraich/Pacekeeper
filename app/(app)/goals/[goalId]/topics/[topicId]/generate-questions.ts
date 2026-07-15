import {
  questionInputSchema,
  type AiQuestionsResponse,
  type QuestionInput,
} from "@/lib/validations";
import { ApiError, fetchJson } from "../../../fetch-json";

/**
 * Shared AI question-generation pipeline (step 13, flow 2) — the network side
 * of DraftPanel.generate(), lifted out so the empty quiz session can run the
 * exact same auto-commit path without duplicating the state machine.
 *
 * The AI route stays draft-only (invariant #4): drafts are re-validated through
 * the same `questionInputSchema` the server runs, then posted through
 * POST /api/questions/batch — the identical write path manual authoring uses.
 * Invalid drafts are silently dropped; if none survive, nothing is written.
 *
 * The alive-guard is a caller-supplied `isAlive()` so the "navigating away
 * mid-pipeline never fires the batch POST" rule stays centralized here, between
 * the two network calls, while each caller owns its own component ref.
 */

export const DEFAULT_QUESTION_COUNT = 5;

export type GenerateOutcome =
  | { status: "success"; added: number }
  | { status: "unavailable" }
  | { status: "no-material" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "aborted" };

export async function generateAndCommitQuestions({
  topicId,
  count,
  isAlive,
  onSaving,
}: {
  topicId: string;
  count: number;
  isAlive: () => boolean;
  onSaving?: () => void;
}): Promise<GenerateOutcome> {
  let drafts: QuestionInput[];
  try {
    const result = await fetchJson<AiQuestionsResponse>(
      "/api/ai/questions",
      "POST",
      { topicId, count },
    );
    drafts = result.drafts;
  } catch (err) {
    if (!isAlive()) return { status: "aborted" };
    if (err instanceof ApiError && err.code === "AI_UNAVAILABLE") {
      return { status: "unavailable" };
    }
    if (err instanceof ApiError && err.code === "NO_MATERIAL") {
      return { status: "no-material" };
    }
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Request failed",
    };
  }
  if (!isAlive()) return { status: "aborted" };

  // The batch route is all-or-nothing, so partial tolerance lives here:
  // keep the drafts the server schema accepts, silently drop the rest.
  const valid = drafts.flatMap((d) => {
    const parsed = questionInputSchema.safeParse(d);
    return parsed.success ? [parsed.data] : [];
  });
  if (valid.length === 0) return { status: "empty" };

  onSaving?.();
  try {
    const res = await fetchJson<{ questions: unknown[] }>(
      "/api/questions/batch",
      "POST",
      { topicId, questions: valid },
    );
    if (!isAlive()) return { status: "aborted" };
    return { status: "success", added: res.questions.length };
  } catch (err) {
    if (!isAlive()) return { status: "aborted" };
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Request failed",
    };
  }
}
