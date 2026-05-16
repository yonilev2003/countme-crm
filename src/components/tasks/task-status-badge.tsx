import { STATUS_LABELS_HE, type TaskStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  doing: "bg-brand-100 text-brand-800",
  done: "bg-emerald-100 text-emerald-800",
};

const STATUS_DOTS: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  doing: "bg-brand-500",
  done: "bg-emerald-500",
};

type Props = {
  status: TaskStatus;
  className?: string;
};

export function TaskStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status])}
        aria-hidden
      />
      {STATUS_LABELS_HE[status]}
    </span>
  );
}
