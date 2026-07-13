import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { notFound, validationError } from "@/lib/api-errors";
import { getOwnedModule } from "@/lib/ownership";
import { topicCreateSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json().catch(() => undefined);
    const parsed = topicCreateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const parentModule = await getOwnedModule(userId, parsed.data.moduleId);
    if (!parentModule) return notFound();

    const topic = await prisma.topic.create({
      data: {
        moduleId: parentModule.id,
        title: parsed.data.title,
        ...(parsed.data.material !== undefined && {
          material: parsed.data.material,
        }),
        orderIndex: parsed.data.orderIndex,
      },
    });
    return NextResponse.json(topic, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
