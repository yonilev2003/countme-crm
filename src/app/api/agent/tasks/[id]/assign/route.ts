// POST /api/agent/tasks/:id/assign — assign_task.
// Only the task's owner (its creator) or an admin may hand it to someone
// else — an assignee who isn't the owner can't reassign their own work
// onward unnoticed.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaller, badRequest, forbidden, notFound } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT } from "@/lib/agent/tasks-select";
import { notifyTaskAssigned } from "@/lib/task-notifications";

const assignSchema = z.object({ assignee_id: z.string().uuid().nullable() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  const { caller } = auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "assignee_id לא תקין");
  }

  const supabase = createAgentServiceClient();
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_start, due_end, due_label, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "db_error", message: fetchError.message },
      { status: 500 },
    );
  }
  if (!existing) return notFound("משימה לא נמצאה");

  const canAssign = caller.isAdmin || existing.owner_id === caller.userId;
  if (!canAssign) return forbidden("רק הבעלים של המשימה או אדמין יכולים להעביר אותה");

  const { assignee_id } = parsed.data;
  const { data, error } = await supabase
    .from("tasks")
    .update({ assignee_id })
    .eq("id", id)
    .select(AGENT_TASK_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  if (assignee_id && assignee_id !== caller.userId) {
    await notifyTaskAssigned(supabase, {
      callerId: caller.userId,
      assigneeId: assignee_id,
      taskTitle: existing.title,
      taskDescription: existing.description,
      dueStart: existing.due_start,
      dueEnd: existing.due_end,
      dueLabel: existing.due_label,
      priority: existing.priority,
      status: existing.status,
    });
  }

  return NextResponse.json({ task: data });
}
