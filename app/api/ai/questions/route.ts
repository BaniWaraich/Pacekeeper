import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { aiUnavailable, badRequest, notFound, validationError } from "@/lib/api-errors";
import { getOwnedTopic } from "@/lib/ownership";
import { aiQuestionsRequestSchema } from "@/lib/validations";
import { proposeQuestions } from "@/lib/ai/gate";
import { AiUnavailableError } from "@/lib/ai/errors";

/**
 * POST /api/ai/questions (§6.3) — propose `QuestionInput` drafts from a topic's
 * material (read server-side). DRAFT ONLY: the only DB call is the ownership
 * READ; nothing is written. Drafts flow to client state and reach the DB only
 * via the user confirming through POST /api/questions/batch (step 13).
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json().catch(() => undefined);
    const parsed = aiQuestionsRequestSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const topic = await getOwnedTopic(userId, parsed.data.topicId);
    if (!topic) return notFound();

    const material = topic.material?.trim();
    if (!material) {
      // No source text to draft from — a clean 400, never an empty prompt.
      return badRequest("Topic has no material to draft from", "NO_MATERIAL");
    }

    const result = await proposeQuestions(material, parsed.data.count);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    if (e instanceof AiUnavailableError) return aiUnavailable();
    throw e;
  }
}
