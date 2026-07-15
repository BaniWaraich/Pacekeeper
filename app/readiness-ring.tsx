import { READINESS_THRESHOLD } from "@/lib/engine/constants";
import { displayText } from "@/app/ui";

/** 0–1 readiness as a circular meter: emerald at/above READINESS_THRESHOLD
 *  (0.6), amber below — same semantics as ReadinessBar. Lives outside ui.tsx
 *  (like readiness-bar.tsx) so ui.tsx keeps zero runtime engine imports.
 *
 *  Pure SVG + CSS: the mount sweep is the `animate-ring-sweep` keyframe,
 *  which animates from the full circumference (via --ring-circumference) to
 *  the inline stroke-dashoffset; reduced motion renders the end state. */

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 282.74

const SIZES = {
  hero: { box: "h-32 w-32", stroke: 8, percentText: `${displayText} text-3xl` },
  inline: { box: "h-10 w-10", stroke: 6, percentText: "text-[10px] font-semibold" },
} as const;

export function ReadinessRing({
  value,
  size = "inline",
  label = "Readiness",
  animate = true,
  className,
}: {
  value: number;
  size?: "hero" | "inline";
  label?: string;
  animate?: boolean;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const s = SIZES[size];
  const ready = clamped >= READINESS_THRESHOLD;

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
      className={[
        "relative inline-flex shrink-0 items-center justify-center",
        s.box,
        ready
          ? "text-emerald-500 dark:text-emerald-400"
          : "text-amber-500 dark:text-amber-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={s.stroke}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          className={animate ? "animate-ring-sweep" : undefined}
          style={
            animate
              ? ({ "--ring-circumference": CIRCUMFERENCE } as React.CSSProperties)
              : undefined
          }
        />
      </svg>
      <span
        className={`absolute ${s.percentText} text-slate-900 dark:text-slate-50`}
      >
        {Math.round(clamped * 100)}%
      </span>
    </div>
  );
}
