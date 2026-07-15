---
name: pacekeeper-design-system
description: The Momentum design language for PaceKeeper — colors, type, motion, voice, components, accessibility. Use when styling, building, or reviewing any PaceKeeper UI so every screen speaks the same language.
---

# PaceKeeper Design System — "Momentum"

PaceKeeper answers one question: **"will I be ready by the date that matters?"**
Momentum is the design language that makes chasing that answer feel good —
energetic when you're moving, celebratory when you win, calm and honest when
you slip. Grown-up, never childish.

## Principles

1. **Momentum toward readiness is the game mechanic.** Progress is real engine
   output (readiness, pace, regime) — never arbitrary points, XP, or streaks.
   Those need persisted state and are roadmap, not this language.
2. **Celebrate wins, be honest about slips.** A correct answer or a mastered
   topic earns energy; a SLIPPING or TRIAGE regime earns calm, numeric truth —
   never softened, never shaming.
3. **Grown-up, never childish.** No confetti, no mascots, no emoji in UI copy.
   Energy comes from motion and one gradient, not decoration.
4. **The engine is the source of truth.** The UI reads engine output
   (`lib/engine-io.ts` wire types) verbatim; it never recomputes readiness,
   pace, or regime (AGENTS.md invariant).
5. **One hero metric per screen.** The most important number (usually
   readiness) is obviously the most prominent element.

## Vocabulary

Goal → Module → Topic → Question → Attempt.

Regimes: `ON_PACE` / `SLIPPING` / `TRIAGE`, mapped 1:1 by `REGIME_TONE` in
`app/ui.tsx` (positive / warn / danger). Never invent synonyms — no "subject",
"exam mode", "streak", "level".

## Color

Everything comes from `app/ui.tsx` tokens and the `@theme` block in
`app/globals.css`. Never restate hex values or Tailwind color classes inline.

```
Neutrals        slate scale (existing) — surfaces white/slate-900, page white/slate-950
Accent          indigo-600 #4f46e5 (--color-accent, focusRing)
Brand gradient  #4f46e5 (indigo-600) → #7c3aed (violet-600), left→right
                dark: indigo-500 → violet-500
Ready           emerald-500 #10b981 (readyFill / TONE.positive)
At-risk         amber-500 #f59e0b (notReadyFill / TONE.warn)
Danger          red (TONE.danger)
Glow            --shadow-glow-sm / --shadow-glow / --shadow-glow-dark (indigo-tinted, subtle)
```

Gradient rationale: both stops keep white text ≥ ~4.9:1 (AA at 14px medium).
indigo-500 as a *from* stop was rejected at ~4.6:1. **Do not brighten the
stops** — hover energy comes from glow + `brightness-105`, never lighter color.

Rules:

- Exactly **one** gradient in the system (the brand gradient). It appears on
  the primary CTA (`btnPrimary`), the In-progress rail on illustrative module
  rows (landing page), the session progress bar (the momentum meter of the
  core loop), and hero moments — nowhere else.
- Regime/status colors come only from `readyFill` / `notReadyFill` / `TONE` /
  `REGIME_TONE`.
- **Status is never conveyed by color alone.** Always pair with a number, an
  icon, or a label.
- Every new class ships with its `dark:` variant in the same change.

## Typography

- **Space Grotesk** (`font-display`, `--font-display`) — display only: page
  titles, the readiness percent, big numbers, countdowns.
- **Inter** (`font-sans`, default) — everything else. Never Space Grotesk for
  paragraphs or form controls.

```
display-xl   text-4xl/10  font-display font-semibold tracking-tight   hero numbers
display      text-2xl/8   font-display font-semibold tracking-tight   PageHeader h1
heading      text-lg/7    font-semibold                               card titles
body         text-sm/5    (default)                                   prose, controls
caption      text-xs/4    text-slate-500 dark:text-slate-400          metadata
micro        text-[10px]  font-semibold uppercase tracking-wide       Badge
```

Use the `displayText` token from `app/ui.tsx` (`font-display font-semibold
tracking-tight`) rather than retyping the classes.

## Motion

All motion tokens live in `app/globals.css` `@theme`. Never hand-write
durations or easings inline.

```
Durations   micro 150ms (hover/focus) · standard 250ms (select/pop)
            enter 350ms (rise-in) · sweep 800ms (ring fill) · celebrate 1200ms (pulse-glow)
Easings     --ease-momentum: cubic-bezier(0.22, 1, 0.36, 1)   fast-out, settles — the signature
            --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1) slight overshoot — selects/wins only
Utilities   animate-ring-sweep · animate-pop · animate-pulse-glow · animate-rise-in
```

Rules:

1. Animations run **once**, on mount or a state change — never infinite loops.
   Skeleton's `animate-pulse` is the sole exception.
2. Celebrate only genuine wins: a correct answer, a topic crossing the
   readiness threshold, a regime improving. Never animate a loss.
3. **Every animation ships with its reduced-motion fallback in the same
   commit.** All keyframes use fill-mode `both`, so the global
   `prefers-reduced-motion` kill-switch in `globals.css` renders end states
   instantly. Anything purely decorative additionally uses `motion-safe:`.
4. The overshoot easing (`--ease-spring`) is reserved for option-select and
   win moments; ambient motion uses `--ease-momentum`.

