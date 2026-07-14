import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { notFound, validationError } from "@/lib/api-errors";
import { getOwnedModule } from "@/lib/ownership";
import { moduleUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ moduleId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { moduleId } = await params;
    const owned = await getOwnedModule(userId, moduleId);
    if (!owned) return notFound();

    const body = await request.json().catch(() => undefined);
    const parsed = moduleUpdateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.module.update({
      where: { id: owned.id },
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
    const { moduleId } = await params;
    const owned = await getOwnedModule(userId, moduleId);
    if (!owned) return notFound();

    const archived = await prisma.module.update({
      where: { id: owned.id },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json({ archivedAt: archived.archivedAt });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
