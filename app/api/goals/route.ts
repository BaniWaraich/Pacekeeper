import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { badRequest, validationError } from "@/lib/api-errors";
import { activeStructureInclude } from "@/lib/ownership";
import { goalCreateSchema } from "@/lib/validations";

/** Today as a UTC calendar day ("YYYY-MM-DD"). Writes don't take `?tz=`
 *  (the §6 tz convention covers reads), so the future-date check is
 *  against the server-UTC day. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json().catch(() => undefined);
    const parsed = goalCreateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.examDate <= todayUtc()) {
      return badRequest("examDate must be a future date", "EXAM_DATE_PAST");
    }

    const goal = await prisma.goal.create({
      data: {
        userId,
        title: parsed.data.title,
        examDate: new Date(parsed.data.examDate),
        ...(parsed.data.dailyNewTopicCap !== undefined && {
          dailyNewTopicCap: parsed.data.dailyNewTopicCap,
        }),
        ...(parsed.data.bufferDays !== undefined && {
          bufferDays: parsed.data.bufferDays,
        }),
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}

export async function GET() {
  try {
    const userId = await requireUser();
    const goals = await prisma.goal.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: "asc" },
      include: activeStructureInclude,
    });
    return NextResponse.json(goals);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
