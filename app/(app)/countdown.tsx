import { displayText } from "@/app/ui";

/** Time pressure from engine numbers only — no date math here. `daysUsable`
 *  comes from planProgress (planned goals); unplanned goals show the exam
 *  date alone. 0 renders honestly as "0 usable days left". */
export function Countdown({
  daysUsable,
  examDate,
  className,
}: {
  daysUsable?: number;
  examDate: string;
  className?: string;
}) {
  return (
    <p
      className={["flex shrink-0 items-baseline gap-1.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {daysUsable !== undefined && (
        <>
          <span
            className={`${displayText} text-2xl leading-none text-slate-900 dark:text-slate-50`}
          >
            {daysUsable}
          </span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            usable {daysUsable === 1 ? "day" : "days"} left
          </span>
          <span aria-hidden className="text-slate-300 dark:text-slate-600">
            ·
          </span>
        </>
      )}
      <span className="text-xs text-slate-500 dark:text-slate-400">
        exam {examDate}
      </span>
    </p>
  );
}
