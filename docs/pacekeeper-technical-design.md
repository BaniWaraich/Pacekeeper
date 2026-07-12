# Technical Design Document

Companion documents: `SPEC.md` (product spec) and `DECISION_LOG.md` (architecture decisions with rationale). This document assumes those decisions and specifies the build: schema, algorithms, contracts, failure handling, and the implementation plan.

**Stack:** Next.js (App Router, TypeScript, Tailwind) on Vercel · PostgreSQL on Neon · Prisma · Auth.js (credentials + seeded demo account) · Gemini free tier · PostHog.

---

## 1. Overview & Goals

PaceKeeper is a deadline-aware spaced-repetition study tool. The user sets a goal with an exam date, structures material into modules and topics, attaches questions (MCQs and flashcards), and studies through a daily Today view. The system derives question strength, topic readiness, and pace status from an append-only attempt log, and handles slippage through three regimes: on pace → silent redistribution → triage.

Success for this build means: a live Vercel deployment an evaluator can open, log into (seeded demo account), and use end-to-end within seconds; a codebase whose engine logic is unit-tested with fixtures; and behavior that degrades gracefully when Gemini is unavailable.

**Non-goals (v1):** video transcription, user-set module weights, formula versioning, WhatsApp/calendar integrations, mobile apps. See SPEC.md roadmap.

---

## 2. Actors & Responsibilities

