# PaceKeeper

Set a goal and a date. PaceKeeper builds your study plan, quizzes you daily, and tells you the truth about whether you're on track.

**Live demo:** https://pacekeeper-livid.vercel.app (see [Demo account](#demo-account) below) · **Demo video:** https://youtu.be/NmbrHCnf6kc

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
pnpm db:seed        # optional: seeds the demo account with realistic mid-plan data

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
| `pnpm db:seed` | Reset and reseed the demo account |
| `pnpm db:studio` | Prisma Studio |

## Documentation

- [Product spec](docs/SPEC.md) — problem, user, scope, flows
- [Technical design](docs/pacekeeper-technical-design.md) — schema, engine algorithms, API contracts, day plan
- [AGENTS.md](AGENTS.md) — architecture invariants and conventions

## Demo account

Log in at https://pacekeeper-livid.vercel.app with:

- **Email:** `demo@pacekeeper.dev`
- **Password:** `pacekeeper-demo`

The account is seeded mid-plan with a goal, modules, topics, and quiz history, so the dashboard, Today view, and pace tracking are all populated. Running `pnpm db:seed` resets it to this state (dates in the fixtures are relative to "today", so the plan always looks current).
