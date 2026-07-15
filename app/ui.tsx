/**
 * Shared presentational design system for PaceKeeper.
 *
 * Presentation only — no hooks, no data fetching, no event-handler *logic*.
 * Interactive components (ErrorState) merely forward a callback the caller
 * already owns; they never define one. Class constants are the single source
 * of truth for the button hierarchy, cards, inputs, and the regime/alert tones,
 * replacing the ad-hoc per-page classes that existed before this pass.
 *
 * Palette: slate (neutral) + indigo (accent). Regime tones: emerald / amber /
 * red, kept semantic and defined once here.
 */
import type { ReactNode } from "react";
import type { PaceRegime } from "@/lib/engine/types";

const cx = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- tokens */

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950";

export const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none " +
  focusRing;

// Hover brightens via glow + brightness, never lighter stops — the gradient's
// AA contrast with white text holds only at these stops or darker.
export const btnPrimary = cx(
  btnBase,
  "bg-gradient-to-r from-momentum-from to-momentum-to text-white shadow-glow-sm hover:shadow-glow hover:brightness-105",
  "dark:from-indigo-500 dark:to-violet-500 dark:shadow-glow-dark",
);

export const btnSecondary = cx(
  btnBase,
  "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
);

export const btnDestructive = cx(
  btnBase,
  "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950",
);

/** Small inline text action (Edit / Archive / ↑ ↓ / Rename). */
export const actionClass = cx(
  "text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none dark:text-slate-400 dark:hover:text-slate-100",
  "focus-visible:outline-none focus-visible:underline",
);

// No width utility here: inputs live in flex-col containers and stretch via
// align-items:stretch, and some call sites override width (e.g. `w-20`).
export const inputClass = cx(
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors",
  "focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500",
);

export const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

export const pageClass =
  "mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-10";

export const linkClass =
  "font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400";

export const mutedText = "text-slate-500 dark:text-slate-400";

/** Display type (Space Grotesk): page titles, hero numbers, countdowns. */
export const displayText = "font-display font-semibold tracking-tight";

/* ------------------------------------------------------------- alert tones */

export type Tone = "neutral" | "positive" | "warn" | "danger";

/** Border + surface + text for toned blocks (banners, alerts, callouts). */
export const TONE: Record<Tone, string> = {
  neutral:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
  positive:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  danger:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
};

/** Regime → semantic tone. Signature colors, defined exactly once. */
export const REGIME_TONE: Record<"ON_PACE" | "SLIPPING" | "TRIAGE", Tone> = {
  ON_PACE: "positive",
  SLIPPING: "warn",
  TRIAGE: "danger",
};

/** Readiness-bar fills (threshold decision stays in the caller). */
export const readyFill = "bg-emerald-500";
export const notReadyFill = "bg-amber-500";

/* ------------------------------------------------------------- components */

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "li";
}) {
  return <Tag className={cx(cardClass, "p-5", className)}>{children}</Tag>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <h1
          className={cx(
            displayText,
            "text-2xl text-slate-900 dark:text-slate-50",
          )}
        >
          {title}
        </h1>
        {action}
      </div>
      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      )}
    </header>
  );
}

export function EmptyState({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700",
        className,
      )}
    >
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
        {title}
      </p>
      {children && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {children}
        </div>
      )}
    </div>
  );
}

export function Alert({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border px-4 py-3 text-sm",
        TONE[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Danger alert with a Retry button. `onRetry` is the caller's own callback. */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  message: ReactNode;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <Alert tone="danger" className="flex flex-col items-start gap-3">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cx(
          btnBase,
          "border border-red-300 bg-white/60 text-red-900 hover:bg-white dark:border-red-800 dark:bg-transparent dark:text-red-100 dark:hover:bg-red-950",
        )}
      >
        {retryLabel}
      </button>
    </Alert>
  );
}

export function Skeleton({
  rows = 3,
  height = "h-16",
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cx(
            height,
            "animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900",
          )}
        />
      ))}
    </div>
  );
}

/** Icon + label + tone — never color alone. The only way to chip a regime. */
const REGIME_BADGE: Record<PaceRegime, { label: string; path: ReactNode }> = {
  ON_PACE: {
    label: "On pace",
    // trending-up
    path: <path d="M2 11l4-4 3 3 5-6M10 4h4v4" />,
  },
  SLIPPING: {
    label: "Slipping",
    // downward drift
    path: <path d="M2 5l4 4 3-3 5 6M10 12h4V8" />,
  },
  TRIAGE: {
    label: "Triage",
    // alert triangle
    path: <path d="M8 2L1 14h14L8 2zm0 5v3m0 2v.5" />,
  },
};

export function RegimeBadge({
  regime,
  className,
}: {
  regime: PaceRegime;
  className?: string;
}) {
  const { label, path } = REGIME_BADGE[regime];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        TONE[REGIME_TONE[regime]],
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {path}
      </svg>
      {label}
    </span>
  );
}

export type BadgeTone = "accent" | "neutral" | "outline";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  const tones: Record<BadgeTone, string> = {
    accent: "bg-indigo-600 text-white",
    neutral:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    outline:
      "border border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
