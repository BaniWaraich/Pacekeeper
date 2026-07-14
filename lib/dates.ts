import type { LocalDate } from "@/lib/engine/types";

/**
 * lib/dates.ts — the timezone boundary the engine refuses to cross (§5,
 * invariant #7). The API layer resolves the client's IANA zone and computes
 * calendar dates here, then hands the engine plain `YYYY-MM-DD` strings; the
 * engine never reads the clock or converts zones. First used by
 * POST /api/attempts (step 10); reused by the Today/dashboard reads (step 11).
 */

/** The runtime's IANA database, cached — `Intl.supportedValuesOf` builds a
 *  ~600-entry array on each call, so materialise it once. */
let knownZones: Set<string> | null = null;
function zones(): Set<string> {
  if (!knownZones) knownZones = new Set(Intl.supportedValuesOf("timeZone"));
  return knownZones;
}

/**
 * Validate a client-supplied `tz` against the runtime's IANA database — the
 * "real validation" the `ianaTimezoneSchema` placeholder (lib/validations.ts)
 * defers out of the schema layer (§6 convention). Returns the zone, or `null`
 * for empty/unknown input; callers return 400.
 */
export function resolveTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  return zones().has(tz) ? tz : null;
}

/** `en-CA` renders as `YYYY-MM-DD` — a stable ISO calendar date. */
function localDateFormatter(tz: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** A UTC instant → the calendar day it falls on in `tz`. Maps a stored
 *  `attemptedAt` to the engine's `attemptedOnLocal`. */
export function instantToLocalDate(instant: Date, tz: string): LocalDate {
  return localDateFormatter(tz).format(instant);
}

/** Today's calendar day in `tz`, read from the server clock (§3.1) — the only
 *  place the current instant enters a date computation. */
export function todayLocalInZone(tz: string, now: Date = new Date()): LocalDate {
  return instantToLocalDate(now, tz);
}
