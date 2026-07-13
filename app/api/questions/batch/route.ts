import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { notFound, validationError } from "@/lib/api-errors";
import { getOwnedTopic } from "@/lib/ownership";
import { toQuestionRow } from "@/lib/question-payload";
import { questionBatchSchema } from "@/lib/validations";

/**
 * POST /api/questions/batch — the confirmation gate's write (§6.1): manual
 * authoring and the AI-draft confirm flow (step 13) post through this same
 * endpoint; every item is fully re-validated regardless of origin.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json().catch(() => undefined);
    const parsed = questionBatchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const topic = await getOwnedTopic(userId, parsed.data.topicId);
    if (!topic) return notFound();

    const questions = await prisma.question.createManyAndReturn({
      data: parsed.data.questions.map((q) => ({
        topicId: topic.id,
        ...toQuestionRow(q),
      })),
    });
    return NextResponse.json({ questions }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
