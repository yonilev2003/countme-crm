"use client";

import { addDays, addMonths, addWeeks } from "date-fns";
import { ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";
import type { GanttScale } from "@/lib/gantt";

type Props = {
  scale: GanttScale;
  onScaleChange: (s: GanttScale) => void;
  origin: Date;
  onOriginChange: (d: Date) => void;
};

const SCALE_OPTIONS: { value: GanttScale; label: string }[] = [
  { value: "day", label: "יום" },
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
];

export function GanttToolbar({
  scale,
  onScaleChange,
  origin,
  onOriginChange,
}: Props) {
  // In RTL the "forward in time" direction is visually leftward.
  // We use semantic names (קודם / הבא) rather than physical arrows.
  function shift(delta: number) {
    const stepFn =
      scale === "day"
        ? (d: Date, n: number) => addDays(d, n * 7)
        : scale === "week"
          ? (d: Date, n: number) => addWeeks(d, n * 4)
          : (d: Date, n: number) => addMonths(d, n * 3);
    onOriginChange(stepFn(origin, delta));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div
        className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-sm"
        role="tablist"
        aria-label="קנה מידה"
      >
        {SCALE_OPTIONS.map((opt) => {
          const active = opt.value === scale;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onScaleChange(opt.value)}
              className={
                active
                  ? "bg-brand-500 px-4 py-1.5 font-medium text-white"
                  : "px-4 py-1.5 text-slate-700 hover:bg-slate-100"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          aria-label="קודם"
        >
          <ChevronRight className="h-4 w-4" />
          <span>קודם</span>
        </button>
        <button
          type="button"
          onClick={() => onOriginChange(new Date())}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <CalendarDays className="h-4 w-4" />
          <span>היום</span>
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          aria-label="הבא"
        >
          <span>הבא</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
