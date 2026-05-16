"use client";

import { useEffect, useRef } from "react";
import { useDraggable, type DraggableAttributes } from "@dnd-kit/core";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  PX_PER_DAY,
  type GanttScale,
  rangeWidthPx,
  dateToOffsetPx,
} from "@/lib/gantt";

// dnd-kit's `SyntheticListenerMap` is `Record<string, Function>`. We use the
// same loose shape to interop.
// eslint-disable-next-line @typescript-eslint/ban-types
type DragListeners = Record<string, Function> | undefined;

export type GanttTaskBar = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done" | null;
  due_start: Date | null;
  due_end: Date | null;
  due_label: string | null;
};

type Props = {
  task: GanttTaskBar;
  origin: Date;
  scale: GanttScale;
  saving?: boolean;
  onClick?: (taskId: string) => void;
};

const STATUS_COLORS: Record<
  "todo" | "doing" | "done" | "none",
  { bar: string; ring: string }
> = {
  done: { bar: "bg-emerald-500 text-white", ring: "ring-emerald-300" },
  doing: { bar: "bg-brand-500 text-white", ring: "ring-brand-300" },
  todo: { bar: "bg-slate-400 text-white", ring: "ring-slate-300" },
  none: { bar: "bg-slate-200 text-slate-600", ring: "ring-slate-200" },
};

/**
 * Convert a pointer-space delta (positive = visually rightward) to a day
 * delta. In RTL the inline axis is mirrored, so visual-right corresponds to
 * the date DECREASING; negate the pixel delta.
 */
function clientDxToDayDelta(dx: number, scale: GanttScale, rtl: boolean) {
  const px = rtl ? -dx : dx;
  return Math.round(px / PX_PER_DAY[scale]);
}

export function GanttBar({
  task,
  origin,
  scale,
  saving,
  onClick,
}: Props) {
  const rtlRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") {
      rtlRef.current = document.documentElement.dir === "rtl";
    }
  }, []);

  const hasDates = Boolean(task.due_start && task.due_end);
  const statusKey = task.status ?? "todo";
  const colors = STATUS_COLORS[hasDates ? statusKey : "none"];

  const dragBody = useDraggable({
    id: `bar-body-${task.id}`,
    data: { taskId: task.id, kind: "body" as const },
    disabled: !hasDates,
  });
  const dragStart = useDraggable({
    id: `bar-start-${task.id}`,
    data: { taskId: task.id, kind: "start" as const },
    disabled: !hasDates,
  });
  const dragEnd = useDraggable({
    id: `bar-end-${task.id}`,
    data: { taskId: task.id, kind: "end" as const },
    disabled: !hasDates,
  });

  // ----- visual preview based on each draggable's transform -----
  // (Commits are handled by the surrounding DndContext.onDragEnd.)
  let visualStart = task.due_start;
  let visualEnd = task.due_end;
  if (hasDates && task.due_start && task.due_end) {
    const rtl = rtlRef.current ?? true;
    if (dragBody.transform) {
      const days = clientDxToDayDelta(dragBody.transform.x, scale, rtl);
      const s = new Date(task.due_start);
      s.setDate(s.getDate() + days);
      const e = new Date(task.due_end);
      e.setDate(e.getDate() + days);
      visualStart = s;
      visualEnd = e;
    } else if (dragStart.transform) {
      const days = clientDxToDayDelta(dragStart.transform.x, scale, rtl);
      const s = new Date(task.due_start);
      s.setDate(s.getDate() + days);
      if (s <= task.due_end) visualStart = s;
    } else if (dragEnd.transform) {
      const days = clientDxToDayDelta(dragEnd.transform.x, scale, rtl);
      const e = new Date(task.due_end);
      e.setDate(e.getDate() + days);
      if (e >= task.due_start) visualEnd = e;
    }
  }

  // ----- positioning -----
  const startForOffset = visualStart ?? origin;
  const endForWidth = visualEnd ?? startForOffset;
  const offsetPx = dateToOffsetPx(startForOffset, origin, scale);
  const widthPx = hasDates
    ? rangeWidthPx(startForOffset, endForWidth, scale)
    : 96;

  const dashed = task.due_label ? "border border-dashed border-white/60" : "";
  const isAnyDragging =
    dragBody.isDragging || dragStart.isDragging || dragEnd.isDragging;

  const labelTooltip =
    task.due_label && visualStart && visualEnd
      ? `${task.due_label} · ${format(visualStart, "d MMM", { locale: he })}–${format(visualEnd, "d MMM yyyy", { locale: he })}`
      : (task.due_label ?? undefined);

  // We render bar position via `insetInlineStart` + `width` (kept in sync
  // with the live preview above). We deliberately do NOT apply dnd-kit's
  // transform here because that would double-move the bar — the preview is
  // already accounted for in offset/width.
  return (
    <div
      ref={dragBody.setNodeRef}
      data-task-id={task.id}
      className={`absolute top-1.5 z-10 select-none ${colors.bar} ${dashed} rounded-md px-2 py-1 text-xs shadow-sm transition-shadow hover:shadow ${
        isAnyDragging ? `ring-2 ${colors.ring}` : ""
      } ${!hasDates ? "opacity-60" : ""}`}
      style={{
        insetInlineStart: `${offsetPx}px`,
        width: `${widthPx}px`,
        height: "28px",
        touchAction: "none",
        cursor: hasDates ? "grab" : "default",
      }}
      title={labelTooltip}
      onClick={(ev) => {
        if (isAnyDragging) return;
        ev.stopPropagation();
        onClick?.(task.id);
      }}
      {...dragBody.listeners}
      {...dragBody.attributes}
    >
      <div className="flex h-full items-center justify-between gap-2">
        {hasDates && (
          <HandleSpan
            kind="start"
            dragRef={dragStart.setNodeRef}
            listeners={dragStart.listeners}
            attributes={dragStart.attributes}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-center">
          {hasDates ? task.title : "ללא תאריך"}
        </span>
        {saving && (
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
        )}
        {hasDates && (
          <HandleSpan
            kind="end"
            dragRef={dragEnd.setNodeRef}
            listeners={dragEnd.listeners}
            attributes={dragEnd.attributes}
          />
        )}
      </div>
    </div>
  );
}

function HandleSpan({
  kind,
  dragRef,
  listeners,
  attributes,
}: {
  kind: "start" | "end";
  dragRef: (el: HTMLElement | null) => void;
  listeners: DragListeners;
  attributes: DraggableAttributes;
}) {
  // The handle has its own dnd-kit listeners. We also stop propagation on
  // pointerdown so the surrounding body bar doesn't pick the drag up.
  const merged: Record<string, (e: React.SyntheticEvent) => void> = {};
  if (listeners) {
    for (const [name, fn] of Object.entries(listeners)) {
      merged[name] = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        (fn as (ev: React.SyntheticEvent) => void)(e);
      };
    }
  }
  return (
    <span
      ref={dragRef}
      className="h-full w-1.5 cursor-ew-resize rounded-sm bg-white/40 hover:bg-white/70"
      style={{ touchAction: "none" }}
      onClick={(e) => e.stopPropagation()}
      aria-label={
        kind === "start"
          ? "גרור להזזת תחילת המשימה"
          : "גרור להזזת סוף המשימה"
      }
      {...merged}
      {...attributes}
    />
  );
}
