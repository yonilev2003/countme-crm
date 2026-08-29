// POST /api/agent/tasks — create_task.
// Any valid personal token may create a task for its own user. Assigning a
// newly-created task to someone else requires admin privileges; this keeps
// personal tokens from silently creating work on behalf of other teammates.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaller, badRequest, forbidden } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT } from "@/lib/agent/tasks-select";
import { notifyTaskAssigned } from "@/lib/task-notifications";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const createTaskSchema = z.object({
  title: z.string().min(2, "כותרת חייבת לכלול לפחות 2 תווים").max(200),
  description: z.string().max(5000).optional().nullable(),
  due_start: z.string().regex(isoDate).optional().nullable(),
  due_end: z.string().regex(isoDate).optional().nullable(),
  due_label: z.string().max(80).optional().nullable(),
  status: z.enum(["todo", "doing", "done"]).default("todo"),
  priority: z.enum(["low", "med", "high"]).default("med"),
  assignee_id: z.string().uuid().optional().nullable(),
  person_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  const { caller } = auth;

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "פרטים לא תקינים");
  }
  const input = parsed.data;

  const supabase = createAgentServiceClient();
  const assigneeId = input.assignee_id ?? caller.userId;

  if (assigneeId !== caller.userId && !caller.isAdmin) {
    return forbidden("הקצאת משימה חדשה למשתמש אחר דורשת הרשאת אדמין");
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      due_start: input.due_start || null,
      due_end: input.due_end || null,
      due_label: input.due_label?.trim() || null,
      status: input.status,
      priority: input.priority,
      assignee_id: assigneeId,
      person_id: input.person_id || null,
      project_id: input.project_id || null,
      owner_id: caller.userId,
    })
    .select(AGENT_TASK_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  if (assigneeId !== caller.userId) {
    await notifyTaskAssigned(supabase, {
      callerId: caller.userId,
      assigneeId,
      taskTitle: input.title.trim(),
      taskDescription: input.description?.trim() || null,
      dueStart: input.due_start || null,
      dueEnd: input.due_end || null,
      dueLabel: input.due_label?.trim() || null,
      priority: input.priority,
      status: input.status,
    });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
