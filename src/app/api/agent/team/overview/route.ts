// GET /api/agent/team/overview — get_team_overview (Team tier).
// Per-person open/overdue/done counts — the shape a "what's my team up to
// this week" briefing is built from.

import { NextResponse } from "next/server";
import { requireCaller } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { todayIso } from "@/lib/agent/tasks-select";

type TaskRow = {
  assignee_id: string | null;
  status: "todo" | "doing" | "done";
  due_end: string | null;
};

export async function GET(request: Request) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;

  const supabase = createAgentServiceClient();

  const [{ data: profiles, error: profilesError }, { data: tasks, error: tasksError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, full_name, role, is_admin")
        .order("created_at", { ascending: true }),
      supabase.from("tasks").select("assignee_id, status, due_end"),
    ]);

  if (profilesError || tasksError) {
    return NextResponse.json(
      { error: "db_error", message: (profilesError ?? tasksError)?.message },
      { status: 500 },
    );
  }

  const today = todayIso();
  const rows = (tasks ?? []) as TaskRow[];

  const overview = (profiles ?? []).map((p) => {
    const mine = rows.filter((t) => t.assignee_id === p.id);
    return {
      user_id: p.id,
      name: p.display_name || p.full_name || p.email,
      is_admin: p.is_admin,
      role: p.role,
      open_tasks: mine.filter((t) => t.status !== "done").length,
      overdue_tasks: mine.filter(
        (t) => t.status !== "done" && t.due_end !== null && t.due_end < today,
      ).length,
      done_tasks: mine.filter((t) => t.status === "done").length,
    };
  });

  const unassigned = rows.filter(
    (t) => t.assignee_id === null && t.status !== "done",
  ).length;

  return NextResponse.json({ team: overview, unassigned_open_tasks: unassigned });
}
