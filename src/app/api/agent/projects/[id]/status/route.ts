// GET /api/agent/projects/:id/status — get_project_status (Team tier).

import { NextResponse } from "next/server";
import { requireCaller, notFound } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT } from "@/lib/agent/tasks-select";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = createAgentServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, description, start_date, end_date, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json(
      { error: "db_error", message: projectError.message },
      { status: 500 },
    );
  }
  if (!project) return notFound("פרויקט לא נמצא");

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(AGENT_TASK_SELECT)
    .eq("project_id", id)
    .order("due_end", { ascending: true, nullsFirst: false });

  if (tasksError) {
    return NextResponse.json(
      { error: "db_error", message: tasksError.message },
      { status: 500 },
    );
  }

  const rows = tasks ?? [];
  const counts = {
    todo: rows.filter((t) => t.status === "todo").length,
    doing: rows.filter((t) => t.status === "doing").length,
    done: rows.filter((t) => t.status === "done").length,
  };

  return NextResponse.json({
    project,
    task_counts: counts,
    open_tasks: rows.filter((t) => t.status !== "done"),
  });
}
