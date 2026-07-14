import { READINESS_THRESHOLD } from "@/lib/engine/constants";

/** Shared by the dashboard readiness lists and the step-14 triage review
 *  (which renders bars for BOTH the kept and deferred sets). */

export const percent = (x: number) => `${Math.round(x * 100)}%`;

/** 0–1 readiness as a bar with a tick at READINESS_THRESHOLD (0.6): fills
 *  emerald at/above the threshold, amber below it. */
export function ReadinessBar({ value }: { value: number }) {
  return (
    <div className="relative h-2 w-full rounded bg-zinc-200 dark:bg-zinc-800">
      <div
        className={`h-full rounded ${
          value >= READINESS_THRESHOLD ? "bg-emerald-500" : "bg-amber-500"
        }`}
        style={{ width: percent(value) }}
      />
      <div
        className="absolute inset-y-0 w-px bg-zinc-500 dark:bg-zinc-400"
        style={{ left: percent(READINESS_THRESHOLD) }}
      />
    </div>
  );
}
