import { Calendar } from "lucide-react";
import { formatDueRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Props = {
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
  className?: string;
  /** Show a small calendar icon to the inline-start. Defaults to true. */
  withIcon?: boolean;
};

/**
 * Renders the task due-range. When `due_label` is set we treat it as authoritative
 * (it's the human Hebrew phrase the user entered). Otherwise we format the start/end
 * dates. Color reflects urgency vs. today.
 */
export function TaskDueDisplay({
  due_start,
  due_end,
  due_label,
  className,
  withIcon = true,
}: Props) {
  const text = formatDueRange(due_start, due_end, due_label);
  if (!text) {
    return (
      <span className={cn("text-xs text-slate-400", className)}>
        ללא תאריך
      </span>
    );
  }

  const urgency = computeUrgency(due_start, due_end);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        urgencyStyles(urgency),
        className,
      )}
      title={text}
    >
      {withIcon && <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{text}</span>
    </span>
  );
}

type Urgency = "overdue" | "today" | "thisWeek" | "future" | "none";

function urgencyStyles(u: Urgency): string {
  switch (u) {
    case "overdue":
      return "bg-red-50 text-red-700";
    case "today":
      return "bg-amber-50 text-amber-800";
    case "thisWeek":
      return "bg-slate-100 text-slate-700";
    case "future":
      return "bg-slate-50 text-slate-500";
    case "none":
      return "bg-slate-50 text-slate-500";
  }
}

function computeUrgency(
  due_start: string | null,
  due_end: string | null,
): Urgency {
  // Use the "latest possible" date for overdue checks (a range that ends today is still "today").
  const endStr = due_end ?? due_start;
  const startStr = due_start ?? due_end;
  if (!endStr || !startStr) return "none";

  const today = startOfTodayIsrael();
  const end = parseISODate(endStr);
  const start = parseISODate(startStr);
  if (!end || !start) return "none";

  if (end < today) return "overdue";
  if (start <= today && today <= end) return "today";

  // Within current ISO week (Sun–Sat is fine for Israel)
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  if (start <= weekEnd) return "thisWeek";

  return "future";
}

function parseISODate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfTodayIsrael(): Date {
  // We compare YYYY-MM-DD strings via Date objects in the runtime's local TZ.
  // Server-rendered cells are fine because we treat dates as wall-clock days.
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
