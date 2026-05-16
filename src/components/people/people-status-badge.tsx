import { STATUS_COLORS, STATUS_LABELS_HE, type PersonStatus } from "@/lib/people";
import { cn } from "@/lib/utils";

type Props = {
  status: PersonStatus;
  className?: string;
};

export function PeopleStatusBadge({ status, className }: Props) {
  const colors = STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        colors.bg,
        colors.text,
        className,
      )}
    >
      {STATUS_LABELS_HE[status]}
    </span>
  );
}
