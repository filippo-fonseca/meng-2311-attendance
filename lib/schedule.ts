// lib/schedule.ts
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { PASSWORDS } from "./passwords";

dayjs.extend(utc);
dayjs.extend(timezone);

export const TZ = "America/New_York";
export const PROFESSOR_EMAIL = "omer.subasi@yale.edu";

// 🔧 Adjust these for your term
export const TERM_START = "2025-09-01"; // yyyy-mm-dd, local to New York
export const TERM_END   = "2025-12-15";

// Monday/Wednesday/Friday in dayjs().day(): 1,3,5 (0=Sun)
const CLASS_DOW = new Set([1, 3, 5]);

export function inNY(d?: string | Dayjs) {
  return (typeof d === "string" ? dayjs.tz(d, TZ) : (d ?? dayjs())).tz(TZ);
}

export function isClassDay(d: Dayjs) {
  return CLASS_DOW.has(d.tz(TZ).day());
}

export function classDatesBetween(startISO = TERM_START, endISO = TERM_END): Dayjs[] {
  let d = inNY(startISO).startOf("day");
  const end = inNY(endISO).endOf("day");
  const out: Dayjs[] = [];
  while (d.isBefore(end)) {
    if (isClassDay(d)) out.push(d);
    d = d.add(1, "day");
  }
  return out;
}

// 10:30–12:00 local window for the given date
export function windowForDate(d: Dayjs) {
    const start = d.tz(TZ).hour(10).minute(30).second(0).millisecond(0);
    // was .hour(12)
    const cutoff = d.tz(TZ).hour(14).minute(0).second(0).millisecond(0);
    return { start, cutoff };
  }
  

export function isWithinWindowNow(d: Dayjs, now = dayjs().tz(TZ)) {
  const { start, cutoff } = windowForDate(d);
  return now.isAfter(start) && now.isBefore(cutoff);
}

export function dateKey(d: Dayjs) {
  return d.tz(TZ).format("YYYY-MM-DD");
}

// Count 0-based index of class day since TERM_START (inclusive)
export function lectureIndexForDate(d: Dayjs) {
  const all = classDatesBetween(TERM_START, dateKey(d));
  // all includes d if it’s class day
  const idx = all.findIndex(x => x.format("YYYY-MM-DD") === d.format("YYYY-MM-DD"));
  return idx;
}

export function passwordForDate(d: Dayjs) {
  const idx = lectureIndexForDate(d);
  if (idx < 0) return null; // not a class day
  return PASSWORDS[idx % PASSWORDS.length];
}
