"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  AXIS_HEIGHT,
  LABEL_COL_WIDTH,
  PX_PER_DAY,
  ROW_HEIGHT,
  dateToOffsetPx,
  generateAxisTicks,
  parseISODate,
  spanForTasks,
  toISODate,
  type GanttScale,
} from "@/lib/gantt";
import { GanttBar, type GanttTaskBar } from "./gantt-bar";
import { GanttToolbar } from "./gantt-toolbar";
import { updateTaskDates } from "@/app/(app)/gantt/actions";

export type GanttTaskRow = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done" | null;
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
};

type Props = {
  tasks: GanttTaskRow[];
  initialOrigin?: string; // YYYY-MM-DD
  initialScale?: GanttScale;
};

type DragKind = "body" | "start" | "end";

type DragData = {
  taskId: string;
  kind: DragKind;
};

function clientDxToDayDelta(dx: number, scale: GanttScale, rtl: boolean) {
  const px = rtl ? -dx : dx;
  return Math.round(px / PX_PER_DAY[scale]);
}

export function GanttChart({
  tasks,
  initialOrigin,
  initialScale = "day",
}: Props) {
  const [scale, setScale] = useState<GanttScale>(initialScale);
  const [origin, setOrigin] = useState<Date>(() => {
    const fromProp = parseISODate(initialOrigin);
    return fromProp ?? new Date();
  });

  const [overrides, setOverrides] = useState<
    Record<string, { due_start: string; due_end: string }>
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const rtlRef = useRef<boolean | null>(null);
  if (rtlRef.current === null && typeof document !== "undefined") {
    rtlRef.current = document.documentElement.dir === "rtl";
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const taskBars: GanttTaskBar[] = useMemo(
    () =>
      tasks.map((t) => {
        const ov = overrides[t.id];
        const start = parseISODate(ov?.due_start ?? t.due_start);
        const end = parseISODate(ov?.due_end ?? t.due_end);
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          due_start: start,
          due_end: end,
          due_label: t.due_label,
        };
      }),
    [tasks, overrides],
  );

  const { start: spanStart, end: spanEnd } = useMemo(
    () =>
      spanForTasks(
        taskBars.map((t) => ({ due_start: t.due_start, due_end: t.due_end })),
        origin,
        scale,
      ),
    [taskBars, origin, scale],
  );

  const ticks = useMemo(
    () => generateAxisTicks(spanStart, spanEnd, scale),
    [spanStart, spanEnd, scale],
  );

  const totalWidth = useMemo(() => {
    if (ticks.length === 0) return 0;
    const last = ticks[ticks.length - 1].offsetPx;
    return Math.max(last + 200, 800);
  }, [ticks]);

  const totalHeight = AXIS_HEIGHT + Math.max(taskBars.length, 1) * ROW_HEIGHT;

  const todayOffset = dateToOffsetPx(new Date(), spanStart, scale);

  function commitDragForTask(taskId: string, start: Date, end: Date) {
    const s = toISODate(start);
    const e = toISODate(end);
    setOverrides((m) => ({ ...m, [taskId]: { due_start: s, due_end: e } }));
    setSaving((m) => ({ ...m, [taskId]: true }));
    startTransition(async () => {
      const res = await updateTaskDates({
        taskId,
        due_start: s,
        due_end: e,
        due_label: null,
      });
      setSaving((m) => {
        const next = { ...m };
        delete next[taskId];
        return next;
      });
      if (!res.success) {
        setOverrides((m) => {
          const next = { ...m };
          delete next[taskId];
          return next;
        });
        console.error("updateTaskDates failed:", res.error);
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    const task = taskBars.find((t) => t.id === data.taskId);
    if (!task || !task.due_start || !task.due_end) return;
    const rtl = rtlRef.current ?? true;
    const days = clientDxToDayDelta(event.delta.x, scale, rtl);
    if (days === 0) return;

    let newStart = task.due_start;
    let newEnd = task.due_end;
    if (data.kind === "body") {
      newStart = new Date(task.due_start);
      newStart.setDate(newStart.getDate() + days);
      newEnd = new Date(task.due_end);
      newEnd.setDate(newEnd.getDate() + days);
    } else if (data.kind === "start") {
      newStart = new Date(task.due_start);
      newStart.setDate(newStart.getDate() + days);
      if (newStart > task.due_end) return;
    } else if (data.kind === "end") {
      newEnd = new Date(task.due_end);
      newEnd.setDate(newEnd.getDate() + days);
      if (newEnd < task.due_start) return;
    }
    commitDragForTask(task.id, newStart, newEnd);
  }

  return (
    <div className="space-y-3">
      <GanttToolbar
        scale={scale}
        onScaleChange={setScale}
        origin={origin}
        onOriginChange={setOrigin}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div
              className="relative"
              style={{
                width: `${LABEL_COL_WIDTH + totalWidth}px`,
                height: `${totalHeight}px`,
              }}
            >
              {/* ---------- frozen label column ---------- */}
              <div
                className="absolute top-0 z-20 h-full border-e border-slate-200 bg-white"
                style={{
                  insetInlineStart: 0,
                  width: `${LABEL_COL_WIDTH}px`,
                }}
              >
                <div
                  className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500"
                  style={{ height: `${AXIS_HEIGHT}px` }}
                >
                  משימות
                </div>
                {taskBars.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">
                    אין משימות לפרויקט
                  </div>
                ) : (
                  taskBars.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center border-b border-slate-100 px-3 text-sm text-slate-700"
                      style={{ height: `${ROW_HEIGHT}px` }}
                      title={t.title}
                    >
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))
                )}
              </div>

              {/* ---------- chart canvas ---------- */}
              <div
                className="absolute top-0"
                style={{
                  insetInlineStart: `${LABEL_COL_WIDTH}px`,
                  width: `${totalWidth}px`,
                  height: `${totalHeight}px`,
                }}
              >
                {/* axis ruler */}
                <div
                  className="sticky top-0 border-b border-slate-200 bg-slate-50"
                  style={{ height: `${AXIS_HEIGHT}px` }}
                >
                  {ticks.map((tick, i) => (
                    <div
                      key={`${tick.label}-${i}`}
                      className="absolute top-0 flex h-full items-center border-s border-slate-200 px-1.5 text-[11px] text-slate-600"
                      style={{ insetInlineStart: `${tick.offsetPx}px` }}
                    >
                      {tick.label}
                    </div>
                  ))}
                </div>

                {/* today marker */}
                {todayOffset >= 0 && todayOffset <= totalWidth && (
                  <div
                    className="absolute z-0 w-px bg-brand-500/40"
                    style={{
                      insetInlineStart: `${todayOffset}px`,
                      top: `${AXIS_HEIGHT}px`,
                      height: `${totalHeight - AXIS_HEIGHT}px`,
                    }}
                    aria-hidden
                  />
                )}

                {/* rows + bars */}
                <div
                  className="absolute"
                  style={{
                    insetInlineStart: 0,
                    top: `${AXIS_HEIGHT}px`,
                    width: `${totalWidth}px`,
                    height: `${totalHeight - AXIS_HEIGHT}px`,
                  }}
                >
                  {taskBars.map((task, idx) => (
                    <div
                      key={task.id}
                      className="relative border-b border-slate-100"
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      <GanttBar
                        task={task}
                        origin={spanStart}
                        scale={scale}
                        saving={Boolean(saving[task.id])}
                      />
                      <span className="sr-only">שורה {idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DndContext>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        גרור פס משימה להזזה. גרור את הקצוות כדי לשנות תאריך התחלה או סיום.
        השמירה אוטומטית.
      </p>
    </div>
  );
}
