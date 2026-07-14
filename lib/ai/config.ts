/**
 * lib/ai/config.ts — Gemini configuration, read ONCE at module scope.
 *
 * Server-only by construction: `GEMINI_API_KEY` has no `NEXT_PUBLIC_` prefix, so
 * Next.js strips it from every client bundle — the key cannot leak into a client
 * component even if this module were imported there by mistake (§8 #10). The
 * convention on top of that: nothing under `lib/ai/` is imported by client code.
 *
 * "Fail fast, not at first request": presence is resolved here at load time and
 * exposed as `isAiConfigured`. The Gemini seam (`gemini.ts`) throws a typed
 * `AiUnavailableError` BEFORE any network call when the key is absent, and every
 * AI route maps that to the clean `503 { code: "AI_UNAVAILABLE" }` envelope. We
 * deliberately do NOT crash the process on a missing key — that would break every
 * non-AI route and violate §7/§8 ("absence disables the two AI buttons and
 * nothing else").
 */

/** Trimmed key, or "" when unset/blank. */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() ?? "";

/** Whether the two AI touchpoints are live. `false` ⇒ both routes 503 cleanly. */
export const isAiConfigured = GEMINI_API_KEY.length > 0;

/** Free-tier model; overridable via env. Two things verified live against a new
 *  free-tier key:
 *   - Use the `-latest` alias, not a pinned version: pinned models (e.g.
 *     `gemini-2.5-flash`) 404 for freshly-created projects ("no longer available
 *     to new users"); the alias tracks a currently-available flash model.
 *   - Prefer `flash-lite`: `gemini-flash-latest` currently aliases a "thinking"
 *     model that took ~17s per call — too close to GEMINI_TIMEOUT_MS and, on the
 *     retry path (two sequential calls), at risk of exceeding maxDuration=60.
 *     `flash-lite-latest` returns in ~1-3s with quality ample for extraction. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";

/** Hard client-side request cap (ms). Well under the route's `maxDuration = 60`
 *  so we return a clean 503 before Vercel's function timeout ever fires. */
export const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20_000;
