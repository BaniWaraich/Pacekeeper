import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * lib/api-errors.ts — the §6 error envelope: every failure body is
 * `{ error, code }` (plus `fields` on validation failures). Completes the
 * convention `unauthorizedResponse()` (lib/auth-helpers.ts) started.
 */

/** 400 with per-field errors, per §6 "Zod-validate params/body — 400 with
 *  field errors otherwise". */
export function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      code: "VALIDATION",
      fields: z.flattenError(error).fieldErrors,
    },
    { status: 400 },
  );
}

/** 400 for route-layer checks that aren't wire-shape concerns
 *  (e.g. examDate must be a future date). */
export function badRequest(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 400 });
}

/** 404 for missing AND cross-tenant rows alike — §6: cross-tenant access
 *  returns 404, not 403 (don't confirm existence). */
export function notFound() {
  return NextResponse.json(
    { error: "Not found", code: "NOT_FOUND" },
    { status: 404 },
  );
}

/** 503 for the AI touchpoints (§6.3, §8 #1): Gemini down / rate-limited /
 *  malformed-after-retry / timeout / key absent. The stable envelope the
 *  "two buttons break" toast renders — always `{ error, code }`. */
export function aiUnavailable() {
  return NextResponse.json(
    { error: "AI service unavailable", code: "AI_UNAVAILABLE" },
    { status: 503 },
  );
}
