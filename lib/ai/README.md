# AI adapter (step 12) — the trust boundary

**Gemini proposes, Zod gates, the user disposes.** AI is an untrusted input source
outside the trust boundary. This adapter is the boundary: the model's output is
Zod-validated against the *existing* `lib/validations.ts` schemas (reject-not-repair)
and returned as **drafts**. Nothing here writes to the database — the only path from
draft to row is the user confirming through step 13's UI into
`POST /api/questions/batch` (step 9).

## Modules

| File | Role |
| --- | --- |
| `config.ts` | Reads `GEMINI_API_KEY` (server-only; no `NEXT_PUBLIC_` ⇒ stripped from client bundles), model, timeout — once, at load. Exposes `isAiConfigured`. |
| `gemini.ts` | THE seam. `generateJson()` → raw model text; owns the hard timeout; maps every transport/HTTP/timeout/empty failure to `AiUnavailableError`. Mock this in tests. |
| `gate.ts` | `proposeStructure` / `proposeQuestions`: JSON.parse → Zod `safeParse` → one corrective retry → throw. No coercion/defaulting/repair. |
| `prompts.ts` | Prompt builders; untrusted material wrapped in a `<material>` data block. |
| `errors.ts` | `AiUnavailableError` — the single failure type routes catch. |

## Route contracts (what step 13 builds against)

All envelopes are `{ error, code }` (validation adds `fields`). These shapes are
**stable** — the §8 "Gemini down = exactly two buttons break" toast renders the `503`.

### `POST /api/ai/structure` · `maxDuration = 60`
- **Request** `{ material: string(1..100k) }`
- **200** `{ modules: [{ title, topics: [{ title }] }] }`
- **401** `{ error, code: "UNAUTHORIZED" }`
- **400** `{ error, code: "VALIDATION", fields }`
- **503** `{ error, code: "AI_UNAVAILABLE" }` — down / rate-limited / malformed-after-retry / timeout / key absent

### `POST /api/ai/questions` · `maxDuration = 60`
- **Request** `{ topicId, count: 1..20 }` (material is read server-side from the topic)
- **200** `{ drafts: QuestionInput[] }` — each draft is an MCQ or FLASHCARD per §6.1
- **401** `{ error, code: "UNAUTHORIZED" }`
- **400** `{ error, code: "VALIDATION", fields }`
- **404** `{ error, code: "NOT_FOUND" }` — topic missing or not owned
- **400** `{ error, code: "NO_MATERIAL" }` — topic has no material to draft from
- **503** `{ error, code: "AI_UNAVAILABLE" }`

### `POST /api/ingest/pdf`
Extracts text server-side (`pdf-parse`); Gemini never receives files. **Not a Gemini
route** — no `GEMINI_API_KEY` dependency, so it survives the key-pull. **No 503.**
- **Request** `multipart/form-data`, field `file` (PDF ≤ 10 MB)
- **200** `{ text }`
- **401** `{ error, code: "UNAUTHORIZED" }`
- **400** `{ error, code }` where `code` ∈ `BAD_UPLOAD` | `FILE_TOO_LARGE` | `PDF_PARSE_FAILED` | `TEXT_TOO_LONG`

## Invariants
- **Zero DB writes** in this step. The only DB call is `getOwnedTopic` (a read) in
  `/api/ai/questions`.
- **Reject-not-repair.** The only text handling on model output is locating/extracting
  the JSON string; no field is coerced, defaulted, or patched.
- **One retry, content-only.** Malformed/invalid JSON gets one corrective retry
  (validation errors fed back to Gemini). Transport/429/timeout failures go **straight
  to 503** — no retry.
- **Env override:** `GEMINI_MODEL` (default `gemini-flash-lite-latest` — a `-latest`
  alias, since pinned models 404 for freshly-created free-tier projects; verified
  live), `GEMINI_TIMEOUT_MS` (default 20000).
