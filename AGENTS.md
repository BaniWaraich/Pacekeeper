# PaceKeeper

Deadline-aware spaced-repetition study tool. Internship trial, ships July 15.

## Read before large tasks
- docs/SPEC.md — product spec
- docs/pacekeeper-technical-design.md — schema, engine algorithms, API contracts, day plan

## Stack
Next.js App Router + TypeScript (strict) + Tailwind · Prisma · Neon Postgres (pooled URL) ·
Auth.js (credentials, JWT) · Gemini (adapter only) · PostHog · Vercel

## Architecture invariants — never violate these
1. `attempts` is append-only. Never update or delete attempt rows.
2. The engine (`lib/engine/`) is pure functions, zero I/O. No Prisma imports,
   no `new Date()` — today's date is always a parameter.
3. Strength/readiness/pace are computed on read, never stored.
4. AI output never writes to the DB. Gemini responses are Zod-validated
   (reject, don't repair), returned as drafts; writes happen only through
   the normal CRUD endpoints after user confirmation.
5. No hard deletes of content — set `archivedAt`. Attempt→Question is
   onDelete: Restrict on purpose; if it fires, the code is wrong, not the constraint.
6. Every API handler: session check → Zod validation → all queries scoped
   by session userId. Cross-tenant access returns 404.
7. Reads involving dates take `?tz=` (IANA); server computes todayLocal.
8. MCQ grading is server-side against the stored payload. Never trust a
   client-sent outcome.
9. Render question content as text only. No dangerouslySetInnerHTML.

## Conventions
- Zod schemas in lib/validations.ts, mirroring the tech doc §6 contracts exactly.
- Engine changes require matching unit tests in the same commit.
- Small commits, one step of the day plan each.

## Git workflow — every change follows this
- Branch per plan step off main: `type/NN-short-name` where NN is the
  tech doc §9 step (e.g. feat/06-engine-core, fix/10-attempt-clamp).
- main is always deployable. Never commit directly to main.
- Merge via PR, always squash-merge. PR title becomes the main commit
  and MUST be a conventional commit:
    type(scope): imperative description
    types:  feat | fix | test | docs | refactor | chore | perf
    scopes: db | engine | api | auth | ui | ai | seo | infra
- One plan step = one PR. Do not bundle unrelated steps.
- Engine PRs include their unit tests (no separate test-later PRs
  except when adding coverage: then type is `test`).
- PR description: 2 lines — what changed, which invariants it touches.
- Tag at each phase boundary: v0.1-skeleton, v0.2-data-auth,
  v0.3-engine, v0.4-study-loop, v0.5-ai, v1.0-submission.
- Never rewrite history on main. No force-push.
- Before any merge: `npm run build` and engine tests must pass locally.