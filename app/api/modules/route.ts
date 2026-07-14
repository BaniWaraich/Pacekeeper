import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { notFound, validationError } from "@/lib/api-errors";
import { getOwnedGoal } from "@/lib/ownership";
import { moduleCreateSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json().catch(() => undefined);
    const parsed = moduleCreateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const goal = await getOwnedGoal(userId, parsed.data.goalId);
    if (!goal) return notFound();

    const created = await prisma.module.create({
      data: {
        goalId: goal.id,
        title: parsed.data.title,
        orderIndex: parsed.data.orderIndex,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
