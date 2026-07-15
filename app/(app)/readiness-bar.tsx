import { READINESS_THRESHOLD } from "@/lib/engine/constants";
import { readyFill, notReadyFill } from "@/app/ui";

/** Shared by the dashboard readiness lists and the step-14 triage review
 *  (which renders bars for BOTH the kept and deferred sets). */

export const percent = (x: number) => `${Math.round(x * 100)}%`;

/** 0–1 readiness as a bar with a tick at READINESS_THRESHOLD (0.6): fills
 *  emerald at/above the threshold, amber below it. */
export function ReadinessBar({ value }: { value: number }) {
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
      <div
        className={`h-full rounded-full ${
          value >= READINESS_THRESHOLD ? readyFill : notReadyFill
        }`}
        style={{ width: percent(value) }}
      />
      <div
        className="absolute inset-y-0 w-px bg-slate-400 dark:bg-slate-500"
        style={{ left: percent(READINESS_THRESHOLD) }}
      />
    </div>
  );
}
