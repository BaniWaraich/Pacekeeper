---
name: ui-refactor-workflow
description: The screen-by-screen refactor process for PaceKeeper's Momentum UI pass. Use when restyling any screen or reviewing a UI PR — defines the pass order, the Pass-0 inventory, definition of done, and commit discipline.
---

# UI Refactor Workflow

How every screen gets the Momentum treatment (see
`pacekeeper-design-system` for the language itself). One screen at a time,
passes in order, one logical pass per commit.

## Ground rules

- **Presentation only.** Never touch `lib/engine/`, the Prisma schema, Zod
  validation (`lib/validations.ts`), the AI adapter, auth, or routing
  behavior. Markup, styling, motion, and copy only. If a change needs logic
  or a migration, stop and flag it as a separate task.
- **No new persisted state.** Gamification dresses up data the app already
  computes. No streaks, XP, or points.
- The UI reads engine output (`lib/engine-io.ts`); it never recomputes it.
  Question content renders as text only (AGENTS.md invariants).
- **Extend `app/ui.tsx`** — no shadcn, no `components/ui/`, no component
  library installs. Tailwind v4 CSS-first: tokens live in the `@theme` blocks
  of `app/globals.css`; there is no tailwind.config.
- `app/ui.tsx` exports keep their **names and signatures** (visual
  class-string changes are fine; API breaks are not — ~20 files import them).
- Every new class gets a `dark:` variant; every animation ships its
  `prefers-reduced-motion` fallback in the same commit.

## Pass order

Work each screen through these passes, in order. Small screens may collapse
adjacent passes into one commit, but never reorder them.

1. **Structure** — semantic landmarks, heading hierarchy, layout skeleton. No styling.
2. **Tokens** — swap ad-hoc classes for `app/ui.tsx` tokens; kill inline duplicates.
3. **Type** — apply the scale; `displayText`/`font-display` on display text only.
4. **Components** — replace bespoke markup with the shared components
   (ReadinessRing, RegimeBadge, ModuleCard, MCQ…). Build a missing one once, in the foundation files.
5. **Gamified moments** — find the win/slip moments on this screen; apply the
   celebratory or calm-honest treatment per the design system.
6. **Motion** — mount/state-change animations from the motion vocabulary +
   reduced-motion verified.
7. **States** — loading / empty / error via `Skeleton` / `EmptyState` /
   `ErrorState`, branded copy.
8. **Voice** — copy matches the per-regime voice rules.
9. **Responsive + a11y sweep** — 390px/1280px, tab-through, hit targets, contrast.

## Pass 0: screen inventory

Fill this out before touching a screen; paste it into the plan/PR.

```markdown
## Pass-0 inventory — <screen>
- Route: <path> (<file>)
- Engine data displayed: <fields from lib/engine-io.ts>
- Components/tokens currently used: <list; note hand-rolled styles>
- States present: loading / empty / error / per-regime branches
- Interactive elements: <list + current hit-target sizes>
- Current issues: <what looks wireframe-y, a11y gaps, copy drift>
- Planned change per pass: 1… 2… 3…
```

## Definition of done (per screen)

- `npm run build` passes.
- Screenshots at **390px and 1280px**, light **and** dark — and you looked at
  them. The most important element is obviously the most prominent; readiness
  is visible without scrolling.
- Reduced-motion verified (DevTools → Rendering → emulate
  `prefers-reduced-motion: reduce`): end states render, nothing loops.
- Tab-through: every interactive element shows `focusRing`, in a sensible order.
- Shared components match the screens already refactored — no per-screen forks.
- Copy matches the Voice section of the design system.
- Energetic and grown-up — if it drifts childish, pull it back.

## Commit discipline

- Conventional commits, scope `ui`, **one logical pass per commit** so diffs
  review cleanly. Examples:
  - `feat(ui): momentum tokens + gradient CTA`
  - `refactor(ui): today screen structure pass`
  - `feat(ui): dashboard readiness ring + regime badge`
- Work on a `feat/ui-*` branch; the user squash-merges the PR themself, so
  keep each PR small enough that its title still describes one logical change.
- Screenshot at each merge, paired with a click-through before merging.

## When a screen needs a new token or component

Never invent per-screen values. Add the token to `app/globals.css` /
`app/ui.tsx` **and** to `pacekeeper-design-system` first, in its own commit,
then use it in the screen pass. If two screens want different values for the
same thing, the design system decides — not the screens.
