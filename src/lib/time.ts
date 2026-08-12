/**
 * Day boundaries, in the timezone the business actually runs in.
 *
 * The server runs in UTC. `new Date().setHours(0, 0, 0, 0)` therefore produces
 * UTC midnight — 03:00 in Baghdad — so between 00:00 and 03:00 local time every
 * "today" figure was still counting yesterday: KPI counters, the appointment
 * calendar, the task list and the daily reports all disagreed with the wall
 * clock of the people reading them.
 *
 * This was fixed once, inside the KPI route, and the same `setHours(0,0,0,0)`
 * stayed in five other endpoints. It lives here now so there is one definition
 * to be right.
 *
 * Client-side date pickers deliberately do NOT use this: in a browser, local
 * time already IS the user's time.
 */

/** Iraq is UTC+3 all year — it has not observed DST since 2008. */
export const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Midnight in Baghdad, as the UTC instant to compare timestamps against. */
export function startOfBaghdadDay(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + BAGHDAD_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - BAGHDAD_OFFSET_MS);
}

/** The start of the day `days` before (or after, if negative) today. */
export function startOfBaghdadDayOffset(days: number, at: Date = new Date()): Date {
  return new Date(startOfBaghdadDay(at).getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * The Baghdad calendar date as "YYYY-MM-DD".
 *
 * NOT `startOfBaghdadDay(d).toISOString().slice(0, 10)` — that instant is
 * 21:00 UTC on the PREVIOUS day, so serializing it back yields a date one day
 * early. Use this whenever a day is a label rather than a comparison bound.
 */
export function baghdadDayKey(at: Date): string {
  return new Date(at.getTime() + BAGHDAD_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight in Baghdad on the 1st of the current month. */
export function startOfBaghdadMonth(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + BAGHDAD_OFFSET_MS);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - BAGHDAD_OFFSET_MS);
}