## Voice

Numbers over adjectives. The engine's numbers are quoted verbatim. Canonical
per-regime register (lifted from the shipped dashboard copy):

- **ON_PACE — celebratory, factual:**
  *"On pace. 12 of 20 topics introduced · 9 usable days left. Keep this rhythm
  and everything is covered before the exam."*
- **SLIPPING — calm, numeric, actionable:**
  *"Falling behind. Covering the remaining 8 topics now takes 2.1/day, up from
  the planned 1.5/day. Review the recalibrated plan →"*
- **TRIAGE — honest, never softened:**
  *"Full coverage is no longer realistic. At your cap of 2 new topics/day,
  only 6 of the 10 topics not yet ready fit before the exam. 4 topics are at
  risk — listed below, weakest first."*

Rules:

- At most one exclamation point per screen, and only at a genuine win.
- No shame language ("you failed", "too late") and no toddler language
  ("oopsie", "awesome job!").
- Deferred / at-risk lists are always shown, never hidden or minimized.
- Buttons say what happens: "Start today's session", not "Let's go!".

## Components

Build each once, reuse everywhere. Extend `app/ui.tsx` when something is
missing — never install a component library, never create `components/ui/`.

**Class tokens** (`app/ui.tsx`): `btnPrimary` (gradient CTA — exactly one per
view), `btnSecondary`, `btnDestructive`, `btnBase`, `actionClass`,
`inputClass`, `cardClass` (rounded-2xl), `pageClass`, `linkClass`,
`mutedText`, `displayText`, `focusRing`, `TONE`, `REGIME_TONE`,
`readyFill` / `notReadyFill`.

**`ReadinessRing`** (`app/readiness-ring.tsx`) — the readiness hero. SVG ring,
`value` is the engine's 0–1 float, colored emerald at/above
`READINESS_THRESHOLD` (0.6), amber below — same semantics as
`readyFill`/`notReadyFill`. Sizes: `hero` (dashboard/landing) and `inline`
(lists). Center percent label is the non-color signal; `role="meter"` +
`aria-valuenow`. CSS-only sweep on mount (`animate-ring-sweep`).
`ReadinessBar` remains for thin in-list bars until each screen's pass swaps it.

**`RegimeBadge`** (`app/ui.tsx`) — the only way to render a regime as a chip.
Icon + label + tone via `REGIME_TONE`; labels "On pace" / "Slipping" /
"Triage". Never render a regime by color alone or with ad-hoc markup.

**`ModuleCard`** (`app/(app)/module-card.tsx`) — the module container on
readiness lists (dashboard, today): module title (h3) + one row per topic —
inline `ReadinessRing` (`animate={false}`), topic title, state chip, and a
quiz link (≥44px target). **Four topic states**, derived presentation-side
via the exported `deriveTopicState` — never per-screen forks:

| State | Derivation (precedence order) | Treatment |
|---|---|---|
| At risk | topic in TRIAGE `deferred` (wins over all others) | `TONE.danger` chip, circled-! glyph, label "At risk" |
| Upcoming | `!introduced` | dimmed slate chip (text stays AA), lock glyph, label "Upcoming" |
| Building | `introduced && notYetReady` | `TONE.warn` chip, clock glyph, label "Building" |
| Strong | `introduced && !notYetReady` | `TONE.positive` chip, check glyph, one-time `motion-safe:animate-pop` on mount — the win state |

State is **derived from existing engine fields** (`introduced`,
`notYetReady`, TRIAGE `deferred` membership) — never new persisted state,
never recomputed thresholds. Chips are non-interactive: icon + label + tone,
never color alone.

**`Countdown`** (`app/(app)/countdown.tsx`) — engine numbers only, no date
math: `planProgress.daysUsable` as a `displayText` number ("N usable days
left") + `examDate` verbatim; unplanned goals render the exam date alone.

**MCQ options** (spec — built during the session pass): options are
`<button>`s ≥44px tall (`min-h-11`); selected = indigo border +
`animate-pop`; correct = emerald border + check icon + "Correct" label;
incorrect = red border + x icon + "Incorrect" label. Result never by color
alone. Question content renders as **text only** — no
`dangerouslySetInnerHTML` (AGENTS.md invariant).

## Accessibility

Non-negotiable, same commit as the feature:

- Status never by color alone: icon + label + tone, or number + tone.
- `focusRing` on every interactive element; tab order sensible.
- Hit targets ≥44px (`min-h-11` on buttons and options).
- AA contrast in **both** themes, including both gradient stops.
- Meters expose `role="meter"` + `aria-valuemin/max/now` (or sr-only text).
- Reduced-motion fallback for every animation (see Motion rule 3).

## Do / Don't

| Do | Don't |
|---|---|
| One hero metric per screen | Confetti, mascots, emoji in UI copy |
| Engine numbers verbatim | Streaks, XP, points (needs migration — roadmap) |
| One brand gradient, via tokens | A second gradient, or inline hex values |
| Animate once, with reduced-motion fallback | Infinite/looping animation |
| Show deferred/at-risk lists plainly | Hide or soften bad news |
| `dark:` variant on every new class | Light-only styling |
| Extend `app/ui.tsx` | shadcn / component libraries / `components/ui/` |
