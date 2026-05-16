import {
  endOfMonth,
  endOfQuarter,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
} from "date-fns";
import { he } from "date-fns/locale";

// Hebrew month names + common aliases (with and without ה־ prefix).
// Index 0 = January.
const HEBREW_MONTH_NAMES: ReadonlyArray<ReadonlyArray<string>> = [
  ["ינואר"],
  ["פברואר"],
  ["מרץ", "מרס"],
  ["אפריל"],
  ["מאי"],
  ["יוני"],
  ["יולי"],
  ["אוגוסט"],
  ["ספטמבר"],
  ["אוקטובר"],
  ["נובמבר"],
  ["דצמבר"],
];

const HEBREW_MONTH_DISPLAY: ReadonlyArray<string> = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeParse(s: string | null | undefined): Date | null {
  if (!s) return null;
  try {
    const d = parseISO(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * If due_label is present, return it (it's the human-authored phrase).
 * Otherwise format the date or range:
 *  - Single date: "17 במאי" (or "17 במאי 2027" if not the current year)
 *  - Same-month range: "17–22 במאי"
 *  - Cross-month range: "מאי–יוני 2026"
 * Returns "" if no dates and no label.
 */
export function formatDueRange(
  due_start: string | null,
  due_end: string | null,
  due_label: string | null,
): string {
  if (due_label && due_label.trim().length > 0) {
    return due_label.trim();
  }

  const start = safeParse(due_start);
  const end = safeParse(due_end);

  if (!start && !end) return "";
  if (!start && end) return formatSingle(end);
  if (start && !end) return formatSingle(start);
  if (!start || !end) return "";

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) return formatSingle(start);

  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  if (sameMonth) {
    const monthName = HEBREW_MONTH_DISPLAY[start.getMonth()];
    const currentYear = new Date().getFullYear();
    const yearSuffix =
      start.getFullYear() === currentYear ? "" : ` ${start.getFullYear()}`;
    return `${start.getDate()}–${end.getDate()} ב${monthName}${yearSuffix}`;
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    // Whole-month-or-bigger range within a single year
    const startIsMonthStart = start.getDate() === 1;
    const endIsMonthEnd =
      end.getDate() === endOfMonth(end).getDate() && end.getMonth() !== start.getMonth();
    if (startIsMonthStart && endIsMonthEnd) {
      const startMonth = HEBREW_MONTH_DISPLAY[start.getMonth()];
      const endMonth = HEBREW_MONTH_DISPLAY[end.getMonth()];
      return `${startMonth}–${endMonth} ${start.getFullYear()}`;
    }
    return `${formatSingle(start)} – ${formatSingle(end)}`;
  }

  // Cross-year range, fall back to two full dates
  return `${formatSingle(start)} – ${formatSingle(end)}`;
}

function formatSingle(d: Date): string {
  const currentYear = new Date().getFullYear();
  if (d.getFullYear() === currentYear) {
    return format(d, "d 'ב'MMMM", { locale: he });
  }
  return format(d, "d 'ב'MMMM yyyy", { locale: he });
}

/**
 * parseQuarter("Q2 2026")  -> { start: "2026-04-01", end: "2026-06-30" }
 * parseQuarter("רבעון 2")  -> uses current year
 * Accepts: "Q1"-"Q4" optionally followed by year, or "רבעון N" optionally followed by year.
 * Returns null if the label isn't a recognized quarter pattern.
 */
export function parseQuarter(
  label: string,
): { start: string; end: string } | null {
  if (!label) return null;
  const normalized = label.trim();
  const currentYear = new Date().getFullYear();

  // Match "Q1 2026", "q3", "Q4-2025"
  const latin = normalized.match(/^[Qq]\s*([1-4])(?:\s*[-/ ]?\s*(\d{4}))?$/);
  if (latin) {
    const q = Number(latin[1]);
    const year = latin[2] ? Number(latin[2]) : currentYear;
    return quarterBounds(q, year);
  }

  // Match "רבעון 2" or "רבעון 2 2026" or "הרבעון השני"
  const hebrew = normalized.match(/^(?:ה?רבעון)\s*([1-4])(?:\s*(\d{4}))?$/);
  if (hebrew) {
    const q = Number(hebrew[1]);
    const year = hebrew[2] ? Number(hebrew[2]) : currentYear;
    return quarterBounds(q, year);
  }

  return null;
}

function quarterBounds(
  q: number,
  year: number,
): { start: string; end: string } {
  const firstMonth = (q - 1) * 3; // 0, 3, 6, 9
  const startDate = startOfQuarter(new Date(year, firstMonth, 15));
  const endDate = endOfQuarter(startDate);
  return { start: isoDate(startDate), end: isoDate(endDate) };
}

/**
 * parseMonth("מרץ")          -> uses current year, returns whole-month bounds
 * parseMonth("March", 2026)  -> works with English month names too
 * parseMonth("מרץ 2027")     -> recognises trailing year inside the name
 * Returns null if the name doesn't match any known month.
 */
export function parseMonth(
  name: string,
  year?: number,
): { start: string; end: string } | null {
  if (!name) return null;
  const trimmed = name.trim();
  const currentYear = new Date().getFullYear();

  // Pull a trailing 4-digit year if present
  let nameOnly = trimmed;
  let resolvedYear = year ?? currentYear;
  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (yearMatch) {
    resolvedYear = Number(yearMatch[1]);
    nameOnly = trimmed.replace(yearMatch[0], "").trim();
  }

  // Strip a leading ה־ / ה- / ה prefix (e.g. "החודש מרץ")
  nameOnly = nameOnly.replace(/^ה[־-]?/, "").trim();

  const lower = nameOnly.toLowerCase();
  for (let i = 0; i < HEBREW_MONTH_NAMES.length; i++) {
    for (const candidate of HEBREW_MONTH_NAMES[i]) {
      if (nameOnly === candidate) {
        return monthBounds(i, resolvedYear);
      }
    }
    // English fallback via date-fns locale-agnostic name
    const en = format(new Date(2000, i, 1), "MMMM").toLowerCase();
    if (lower === en) {
      return monthBounds(i, resolvedYear);
    }
  }

  return null;
}

function monthBounds(
  monthIndex: number,
  year: number,
): { start: string; end: string } {
  const startDate = startOfMonth(new Date(year, monthIndex, 1));
  const endDate = endOfMonth(startDate);
  return { start: isoDate(startDate), end: isoDate(endDate) };
}
