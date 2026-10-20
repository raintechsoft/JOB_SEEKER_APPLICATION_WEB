import type { IsoDate, IsoDateTime } from "@/types/domain";

export const DAY_MS = 864e5;
export const HOUR_MS = 36e5;

/** Today's calendar date in UTC, matching the prototype (`toISOString().slice(0, 10)`). */
export const today = (): IsoDate => new Date().toISOString().slice(0, 10);

export const dateAgo = (days: number): IsoDate => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

export const hoursAgo = (hours: number): IsoDateTime => new Date(Date.now() - hours * HOUR_MS).toISOString();

const noon = (d: IsoDate) => new Date(d + "T12:00:00");

/** "5 Mar" */
export const formatShortDate = (d: IsoDate) => noon(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** "5 March 2026" */
export const formatLongDate = (d: IsoDate) => noon(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** Month-precision dates used by profile records ("Mar 2026"). */
export function formatMonth(value?: string) {
  if (!value) return "Date not provided";
  return new Date(value.length === 7 ? value + "-01T12:00:00" : value + "T12:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "Just now", "5h ago", "3d ago" — feed timestamps. */
export function timeAgo(value: IsoDateTime) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / HOUR_MS));
  return hours < 1 ? "Just now" : hours < 24 ? hours + "h ago" : Math.floor(hours / 24) + "d ago";
}

/** "Just posted", "5h ago", "3d ago" — job rail timestamps. */
export function postedAgo(value: IsoDateTime) {
  const h = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / HOUR_MS));
  return h < 1 ? "Just posted" : h < 24 ? h + "h ago" : Math.floor(h / 24) + "d ago";
}

export const formatLocaleDate = (value: IsoDateTime) => new Date(value).toLocaleDateString("en-IN");

export const formatTime = (value: IsoDateTime) => new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export const formatDay = (value: IsoDateTime) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Whole days between two calendar dates. */
export const daysBetween = (from: IsoDate, to: IsoDate) => (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
