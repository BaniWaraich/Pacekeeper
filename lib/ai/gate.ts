import { z } from "zod";
import {
  aiStructureResponseSchema,
  aiQuestionsResponseSchema,
  type AiStructureResponse,
  type AiQuestionsResponse,
} from "@/lib/validations";
import { generateJson } from "./gemini";
import { AiUnavailableError } from "./errors";
import {
  structurePrompt,
  questionsPrompt,
  retryPrompt,
  STRUCTURE_RESPONSE_SCHEMA,
} from "./prompts";

/**
 * lib/ai/gate.ts — the boundary. Gemini proposes, Zod disposes.
 *
 * Flow per touchpoint:
 *   1. call the Gemini seam → raw text
 *   2. JSON.parse → Zod `safeParse` against the EXISTING §6.3 schemas
 *   3. on a content failure (unparseable JSON or Zod-invalid): ONE corrective
 *      retry that feeds the validation errors back to Gemini
 *   4. still failing → throw `AiUnavailableError` → route → 503
 *
 * Invariants:
 *   - reject-not-repair: nothing is coerced, defaulted, or field-patched. The
 *     only text handling is locating the JSON string in the response.
 *   - transport/HTTP/timeout failures throw straight out of the seam and are NOT
 *     retried here — the single retry is reserved for content failures a re-ask
 *     can plausibly fix (a 429 re-ask would just 429 again).
 */

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string };

/** Extract the JSON string from a raw response. The ONLY normalisation allowed:
 *  strip a leading/trailing ```json fence if the model wrapped the object. No
 *  field value is touched — this is JSON extraction, not repair. */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function tryParse<T>(raw: string, schema: z.ZodType<T>): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch (e) {
    return {
      ok: false,
      errors: `Response was not valid JSON: ${(e as Error).message}`,
    };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: JSON.stringify(z.flattenError(parsed.error), null, 2),
    };
  }
  return { ok: true, value: parsed.data };
}

interface GateParams<T> {
  basePrompt: string;
  schema: z.ZodType<T>;
  responseSchema?: unknown;
}

async function runGate<T>({
  basePrompt,
  schema,
  responseSchema,
}: GateParams<T>): Promise<T> {
  // First attempt. Transport/timeout failures throw AiUnavailableError from the
  // seam and propagate untouched (no retry).
  const raw = await generateJson({ prompt: basePrompt, responseSchema });
  const first = tryParse(raw, schema);
  if (first.ok) return first.value;

  // ONE corrective retry: feed the rejected response + validation errors back.
  const retryRaw = await generateJson({
    prompt: retryPrompt(basePrompt, raw, first.errors),
    responseSchema,
  });
  const second = tryParse(retryRaw, schema);
  if (second.ok) return second.value;

  throw new AiUnavailableError(
    `AI output failed validation after one retry: ${second.errors}`,
  );
}

/** POST /api/ai/structure — propose modules/topics from pasted material. */
export function proposeStructure(material: string): Promise<AiStructureResponse> {
  return runGate({
    basePrompt: structurePrompt(material),
    schema: aiStructureResponseSchema,
    responseSchema: STRUCTURE_RESPONSE_SCHEMA,
  });
}

/** POST /api/ai/questions — propose QuestionInput drafts from topic material. */
export function proposeQuestions(
  material: string,
  count: number,
): Promise<AiQuestionsResponse> {
  return runGate({
    basePrompt: questionsPrompt(material, count),
    schema: aiQuestionsResponseSchema,
  });
}
