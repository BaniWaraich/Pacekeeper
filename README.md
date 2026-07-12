# PaceKeeper

Set a goal and a date. PaceKeeper builds your study plan, quizzes you daily, and tells you the truth about whether you're on track.

A deadline-aware spaced-repetition study tool: goals → modules → topics → questions (MCQs + flashcards), a daily Today view driven by a deterministic scheduling engine, and honest pace tracking with slip recalibration and triage.

## Stack

Next.js (App Router, TypeScript strict, Tailwind) · Prisma · Neon Postgres · Auth.js (credentials, JWT) · Gemini (draft-only AI adapter) · PostHog · Vercel

## Getting started

```bash
# Node 22 (see .nvmrc)
pnpm install

# Configure environment
cp .env.example .env   # then fill in DATABASE_URL (Neon pooled), AUTH_SECRET, etc.

# Database
pnpm db:migrate

# Run
pnpm dev
```

The app is fully usable without a `GEMINI_API_KEY` — AI features degrade to the manual path.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm test` | Engine unit tests (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Prisma migrations |
| `pnpm db:studio` | Prisma Studio |

## Documentation

- [Product spec](docs/SPEC.md) — problem, user, scope, flows
- [Technical design](docs/pacekeeper-technical-design.md) — schema, engine algorithms, API contracts, day plan
- [AGENTS.md](AGENTS.md) — architecture invariants and conventions

## Demo account

_Seeded demo credentials will be added before submission._
