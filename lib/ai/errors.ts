/**
 * lib/ai/errors.ts — the single failure type the AI adapter throws.
 *
 * Every non-success path in the adapter (missing key, transport/HTTP error,
 * timeout, empty response, and a gate failure that survives its one retry)
 * throws `AiUnavailableError`. Routes catch it and render the stable
 * `503 { error, code: "AI_UNAVAILABLE" }` envelope (`aiUnavailable()`). Keeping
 * one type means no raw SDK rejection or Zod error ever escapes a handler.
 */
export class AiUnavailableError extends Error {
  constructor(message = "AI unavailable", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiUnavailableError";
  }
}
