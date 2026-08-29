// POST /api/agent/tasks/:id/complete — complete_task.
// Allowed for the task's assignee, its owner, or an admin.

import { NextResponse } from "next/server";
import { requireCaller, forbidden, notFound } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT } from "@/lib/agent/tasks-select";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  const { caller } = auth;

  const { id } = await params;
  const supabase = createAgentServiceClient();
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("id, owner_id, assignee_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "db_error", message: fetchError.message },
      { status: 500 },
    );
  }
  if (!existing) return notFound("משימה לא נמצאה");

  const canComplete =
    caller.isAdmin ||
    existing.owner_id === caller.userId ||
    existing.assignee_id === caller.userId;
  if (!canComplete) return forbidden("אין הרשאה לסמן את המשימה הזו כהושלמה");

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("id", id)
    .select(AGENT_TASK_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
