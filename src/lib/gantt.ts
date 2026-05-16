// Gantt chart math + axis tick generation.
// All "offset" values are along the inline axis. In an RTL document `dir="rtl"`,
// the browser maps `inset-inline-start` to the visual RIGHT edge, so a bar with
// offset=0 is anchored at the right and grows to the left as `width` increases.

import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";

export type GanttScale = "day" | "week" | "month";

export const PX_PER_DAY: Record<GanttScale, number> = {
  day: 40,
  week: 16,
  month: 6,
};

export const ROW_HEIGHT = 44;
export const AXIS_HEIGHT = 56;
export const LABEL_COL_WIDTH = 240;

function toMidnight(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Pixels (along the inline axis) from `origin` to `date`.
 * Positive → later than origin.
 * Negative → earlier than origin.
 */
export function dateToOffsetPx(
  date: Date,
  origin: Date,
  scale: GanttScale,
): number {
  const days = differenceInCalendarDays(toMidnight(date), toMidnight(origin));
  return days * PX_PER_DAY[scale];
}

/**
 * Width in pixels of a bar between [start, end] inclusive.
 * A 1-day task (start === end) is `PX_PER_DAY` wide.
 */
export function rangeWidthPx(
  start: Date,
  end: Date,
  scale: GanttScale,
): number {
  const days =
    differenceInCalendarDays(toMidnight(end), toMidnight(start)) + 1;
  return Math.max(1, days) * PX_PER_DAY[scale];
}

/**
 * Inverse of dateToOffsetPx: pixel offset → Date.
 */
export function pxToDate(
  pxOffset: number,
  origin: Date,
  scale: GanttScale,
): Date {
  const days = Math.round(pxOffset / PX_PER_DAY[scale]);
  return addDays(toMidnight(origin), days);
}

export type AxisTick = { label: string; offsetPx: number };

/**
 * Generate ruler ticks between [start, end] (inclusive of start, exclusive of end+1 step).
 * Hebrew labels using date-fns `he` locale; ISO week numbers for week scale.
 */
export function generateAxisTicks(
  start: Date,
  end: Date,
  scale: GanttScale,
): AxisTick[] {
  const origin = toMidnight(start);
  const limit = toMidnight(end);
  const ticks: AxisTick[] = [];

  if (scale === "day") {
    let cursor = origin;
    while (cursor <= limit) {
      ticks.push({
        label: format(cursor, "d MMM", { locale: he }),
        offsetPx: dateToOffsetPx(cursor, origin, scale),
      });
      cursor = addDays(cursor, 1);
    }
    return ticks;
  }

  if (scale === "week") {
    // Hebrew weeks start on Sunday → weekStartsOn: 0
    let cursor = startOfWeek(origin, { weekStartsOn: 0 });
    while (cursor <= limit) {
      const week = getISOWeek(cursor);
      ticks.push({
        label: `שב' ${week}`,
        offsetPx: dateToOffsetPx(cursor, origin, scale),
      });
      cursor = addWeeks(cursor, 1);
    }
    return ticks;
  }

  // month
  let cursor = startOfMonth(origin);
  while (cursor <= limit) {
    ticks.push({
      label: format(cursor, "MMM yyyy", { locale: he }),
      offsetPx: dateToOffsetPx(cursor, origin, scale),
    });
    cursor = addMonths(cursor, 1);
  }
  return ticks;
}

/**
 * Reasonable default visible range around `origin` for a given scale.
 * Used by the chart page to size its scroll surface.
 */
export function defaultVisibleRange(
  origin: Date,
  scale: GanttScale,
): { start: Date; end: Date } {
  const center = toMidnight(origin);
  if (scale === "day") {
    return { start: addDays(center, -14), end: addDays(center, 60) };
  }
  if (scale === "week") {
    return {
      start: startOfWeek(addWeeks(center, -8), { weekStartsOn: 0 }),
      end: endOfWeek(addWeeks(center, 16), { weekStartsOn: 0 }),
    };
  }
  return {
    start: startOfMonth(addMonths(center, -6)),
    end: endOfMonth(addMonths(center, 12)),
  };
}

/**
 * Span the visible range so that all `tasks` fit comfortably,
 * with reasonable padding on either side.
 */
export function spanForTasks(
  tasks: { due_start?: Date | null; due_end?: Date | null }[],
  origin: Date,
  scale: GanttScale,
): { start: Date; end: Date } {
  const range = defaultVisibleRange(origin, scale);
  let min = range.start;
  let max = range.end;
  for (const t of tasks) {
    if (t.due_start && t.due_start < min) min = toMidnight(t.due_start);
    if (t.due_end && t.due_end > max) max = toMidnight(t.due_end);
  }
  return { start: addDays(min, -7), end: addDays(max, 7) };
}

/**
 * Parse a YYYY-MM-DD or ISO timestamp into a Date. Returns null on failure.
 */
export function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Treat date-only as local midnight (avoids TZ off-by-one).
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (dateOnly) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date as YYYY-MM-DD (DB / Postgres `date` column format).
 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Hebrew date-range label.
 */
export function formatDateRangeHe(
  start: Date | null,
  end: Date | null,
): string {
  if (!start && !end) return "ללא תאריך";
  if (start && end) {
    const sameYear = start.getFullYear() === end.getFullYear();
    if (start.getTime() === end.getTime()) {
      return format(start, "d MMM yyyy", { locale: he });
    }
    if (sameYear) {
      return `${format(start, "d MMM", { locale: he })}–${format(end, "d MMM yyyy", { locale: he })}`;
    }
    return `${format(start, "d MMM yyyy", { locale: he })}–${format(end, "d MMM yyyy", { locale: he })}`;
  }
  const only = (start ?? end)!;
  return format(only, "d MMM yyyy", { locale: he });
}
