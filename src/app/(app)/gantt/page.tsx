import Link from "next/link";
import { FileUp, GanttChart as GanttIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectCard, type ProjectCardData } from "@/components/gantt/project-card";
import { NewProjectButton } from "@/components/gantt/new-project-button";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};

type TaskAggRow = {
  project_id: string;
  status: "todo" | "doing" | "done" | null;
};

export default async function GanttIndexPage() {
  const supabase = await createClient();

  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, name, description, start_date, end_date")
    .order("created_at", { ascending: false });

  const projects: ProjectRow[] = projectsData ?? [];

  // Fetch task statuses for all projects in one round-trip.
  const projectIds = projects.map((p) => p.id);
  const counts = new Map<string, { total: number; done: number }>();
  if (projectIds.length > 0) {
    const { data: taskData } = await supabase
      .from("tasks")
      .select("project_id, status")
      .in("project_id", projectIds);
    for (const row of (taskData as TaskAggRow[] | null) ?? []) {
      if (!row.project_id) continue;
      const cur = counts.get(row.project_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (row.status === "done") cur.done += 1;
      counts.set(row.project_id, cur);
    }
  }

  const cardData: ProjectCardData[] = projects.map((p) => {
    const c = counts.get(p.id) ?? { total: 0, done: 0 };
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      start_date: p.start_date,
      end_date: p.end_date,
      task_count: c.total,
      done_count: c.done,
    };
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">גאנט</h1>
          <p className="mt-2 text-slate-600">
            פרויקטים עם ציר זמן, גרירת תאריכים וייבוא מאקסל
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/gantt/import"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-slate-50"
          >
            <FileUp className="h-4 w-4" />
            ייבוא מאקסל
          </Link>
          <NewProjectButton />
        </div>
      </div>

      {cardData.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cardData.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <GanttIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-slate-900">
        עוד אין פרויקטים
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        צור פרויקט ריק או ייבא קובץ XLSX עם רשימת משימות ותאריכים. כל פרויקט
        יוצג עם ציר זמן ניתן לגרירה.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Link
          href="/gantt/import"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-slate-50"
        >
          <FileUp className="h-4 w-4" />
          ייבוא מאקסל
        </Link>
        <NewProjectButton />
      </div>
    </div>
  );
}