| Actor | Responsibilities |
| --- | --- |
| **Student (user)** | Creates goals, confirms AI proposals, authors/edits questions, attempts questions, confirms recalibrated/triaged plans. The only actor that causes writes. |
| **Next.js frontend** | Renders all screens; holds AI drafts in client state until confirmation; generates attempt UUIDs at answer time; sends IANA timezone with every read; fires client-side PostHog events. |
| **API route handlers** | Authenticate the session, validate all input with Zod, scope every query by `userId`, fetch facts for the engine, persist confirmed user actions, fire server-side PostHog events. |
| **Scheduling engine** | Pure TypeScript module, zero I/O. Computes strength, readiness, due reviews, Today view, pace regime, redistribution and triage proposals. Never writes. |
| **AI adapter** | Calls Gemini with strict JSON schemas, validates responses with Zod (reject, don't repair), returns drafts. Never writes to the database. |
| **Gemini (external)** | Drafts structure proposals and question batches. Untrusted; may rate-limit, return malformed output, or be down. |
| **PostHog (external)** | Receives analytics events. Fire-and-forget; nothing depends on it. |

There are no scheduled jobs, workers, or webhooks — by design (DECISION_LOG §2, §4).

---

## 3. Architecture & Data Flow

One deployable Next.js app. The frontend calls API route handlers; handlers call the engine in-process and Prisma for persistence. The engine receives plain data and today's date and returns plain data. The AI adapter is the only code path that leaves our control.

### 3.1 The read path (every dashboard/Today load)

1. Client requests e.g. `GET /api/goals/:id/today?tz=Asia/Kolkata`.
2. Handler authenticates, validates `tz` as a known IANA zone, computes `todayLocal` from the **server clock** in that zone.
3. Handler fetches the goal, active topics, questions, plan entries (current version), and all attempts for the goal's questions.
4. Handler calls `engine.todayView(facts, todayLocal)` and returns the result. Nothing is written.

### 3.2 The write path (an attempt)

1. User answers a question. Client generates a UUID **at that moment** and POSTs `{ id, questionId, ... }`.
2. Handler validates, verifies the question belongs to the user, grades MCQs server-side against the stored payload (the client's notion of "correct" is never trusted), and inserts the attempt.
3. A retry of the same request hits the primary-key constraint; the handler treats the unique violation as success (idempotency, DECISION_LOG §10).

### 3.3 The AI path (both touchpoints)

1. User pastes material (or server extracts text from an uploaded PDF via `pdf-parse` — Gemini only ever sees plain text).
2. Adapter calls Gemini with a JSON-schema-constrained prompt. Response is parsed and validated with Zod. Malformed → one retry → toast + manual path.
3. Valid drafts are returned to the client and held in client state. The user edits/confirms; only then does the client POST the confirmed content to an ordinary CRUD endpoint, which validates it again like any user input.

### 3.4 Plan lifecycle

`draft proposal (engine output or AI structure) → user confirms → plan_entries written under a new planVersion → goal.currentPlanVersion bumped`. Old versions are never mutated or deleted (versioned by replacement). Recalibration and triage both follow this cycle: engine proposes, user confirms, new version lands.

---

## 4. Database Schema (Prisma)

Eight models. Conventions applied throughout: cuid primary keys (except `Attempt`, whose id is the client-generated idempotency UUID), `createdAt`/`updatedAt` on mutable models, `archivedAt` soft deletes on content models (DECISION_LOG §8), indexes on every foreign key and on the query patterns listed in §3.

```
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum QuestionType {
  MCQ
  FLASHCARD
}

enum Outcome {
  CORRECT
  INCORRECT
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  goals    Goal[]
  attempts Attempt[]
  notes    Note[]
}

model Goal {
  id                 String    @id @default(cuid())
  userId             String
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title              String
  examDate           DateTime  @db.Date
  dailyNewTopicCap   Int       @default(5)
  bufferDays         Int       @default(2)
  currentPlanVersion Int       @default(0)
  archivedAt         DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  modules     Module[]
  planEntries PlanEntry[]

  @@index([userId])
}

model Module {
  id         String    @id @default(cuid())
  goalId     String
  goal       Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)
  title      String
  orderIndex Int
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  topics Topic[]

  @@index([goalId])
}

model Topic {
  id         String    @id @default(cuid())
  moduleId   String
  module     Module    @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  title      String
  material   String?   @db.Text
  orderIndex Int
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  questions   Question[]
  planEntries PlanEntry[]
  notes       Note[]

  @@index([moduleId])
}

model Question {
  id         String       @id @default(cuid())
  topicId    String
  topic      Topic        @relation(fields: [topicId], references: [id], onDelete: Cascade)
  type       QuestionType
  prompt     String       @db.Text
  payload    Json
  archivedAt DateTime?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  attempts Attempt[]

  @@index([topicId])
}

model Attempt {
  id             String   @id            // client-generated UUID = idempotency key
  questionId     String
  question       Question @relation(fields: [questionId], references: [id], onDelete: Restrict)
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  outcome        Outcome
  selectedOption Int?                    // MCQ audit trail; null for flashcards
  attemptedAt    DateTime
  createdAt      DateTime @default(now())
                                          // append-only: no updatedAt by design

  @@index([userId, attemptedAt])
  @@index([questionId, attemptedAt])
}

model PlanEntry {
  id          String   @id @default(cuid())
  goalId      String
  goal        Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  topicId     String
  topic       Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  plannedDate DateTime @db.Date
  planVersion Int
  createdAt   DateTime @default(now())

  @@unique([goalId, planVersion, topicId])
  @@index([goalId, planVersion, plannedDate])
}

model Note {
  id        String   @id @default(cuid())
  topicId   String
  topic     Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([topicId])
}
```

### 4.1 Schema decisions worth calling out

- **`Attempt.id` is the client UUID and the primary key.** One column serves as identity and idempotency constraint. Auto-increment IDs are avoided everywhere anyway (they leak record counts).
- **`Attempt → Question` is `onDelete: Restrict`.** Questions are archived, never deleted, so this constraint should never fire — its presence is a tripwire: if code ever tries to hard-delete a question with history, the database refuses rather than erasing facts. `User → *` cascades exist for account deletion (the one legitimate erase-everything path, and a privacy requirement).
- **`Question.payload` is type-discriminated JSON**, validated by Zod at every boundary: MCQ = `{ options: string[], correctIndex: number }` (2–6 options), flashcard = `{ back: string }`. Two question types don't justify separate tables; the discriminator is the `type` enum.
- **Cross-tenant checks join up the tree.** `Attempt` carries `userId` directly (it's the hottest query path); ownership of a `Question` is verified via `topic.module.goal.userId` in the handler before any write.
- **Dates that mean calendar days use `@db.Date`** (`examDate`, `plannedDate`) — they are timezone-free facts. Instants (`attemptedAt`) are full UTC timestamps.

---

## 5. The Engine — Algorithms

A single module (`lib/engine/`) of pure functions. Inputs: plain objects + `todayLocal` (a `YYYY-MM-DD` string computed by the API layer per DECISION_LOG §7). No `new Date()` inside the engine — the current date is always a parameter, which is what makes every function below testable with fixtures.

All derivations run over the worst case of ~1,800 attempt rows per user (DECISION_LOG §3); everything below is a single pass plus small sorts.

### 5.1 Review scheduling (per question)

Simplified expanding-interval scheme. Let `streak` = number of consecutive `CORRECT` outcomes counting back from the most recent attempt (an `INCORRECT` resets it to 0).

```
INTERVALS = [1, 2, 4, 7, 12, 20]        // days
interval(q)  = INTERVALS[min(streak, 5)]
dueDate(q)   = date(lastAttempt) + interval(q)
```

- Never-attempted questions are not "due" — they surface when their topic is introduced (first appears in the plan on/ before today).
- A question answered incorrectly is due the next day (`streak = 0 → interval 1`).
- Due = `dueDate ≤ todayLocal`. Overdue questions don't stack duplicate reviews; they're simply due.

### 5.2 Question strength (0 to 1)

Strength = how well-established the memory is, decayed by lateness:

```
base(q)     = 1 − 0.5^streak                    // 0, .5, .75, .875, …
overdueDays = max(0, todayLocal − dueDate(q))
strength(q) = base(q) × 0.5^(overdueDays / interval(q))
```

Properties: unattempted or just-failed → 0; each consecutive correct closes half the remaining gap to 1; strength halves for every full interval a review is overdue. Every term is auditable from the journal — no opaque constants beyond the interval ladder.

### 5.3 Readiness

```
topicReadiness(t) = mean(strength(q) for active q in t)      // no questions → 0
goalReadiness(g)  = mean(topicReadiness(t) for active t)     // archived topics excluded
```

Unattempted questions count as 0 inside the mean — readiness is honest about untested material rather than ignoring it.

### 5.4 Today view

```
todayView = {
  reviews:   active questions with dueDate ≤ todayLocal,
  newTopics: topics with a current-version plan entry dated ≤ todayLocal
             and zero attempts on any of their questions,
  regime:    paceRegime(...)                                   // §5.5
}
```

A topic counts as **introduced** once any of its questions has an attempt — the plan says what *should* start; the journal says what *did*.

### 5.5 Pace regimes

```
remaining     = count(active topics not yet introduced)
daysUsable    = max((examDate − todayLocal) − bufferDays, 0)
requiredRate  = remaining / max(daysUsable, 1)                 // topics/day needed now
baselineRate  = totalActiveTopics / originalPlanLength         // topics/day as planned

ON_PACE   if requiredRate ≤ baselineRate × 1.25
SLIPPING  if baselineRate × 1.25 < requiredRate ≤ dailyNewTopicCap
TRIAGE    if requiredRate > dailyNewTopicCap
```

The 1.25 tolerance keeps one slow weekend from flipping regimes (thresholds are constants in one file, called out in the case study as tunable). `dailyNewTopicCap` is the user's stated ceiling — beyond it, redistribution would produce a plan the user has already said she can't execute, which is the honest trigger for triage.

### 5.6 Redistribution (SLIPPING) — silent, then confirmed

`redistribute(remainingTopics, todayLocal, examDate, caps) → proposedEntries[]`: spread not-yet-introduced topics evenly (preserving module `orderIndex`) across usable days, respecting the daily cap. Presented to the user; on confirmation, written as `planVersion + 1`.

### 5.7 Triage (TRIAGE)

Capacity-constrained selection, ranked by **measured weakness alone** (DECISION_LOG §6 — no importance weights):

```
capacity = daysUsable × dailyNewTopicCap
ranked   = notYetReadyTopics sorted by topicReadiness ascending
keep     = first `capacity` topics by rank
defer    = the rest — shown explicitly as "won't reach", never hidden
```

The kept set is scheduled weakest-first; the deferred set is displayed with its readiness so the cut is transparent. Confirmation writes `planVersion + 1`. The dashboard thereafter reports pace *against the confirmed triaged plan*.

### 5.8 Testing

Engine tests use fixture builders (`makeAttempts({ streak: 3, lastDaysAgo: 5 })`) and pin: interval ladder, streak reset, strength decay curve, readiness with unattempted questions, regime thresholds at the boundaries (±1 topic, ±1 day), redistribution respecting the cap, and triage ordering + capacity math. These tests are the case-study exhibit for the compute-on-read decision.

---

## 6. API Contracts

All routes under `app/api/`. Every handler: (1) session check via Auth.js — 401 otherwise; (2) Zod-validate params/body — 400 with field errors otherwise; (3) scope every query by the session's `userId` — cross-tenant access returns 404, not 403 (don't confirm existence). Errors return `{ error, code }`; verbose details never leak in production.

**Convention:** every read that involves dates takes `?tz=<IANA>` (validated against `Intl.supportedValuesOf('timeZone')`); the server computes `todayLocal` and passes it to the engine.

### 6.1 Content CRUD

| Method & path | Body (Zod-validated) | Returns | Notes |
| --- | --- | --- | --- |
| `POST /api/goals` | `{ title, examDate, dailyNewTopicCap?, bufferDays? }` | goal | `examDate` must be a future date |
| `GET /api/goals` / `GET /api/goals/:id` | — | goal(s) with modules/topics | archived filtered out |
| `PATCH /api/goals/:id` | partial fields | goal |  |
| `DELETE /api/goals/:id` (+ modules, topics, questions) | — | `{ archivedAt }` | **soft delete** — sets `archivedAt`, never row-deletes |
| `POST /api/modules` / `PATCH /api/modules/:id` | `{ goalId, title, orderIndex }` | module |  |
| `POST /api/topics` / `PATCH /api/topics/:id` | `{ moduleId, title, material?, orderIndex }` | topic |  |
| `POST /api/questions/batch` | `{ topicId, questions: QuestionInput[] }` | questions | **the confirmation gate's write** — used identically by manual authoring and AI-draft confirmation; each item fully re-validated |
| `PATCH /api/questions/:id` / `DELETE` | partial / — | question | delete = archive |
| `POST /api/notes` / `PATCH /api/notes/:id` | `{ topicId, content }` | note |  |

`QuestionInput` (discriminated union):

```
{ type: "MCQ", prompt: string(1..2000), options: string[](2..6), correctIndex: int < options.length }
{ type: "FLASHCARD", prompt: string(1..2000), back: string(1..5000) }
```

### 6.2 Study loop

| Method & path | Body / params | Returns | Notes |
| --- | --- | --- | --- |
| `GET /api/goals/:id/today?tz=` | — | `{ reviews[], newTopics[], regime }` | §5.4 |
| `GET /api/goals/:id/dashboard?tz=` | — | `{ goalReadiness, topicReadiness[], regime, planProgress }` | pace reported against current plan version |
| `POST /api/attempts` | `{ id: uuid, questionId, selectedOption? , selfMark?, attemptedAt }` | `{ outcome, strength }` | MCQ: server grades from stored payload — client never sends `outcome`. Flashcard: `outcome` = `selfMark`. Unique violation on `id` → return the existing attempt with `200` (idempotent). `attemptedAt` accepted from client but clamped to `now ± 24h` server-side. |
| `POST /api/goals/:id/recalibrate?tz=` | — | `{ proposedEntries[], regime }` | pure proposal — **no write** |
| `PUT /api/goals/:id/plan` | `{ entries: [{topicId, plannedDate}] }` | `{ planVersion }` | validates topics belong to goal; writes entries + bumps `currentPlanVersion` in one transaction |

### 6.3 AI touchpoints (draft-only — no database writes)

| Method & path | Body | Returns | Notes |
| --- | --- | --- | --- |
| `POST /api/ai/structure` | `{ material: string(1..100k) }` | `{ modules: [{ title, topics: [{title}] }] }` | Zod-validated against schema; reject-not-repair; 1 retry; `503 { code: "AI_UNAVAILABLE" }` on failure → client shows toast + manual path |
| `POST /api/ai/questions` | `{ topicId, count: 1..20 }` | `{ drafts: QuestionInput[] }` | material read server-side from the topic; drafts returned to client state only |
| `POST /api/ingest/pdf` | multipart PDF (≤10 MB) | `{ text }` | server-side `pdf-parse`; Gemini never receives files |

Both AI routes set `export const maxDuration = 60` (Vercel default function timeout is shorter than a slow Gemini call) and are rate-limited per user (§8).

### 6.4 Auth

Auth.js credentials provider: `signIn(email, password)` against `passwordHash` (bcrypt, 12 rounds), JWT session strategy (no session table needed). A seed script creates the demo account with a fully populated goal ~30 days into a 60-day plan, including a triage-worthy pattern of attempts, so the evaluator lands on a living dashboard.

---

## 7. System Touchpoints

| System / module | Interaction | Notes |
| --- | --- | --- |
| Neon Postgres | Prisma over the **pooled** connection string | serverless functions must use the pooler, not the direct connection |
| Gemini API | HTTPS from AI adapter only | JSON-schema prompts; key in `GEMINI_API_KEY`; absence disables the two AI buttons and nothing else |
| PostHog | client SDK + server capture | events per SPEC measurement plan; fire-and-forget, wrapped so failures are swallowed |
| Auth.js | middleware + route handlers | all `(app)` routes protected by middleware session check |
| Vercel | build + deploy + env vars | preview deploys per branch; production env vars set before demo day |

---

## 8. Points of Failure & Mitigations

| # | Failure | When | Impact | Sev | Mitigation |
| --- | --- | --- | --- | --- | --- |
| 1 | Gemini rate limit / outage / malformed JSON | free tier, demo day traffic | AI buttons fail | High (likely) / Low (blast radius) | Zod reject-not-repair, 1 retry, `503` → toast + manual path. Core loop untouched by design. Demo video shows the manual path once — resilience as a feature. |
| 2 | Duplicate attempt writes | network retry, double-tap | journal double-books → derived metrics corrupt | Critical if unhandled | client UUID as PK; unique violation returned as success (§3.2, DECISION_LOG §10) |
| 3 | Wrong "today" | user near midnight; UTC server | reviews appear/disappear at wrong local time | High | tz param + server-computed `todayLocal` (§6 convention, DECISION_LOG §7); clamp client `attemptedAt` |
| 4 | Cross-tenant data access | missing `userId` scope in one query | privacy breach | Critical | every handler scopes by session `userId`; ownership verified up the FK tree; 404 not 403; covered by handler tests |
| 5 | AI-drafted content as XSS vector | Gemini returns markup/script in a question | script execution in evaluator's browser | High | render all question content as text (React default escaping); no `dangerouslySetInnerHTML` anywhere; Zod length caps |
| 6 | Demo account abuse | public credentials in README | data vandalism before evaluation | Medium | rate-limit auth + AI routes (Upstash or in-memory per-instance); one-command reseed script to restore demo state |
| 7 | Neon cold start | first request after idle | slow first paint in demo | Medium | pooled connection string; open the app minutes before any live demo; keep landing page static so first paint is instant regardless |
| 8 | Vercel function timeout on AI calls | slow Gemini response | 504 masquerading as AI failure | Medium | `maxDuration = 60` on AI routes only; everything else is fast by the 1,800-row argument |
| 9 | Hard delete erasing history | future code path | facts destroyed, metrics silently shift | High | soft-delete-only API surface; `onDelete: Restrict` on `Attempt→Question` as DB-level tripwire |
| 10 | Secrets leakage | keys in client bundle or repo | account/API compromise | Critical | all secrets server-side env vars; `NEXT_PUBLIC_` only for the PostHog key (public by design); `.env` gitignored, `.env.example` committed |

---

## 9. Implementation Plan (July 12–15)

Steps are ordered by dependency; each names its layer. The engine lands on day 1–2 because everything demos through it.

### Day 1 — Spine (infra + DB + auth)

1. **[infra]** Scaffold Next.js (App Router, TS strict, Tailwind); repo public from the first commit with a real README skeleton.
2. **[infra]** Create Neon project; set `DATABASE_URL` (pooled) locally and in Vercel; deploy the walking skeleton immediately — deployment exists from hour one, not day four.
3. **[db]** Write the §4 Prisma schema verbatim; `prisma migrate dev`; commit the migration.
4. **[backend]** Auth.js credentials setup: bcrypt hashing, JWT sessions, middleware protecting `(app)` routes; login page.
5. **[db]** Seed script: demo user + populated goal (modules/topics/questions + ~30 days of realistic attempts engineered to demonstrate all three regimes). Idempotent and re-runnable (mitigation #6).

### Day 2 — Engine + content authoring

1. **[backend]** `lib/engine/`: implement §5.1–5.7 as pure functions; `todayLocal` computed in a small `lib/dates.ts` (tz validation + server-clock date-in-zone).
2. **[backend]** Engine unit tests per §5.8 — written same day as the engine, while the math is fresh.
3. **[backend]** Zod schemas (`lib/validations.ts`) for every contract in §6, including the `QuestionInput` discriminated union.
4. **[backend + frontend]** Content CRUD routes + structure-builder UI (goal → modules → topics) and manual question editor. Manual path first — it's the fallback everything else leans on.

### Day 3 — Study loop + AI

1. **[backend + frontend]** `POST /api/attempts` with idempotent insert; quiz session UI (MCQ select, flashcard reveal + self-mark), UUID generated at answer time.
2. **[backend + frontend]** Today view and dashboard routes + screens (readiness bars, regime banner).
3. **[backend]** AI adapter: Gemini client, JSON-schema prompts, Zod gates, retry-then-503; `POST /api/ai/structure`, `POST /api/ai/questions`, PDF text extraction route.
4. **[frontend]** Draft-review UI for both AI touchpoints: editable drafts in client state → confirm → `POST /api/questions/batch` (the same endpoint manual authoring uses — the gate made visible).

### Day 4 — Recalibration, polish, submission

1. **[backend + frontend]** Recalibrate proposal + plan confirmation (`PUT …/plan` transaction); triage screen with kept/deferred split and readiness shown for both.
2. **[frontend]** PostHog: client init + server captures per the SPEC measurement plan.
3. **[frontend]** SEO (rubric ~10%): public landing page (static, keyword-researched copy from the case study), `metadata` exports, OpenGraph tags, `sitemap.xml`, `robots.txt`, semantic headings.
4. **[infra]** Production env vars audit; rate limiting on auth + AI routes; reseed demo data; full click-through of every §8 failure path (including pulling the Gemini key to verify the two-buttons-break claim).
5. **[docs]** README (setup, architecture summary linking DECISION_LOG, demo credentials), demo video, case study final pass, submit.

**If time runs short**, cut from the end of day 4 backwards — but steps 16–18 are rubric-scored, so protect them by trimming UI polish in steps 11/14 instead. Notes UI (`Note` model) is the designated first cut; the schema keeps the table either way.

---

## 10. Open Questions

- **Flashcard grading granularity** — binary (recalled / not) vs. a 4-grade scale (again/hard/good/easy). v1 ships **binary**: it keeps `Outcome` uniform across question types and the strength formula unchanged; the 4-grade scale is a roadmap refinement of §5.2. Flagged because it's the one place the schema would grow (`grade Int?`) if reversed later.
- **Rate-limit store** — in-memory per-instance limiting is trivially bypassable across serverless instances but is likely sufficient for a trial; Upstash Redis is the production answer. Decide at step 17 based on remaining time; not architectural either way.
- **Notes in v1 UI** — table exists, UI is the designated cut (step 18 note). Decide on day 4 morning.