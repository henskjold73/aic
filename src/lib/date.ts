import type { MonthIndex, MonthKey } from "@/types";

/** Full English month names, indexed by {@link MonthIndex}. */
export const MONTH_NAMES: readonly string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Weekday labels in Monday-first order, matching the calendar grid. */
export const WEEKDAY_LABELS: readonly string[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

/** True when the given date falls on a Saturday or Sunday. */
export function isWeekend(year: number, month: number, day: number): boolean {
  const weekday = new Date(year, month, day).getDay();
  return weekday === 0 || weekday === 6;
}

/** Count Monday–Friday days from the 1st through `upToDay` inclusive. */
export function countWorkdays(year: number, month: number, upToDay: number): number {
  let count = 0;
  for (let day = 1; day <= upToDay; day++) {
    if (!isWeekend(year, month, day)) count++;
  }
  return count;
}

/** Number of calendar days in the given month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Total Monday–Friday days in the given month. */
export function totalWorkdays(year: number, month: number): number {
  return countWorkdays(year, month, daysInMonth(year, month));
}

/** Format a date as the `YYYY-MM` key used throughout the API. */
export function monthKey(date: Date = new Date()): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Split a `YYYY-MM` key into a 1-based year/month pair. */
export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1 };
}

/** The current month index, typed for calendar state. */
export function currentMonthIndex(date: Date = new Date()): MonthIndex {
  return date.getMonth() as MonthIndex;
}

/** Compact relative time such as `"3m ago"`, from an ISO timestamp. */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}
