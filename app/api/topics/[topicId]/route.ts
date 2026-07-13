import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { notFound, validationError } from "@/lib/api-errors";
import { getOwnedTopic } from "@/lib/ownership";
import { topicUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ topicId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { topicId } = await params;
    const topic = await getOwnedTopic(userId, topicId);
    if (!topic) return notFound();

    const body = await request.json().catch(() => undefined);
    const parsed = topicUpdateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.topic.update({
      where: { id: topic.id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { topicId } = await params;
    const topic = await getOwnedTopic(userId, topicId);
    if (!topic) return notFound();

    const archived = await prisma.topic.update({
      where: { id: topic.id },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json({ archivedAt: archived.archivedAt });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
