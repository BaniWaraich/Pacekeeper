import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import {
  badRequest,
  conflict,
  notFound,
  validationError,
} from "@/lib/api-errors";
import { getOwnedGoal } from "@/lib/ownership";
import { resolvePlanWrite } from "@/lib/plan-write";
import { planWriteSchema } from "@/lib/validations";

type Params = { params: Promise<{ goalId: string }> };

/** Stale `basePlanVersion` detected inside the transaction — rolls it back. */
class PlanVersionConflict extends Error {}

const conflictResponse = () =>
  conflict(
    "The plan changed since this proposal was computed",
    "PLAN_VERSION_CONFLICT",
  );

/**
 * PUT /api/goals/:id/plan (§6.2, §3.4) — the confirm: THE ONLY code path that
 * writes plan entries. Versions are append-only; `resolvePlanWrite`
 * (lib/plan-write.ts) turns the client's `basePlanVersion` into the target
 * version — v0-no-bump for a first plan, N+1 for a recalibration — or a
 * conflict when the baseline moved. Everything is re-verified INSIDE a
 * Serializable transaction, so a stale confirm can neither touch the
 * immutable v0 (the OPL baseline) nor land entries under a moved version;
 * serialization/unique failures from a concurrent confirm surface as the
 * same 409 the staleness check uses.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUser();
    const { goalId } = await params;
    const goal = await getOwnedGoal(userId, goalId);
    if (!goal) return notFound();

    const body = await request.json().catch(() => undefined);
    const parsed = planWriteSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { basePlanVersion, entries } = parsed.data;

    // "Validates topics belong to goal" (§6.2): every topicId must resolve
    // through the active FK chain of THIS goal (lib/ownership.ts pattern).
    // The goal itself is already owned, so a foreign topic is a 400, not 404.
    const ownedCount = await prisma.topic.count({
      where: {
        id: { in: entries.map((e) => e.topicId) },
        archivedAt: null,
        module: {
          archivedAt: null,
          goalId: goal.id,
          goal: { userId, archivedAt: null },
        },
      },
    });
    if (ownedCount !== entries.length) {
      return badRequest(
        "Every entry must reference an active topic of this goal",
        "TOPIC_NOT_IN_GOAL",
      );
    }

    let planVersion: number;
    try {
      planVersion = await prisma.$transaction(
        async (tx) => {
          const fresh = await tx.goal.findUnique({
            where: { id: goal.id },
            select: { currentPlanVersion: true },
          });
          const v0Count = await tx.planEntry.count({
            where: { goalId: goal.id, planVersion: 0 },
          });
          const resolution = fresh
            ? resolvePlanWrite(
                basePlanVersion,
                fresh.currentPlanVersion,
                v0Count > 0,
              )
            : "CONFLICT";
          if (resolution === "CONFLICT") throw new PlanVersionConflict();

          await tx.planEntry.createMany({
            data: entries.map((e) => ({
              goalId: goal.id,
              topicId: e.topicId,
              plannedDate: new Date(e.plannedDate),
              planVersion: resolution.targetVersion,
            })),
          });
          if (resolution.bump) {
            // Guarded bump: zero rows means another confirm won the race
            // after our reads — roll everything back as a conflict.
            const bumped = await tx.goal.updateMany({
              where: { id: goal.id, currentPlanVersion: basePlanVersion! },
              data: { currentPlanVersion: resolution.targetVersion },
            });
            if (bumped.count === 0) throw new PlanVersionConflict();
          }
          return resolution.targetVersion;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (e instanceof PlanVersionConflict) return conflictResponse();
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === "P2002" || e.code === "P2034")
      ) {
        return conflictResponse();
      }
      throw e;
    }

    return NextResponse.json({ planVersion });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
