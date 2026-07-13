/**
 * Calendar-day arithmetic on LocalDate (`YYYY-MM-DD`) strings.
 *
 * Deterministic by construction: dates are built from their components via
 * Date.UTC — the process clock is never read (no zero-argument `new Date()`,
 * no `Date.now()`; invariant 2).
 */
import type { LocalDate } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days since the Unix epoch for a LocalDate. */
export function epochDay(date: LocalDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** Whole days from `from` to `to`; positive when `to` is later. */
export function dayDiff(from: LocalDate, to: LocalDate): number {
  return epochDay(to) - epochDay(from);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return new Date((epochDay(date) + days) * DAY_MS).toISOString().slice(0, 10);
}
