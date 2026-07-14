import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  isAiConfigured,
} from "./config";
import { AiUnavailableError } from "./errors";

/**
 * lib/ai/gemini.ts — THE Gemini seam.
 *
 * `generateJson` is the one function that talks to the network. It:
 *   - refuses to run without a key (typed throw, before any request),
 *   - enforces a hard timeout via AbortController,
 *   - returns the model's RAW text (an unparsed JSON string) on success, and
 *   - maps EVERY transport/HTTP/timeout/empty-response failure to
 *     `AiUnavailableError` — so the gate above it never sees a raw SDK rejection.
 *
 * This is also the mock seam for tests: stub `generateJson` and no live API is
 * touched. It does not parse, validate, coerce, or repair — that is the gate's
 * job, and the gate's alone (reject-not-repair).
 */

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!isAiConfigured) {
    throw new AiUnavailableError("GEMINI_API_KEY is not configured");
  }
  client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return client;
}

export interface GenerateJsonParams {
  /** The full user-turn prompt (schema described in text; material data-wrapped). */
  prompt: string;
  /** Optional system instruction. */
  system?: string;
  /** Optional Gemini responseSchema hint. NON-authoritative — Zod is the gate. */
  responseSchema?: unknown;
}

export async function generateJson({
  prompt,
  system,
  responseSchema,
}: GenerateJsonParams): Promise<string> {
  const ai = getClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        ...(responseSchema ? { responseSchema } : {}),
        ...(system ? { systemInstruction: system } : {}),
        abortSignal: controller.signal,
        // Low temperature: we want faithful extraction, not creativity.
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      // Empty / safety-blocked response: not a content failure the gate can
      // re-ask its way out of, so treat it as unavailable (no retry).
      throw new AiUnavailableError("Gemini returned an empty response");
    }
    return text;
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    // Abort (timeout), 429 rate limit, 5xx, network — every non-content failure
    // collapses to the same unavailable signal. The gate does NOT retry these.
    throw new AiUnavailableError("Gemini request failed", { cause: err });
  } finally {
    clearTimeout(timer);
  }
}
