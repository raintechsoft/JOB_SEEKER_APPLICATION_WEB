import contract from "../../../contracts/validation/activity-calendar.json";

/** Calendar policy shared with Laravel: one zone for every viewer, Monday-first weeks, central thresholds. */
export const activityCalendarContract = contract;

export type ActivityType = keyof typeof contract.labels;

export interface ActivityDay {
  date: string;
  count: number;
  level: number;
  activities: { type: ActivityType; label: string; count: number }[];
}

export interface ActivityCalendarMonth {
  year: number;
  month: number;
  timezone: string;
  total: number;
  days: ActivityDay[];
  range: { earliest: string; latest: string };
}

export interface Period {
  year: number;
  month: number;
}

export const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" }));
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The calendar month containing `now` in the policy time zone, independent of the browser's zone. */
export function currentPeriod(now = new Date()): Period {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: contract.timezone, year: "numeric", month: "numeric" }).formatToParts(now);
  return { year: Number(parts.find((p) => p.type === "year")!.value), month: Number(parts.find((p) => p.type === "month")!.value) };
}

export const periodKey = ({ year, month }: Period) => `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;

export function shiftPeriod({ year, month }: Period, delta: number): Period {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** A period from URL parameters, or null when absent or invalid (the caller falls back to the current month). */
export function parsePeriod(month: string | null, year: string | null, latest: Period): Period | null {
  if (!month || !year || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const period = { year: Number(year), month: Number(month) };
  if (period.month < 1 || period.month > 12 || period.year < contract.minYear) return null;
  return periodKey(period) > periodKey(latest) ? null : period;
}

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 0 = Monday … 6 = Sunday for a YYYY-MM-DD date, computed in UTC so no local offset can shift the day. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const isoDate = (year: number, month: number, day: number) => `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Monday-first weeks for the month: each row has seven slots, a date string or null for padding.
 * Rows are only as many as the month needs (four to six).
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = weekdayIndex(isoDate(year, month, 1));
  const length = daysInMonth(year, month);
  const slots: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length }, (_, i) => isoDate(year, month, i + 1))];
  while (slots.length % 7) slots.push(null);
  return Array.from({ length: slots.length / 7 }, (_, row) => slots.slice(row * 7, row * 7 + 7));
}

/** Same policy as Laravel's ActivityCalendarService::level. */
export function activityLevel(count: number): number {
  return contract.levelThresholds.filter((minimum) => count >= minimum).length;
}

/** Legend text for each level, derived from the thresholds. */
export function levelRanges(): string[] {
  const t = contract.levelThresholds;
  return ["No activity", ...t.map((min, i) => (i + 1 < t.length ? (t[i + 1] - 1 === min ? `${min}` : `${min}–${t[i + 1] - 1}`) : `${min}+`) + " activities")];
}

export function formatCalendarDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

export function daySummary(day: ActivityDay): string {
  if (!day.count) return `${formatCalendarDate(day.date)}: No activity`;
  return `${formatCalendarDate(day.date)}: ${day.count} ${day.count === 1 ? "activity" : "activities"} (${day.activities.map((a) => `${a.label}: ${a.count}`).join(", ")})`;
}
