import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GanttChart, type GanttTaskRow } from "@/components/gantt/gantt-chart";
import { formatDateRangeHe, parseISODate } from "@/lib/gantt";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done" | null;
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
};

export default async function ProjectGanttPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, start_date, end_date")
    .eq("id", id)
    .maybeSingle<ProjectRow>();

  if (!project) {
    notFound();
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, due_start, due_end, due_label")
    .eq("project_id", project.id)
    .order("due_start", { ascending: true, nullsFirst: false });

  const rows: GanttTaskRow[] = (tasks as TaskRow[] | null) ?? [];

  const start = parseISODate(project.start_date);
  const end = parseISODate(project.end_date);

  // Pick an origin: project start or earliest task start or today.
  const initialOrigin =
    project.start_date ??
    rows.find((r) => r.due_start)?.due_start ??
    undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link href="/gantt" className="hover:text-slate-700">
          גאנט
        </Link>
        <ChevronRight className="h-4 w-4 -scale-x-100" aria-hidden />
        <span className="text-slate-700">{project.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-slate-900">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 text-sm text-slate-600">{project.description}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {formatDateRangeHe(start, end)} · {rows.length} משימות
          </p>
        </div>
      </header>

      <GanttChart tasks={rows} initialOrigin={initialOrigin ?? undefined} />
    </div>
  );
}
