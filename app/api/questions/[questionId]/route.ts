import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { notFound, validationError } from "@/lib/api-errors";
import { getOwnedQuestion } from "@/lib/ownership";
import { toQuestionRow } from "@/lib/question-payload";
import { questionUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ questionId: string }> };

/** PATCH is a full QuestionInput re-submit (replace, not partial-of-union). */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { questionId } = await params;
    const question = await getOwnedQuestion(userId, questionId);
    if (!question) return notFound();

    const body = await request.json().catch(() => undefined);
    const parsed = questionUpdateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.question.update({
      where: { id: question.id },
      data: toQuestionRow(parsed.data),
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}

/** Archive, never delete — Attempt→Question is onDelete: Restrict by design. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { questionId } = await params;
    const question = await getOwnedQuestion(userId, questionId);
    if (!question) return notFound();

    const archived = await prisma.question.update({
      where: { id: question.id },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json({ archivedAt: archived.archivedAt });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
