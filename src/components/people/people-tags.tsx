import { cn } from "@/lib/utils";

type Props = {
  tags: string[] | null | undefined;
  max?: number;
  className?: string;
  chipClassName?: string;
};

export function PeopleTags({ tags, max, className, chipClassName }: Props) {
  const list = tags ?? [];
  if (list.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const limit = max ?? list.length;
  const visible = list.slice(0, limit);
  const overflow = list.length - visible.length;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex max-w-[10rem] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700",
            chipClassName,
          )}
          title={tag}
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500",
            chipClassName,
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
