import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { badRequest, notFound, validationError } from "@/lib/api-errors";
import { activeStructureInclude, getOwnedGoal } from "@/lib/ownership";
import { goalUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ goalId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { goalId } = await params;
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId, archivedAt: null },
      include: activeStructureInclude,
    });
    if (!goal) return notFound();
    return NextResponse.json(goal);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { goalId } = await params;
    const goal = await getOwnedGoal(userId, goalId);
    if (!goal) return notFound();

    const body = await request.json().catch(() => undefined);
    const parsed = goalUpdateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { examDate, ...rest } = parsed.data;
    if (examDate !== undefined && examDate <= new Date().toISOString().slice(0, 10)) {
      return badRequest("examDate must be a future date", "EXAM_DATE_PAST");
    }

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: {
        ...rest,
        ...(examDate !== undefined && { examDate: new Date(examDate) }),
      },
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
    const { goalId } = await params;
    const goal = await getOwnedGoal(userId, goalId);
    if (!goal) return notFound();

    const archived = await prisma.goal.update({
      where: { id: goal.id },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json({ archivedAt: archived.archivedAt });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
