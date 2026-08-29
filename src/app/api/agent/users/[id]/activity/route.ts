// GET /api/agent/users/:id/activity — get_user_activity.
// Admin/CTO tier for anyone else; Personal tier for your own id.

import { NextResponse } from "next/server";
import { requireCaller, forbidden, notFound } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT, todayIso } from "@/lib/agent/tasks-select";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  const { caller } = auth;

  const { id } = await params;
  if (id !== caller.userId && !caller.isAdmin) {
    return forbidden("צפייה בפעילות של מישהו אחר דורשת הרשאת אדמין");
  }

  const supabase = createAgentServiceClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, full_name, role, is_admin, created_at")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "db_error", message: profileError.message },
      { status: 500 },
    );
  }
  if (!profile) return notFound("משתמש לא נמצא");

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(AGENT_TASK_SELECT)
    .eq("assignee_id", id)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (tasksError) {
    return NextResponse.json(
      { error: "db_error", message: tasksError.message },
      { status: 500 },
    );
  }

  const today = todayIso();
  const rows = tasks ?? [];

  return NextResponse.json({
    profile,
    counts: {
      open: rows.filter((t) => t.status !== "done").length,
      overdue: rows.filter(
        (t) => t.status !== "done" && t.due_end !== null && t.due_end < today,
      ).length,
      done: rows.filter((t) => t.status === "done").length,
    },
    recent_tasks: rows,
  });
}
