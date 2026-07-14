import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { badRequest, notFound, validationError } from "@/lib/api-errors";
import { getOwnedQuestion } from "@/lib/ownership";
import { attemptCreateSchema } from "@/lib/validations";
import {
  instantToLocalDate,
  resolveTimeZone,
  todayLocalInZone,
} from "@/lib/dates";
import { questionStrength } from "@/lib/engine/strength";
import type {
  AttemptProjection,
  QuestionProjection,
} from "@/lib/engine/types";

/**
 * POST /api/attempts — the sole write into the append-only attempt ledger
 * (invariant #1, §3.2). POST only: there is deliberately no PUT/PATCH/DELETE,
 * so the ledger is append-only at the API surface, not just by convention.
 *
 * Integrity guarantees:
 *  - Ownership: the question resolves through `getOwnedQuestion` — archived or
 *    cross-tenant → 404 (invariant #6).
 *  - Server-owned grading (invariant #8): MCQ outcome is derived from the
 *    stored payload's `correctIndex`; the client cannot assert it (the schema
 *    has no `outcome` field). A flashcard records the client's self-mark.
 *  - Idempotency (§3.2, DECISION_LOG §10): the client UUID is the PK; a replay
 *    returns the existing row as success, a re-use with a different answer is a
 *    409 — never a silent overwrite.
 */

/** Read the two payload fields grading needs. A stored MCQ always satisfies
 *  this (it was validated on write); a failure signals corruption, not client
 *  error. */
const mcqPayloadSchema = z.object({
  options: z.array(z.string()),
  correctIndex: z.number().int().nonnegative(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Clamp the client-supplied instant to `now ± 24h` (§6.2 / §8 #3): a skewed
 *  device clock cannot backdate or postdate the journal beyond a day. */
function clampAttemptedAt(iso: string, now: Date = new Date()): Date {
  const t = new Date(iso).getTime();
  return new Date(Math.min(Math.max(t, now.getTime() - DAY_MS), now.getTime() + DAY_MS));
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();

    const tz = resolveTimeZone(request.nextUrl.searchParams.get("tz"));
    if (!tz) return badRequest("Missing or invalid timezone", "INVALID_TZ");

    const body = await request.json().catch(() => undefined);
    const parsed = attemptCreateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { id, questionId, selectedOption, selfMark, attemptedAt } =
      parsed.data;

    const question = await getOwnedQuestion(userId, questionId);
    if (!question) return notFound();

    // ── Derive outcome server-side (invariant #8) ──────────────────────────
    let outcome: "CORRECT" | "INCORRECT";
    let storedSelectedOption: number | null;
    if (question.type === "MCQ") {
      if (selectedOption === undefined) {
        return badRequest(
          "selectedOption is required for MCQ questions",
          "MISSING_SELECTION",
        );
      }
      const payload = mcqPayloadSchema.safeParse(question.payload);
      if (!payload.success) {
        return badRequest("Question payload is malformed", "MALFORMED_PAYLOAD");
      }
      if (selectedOption >= payload.data.options.length) {
        return badRequest("selectedOption out of range", "INVALID_SELECTION");
      }
      outcome = selectedOption === payload.data.correctIndex ? "CORRECT" : "INCORRECT";
      storedSelectedOption = selectedOption;
    } else {
      if (selfMark === undefined) {
        return badRequest(
          "selfMark is required for flashcard questions",
          "MISSING_SELFMARK",
        );
      }
      outcome = selfMark;
      storedSelectedOption = null;
    }

    // ── Append (idempotent) ────────────────────────────────────────────────
    let created = true;
    try {
      await prisma.attempt.create({
        data: {
          id,
          questionId: question.id,
          userId,
          outcome,
          selectedOption: storedSelectedOption,
          attemptedAt: clampAttemptedAt(attemptedAt),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        // The UUID already exists. Reconcile by the CLIENT-ASSERTED facts only:
        // identical answer → replay (success); different answer → conflict.
        //  - MCQ: compare (userId, questionId, selectedOption). `outcome` is
        //    server-derived from the mutable `correctIndex`, so a retry after a
        //    concurrent correctIndex edit must reconcile as a replay, not 409 —
        //    exclude it.
        //  - FLASHCARD: compare (userId, questionId, outcome). Here `outcome` IS
        //    the client's self-mark, so it is a client-asserted fact.
        // attemptedAt/createdAt are excluded (server-clamped / server-set).
        const existing = await prisma.attempt.findUnique({ where: { id } });
        const clientFactsDiffer =
          !existing ||
          existing.userId !== userId ||
          existing.questionId !== question.id ||
          (question.type === "MCQ"
            ? existing.selectedOption !== storedSelectedOption
            : existing.outcome !== outcome);
        if (clientFactsDiffer) {
          return NextResponse.json(
            {
              error: "Attempt id already used with a different answer",
              code: "ATTEMPT_CONFLICT",
            },
            { status: 409 },
          );
        }
        created = false;
      } else {
        throw e;
      }
    }

    // ── Compute-on-read strength for the response (never persisted, #3) ─────
    const history = await prisma.attempt.findMany({
      where: { questionId: question.id },
      orderBy: { attemptedAt: "asc" },
    });
    const chronological: AttemptProjection[] = history.map((a) => ({
      questionId: a.questionId,
      outcome: a.outcome,
      attemptedOnLocal: instantToLocalDate(a.attemptedAt, tz),
    }));
    const qProjection: QuestionProjection = {
      id: question.id,
      topicId: question.topicId,
      archived: question.archivedAt !== null,
    };
    const { strength } = questionStrength(
      qProjection,
      chronological,
      todayLocalInZone(tz),
    );

    return NextResponse.json({ outcome, strength }, { status: created ? 201 : 200 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    throw e;
  }
}
