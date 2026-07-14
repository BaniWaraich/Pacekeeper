import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { aiUnavailable, validationError } from "@/lib/api-errors";
import { aiStructureRequestSchema } from "@/lib/validations";
import { proposeStructure } from "@/lib/ai/gate";
import { AiUnavailableError } from "@/lib/ai/errors";

/**
 * POST /api/ai/structure (§6.3) — propose a goal structure (modules/topics) from
 * pasted material. DRAFT ONLY: nothing is written to the DB. Success returns the
 * Zod-gated `{ modules }`; any AI failure returns `503 { code: "AI_UNAVAILABLE" }`.
 * Material is inline (no referenced entity), so there is no ownership resolution.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json().catch(() => undefined);
    const parsed = aiStructureRequestSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const result = await proposeStructure(parsed.data.material);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse();
    if (e instanceof AiUnavailableError) return aiUnavailable();
    throw e;
  }
}
