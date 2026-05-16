"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

export type CalendarTile = {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  kind: "personal" | "team" | "task";
};

type Props = {
  events: CalendarTile[];
  currentMonth: Date;
  onChangeMonth: (next: Date) => void;
  onSelectDate?: (date: Date) => void;
  onSelectEvent?: (id: string) => void;
};

// Hebrew weekday headers (week starts Sunday).
const WEEKDAYS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"] as const;

function tileClasses(kind: CalendarTile["kind"]): string {
  switch (kind) {
    case "personal":
      return "bg-brand-100 text-brand-800 hover:bg-brand-200";
    case "team":
      return "bg-sky-100 text-sky-800 hover:bg-sky-200";
    case "task":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
  }
}

export function MonthView({
  events,
  currentMonth,
  onChangeMonth,
  onSelectDate,
  onSelectEvent,
}: Props) {
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  // week starts Sunday (weekStartsOn: 0)
  const gridStart = useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 0 }),
    [monthStart],
  );
  const gridEnd = useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn: 0 }),
    [monthEnd],
  );

  const days: Date[] = useMemo(() => {
    const out: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      out.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return out;
  }, [gridStart, gridEnd]);

  // Group events by yyyy-mm-dd of their start
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarTile[]>();
    for (const e of events) {
      const key = format(new Date(e.start), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    // sort each day by start time
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    return map;
  }, [events]);

  const today = new Date();
  const monthLabel = format(currentMonth, "MMMM yyyy");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(subMonths(currentMonth, 1))}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="חודש קודם"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(new Date())}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            היום
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(addMonths(currentMonth, 1))}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="חודש הבא"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="font-display text-lg font-bold text-slate-900">
          {monthLabel}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
        {WEEKDAYS_HE.map((wd) => (
          <div key={wd} className="px-2 py-2 text-center">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          const inMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={key}
              className={
                "min-h-[110px] border-b border-s border-slate-100 p-1.5 first:border-s-0 last:border-b-0 " +
                (inMonth ? "bg-white" : "bg-slate-50/60")
              }
            >
              <button
                type="button"
                onClick={() => onSelectDate?.(day)}
                className={
                  "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
                  (isToday
                    ? "bg-brand-500 text-white"
                    : inMonth
                      ? "text-slate-700 hover:bg-slate-100"
                      : "text-slate-400 hover:bg-slate-100")
                }
              >
                {format(day, "d")}
              </button>

              <ul className="space-y-1">
                {visible.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelectEvent?.(e.id)}
                      className={
                        "w-full truncate rounded px-1.5 py-0.5 text-start text-xs font-medium transition " +
                        tileClasses(e.kind)
                      }
                      title={`${e.title} • ${format(new Date(e.start), "HH:mm")}`}
                    >
                      <span className="me-1 text-[10px] tabular-nums opacity-70">
                        {format(new Date(e.start), "HH:mm")}
                      </span>
                      {e.title}
                    </button>
                  </li>
                ))}
                {overflow > 0 && (
                  <li className="px-1.5 text-[11px] font-medium text-slate-500">
                    +{overflow} נוספים
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
