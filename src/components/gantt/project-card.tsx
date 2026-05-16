import Link from "next/link";
import { GanttChart } from "lucide-react";
import { formatDateRangeHe, parseISODate } from "@/lib/gantt";

export type ProjectCardData = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  task_count: number;
  done_count: number;
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const start = parseISODate(project.start_date);
  const end = parseISODate(project.end_date);
  const percentDone =
    project.task_count > 0
      ? Math.round((project.done_count / project.task_count) * 100)
      : 0;

  return (
    <Link
      href={`/gantt/${project.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <GanttChart className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold text-slate-900">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
              {project.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{formatDateRangeHe(start, end)}</span>
        <span>
          {project.task_count} משימות
          {project.task_count > 0 ? ` · ${percentDone}% הושלמו` : ""}
        </span>
      </div>

      {project.task_count > 0 && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${percentDone}%` }}
          />
        </div>
      )}
    </Link>
  );
}
