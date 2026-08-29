// PATCH /api/agent/tasks/:id — update_task.
// Allowed for the task's assignee, its owner, or an admin. Does not touch
// assignee_id — use POST /api/agent/tasks/:id/assign to reassign, so a
// reassignment always goes through the one path that sends the
// notification email.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaller, badRequest, forbidden, notFound } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT } from "@/lib/agent/tasks-select";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const updateTaskSchema = z
  .object({
    title: z.string().min(2).max(200),
    description: z.string().max(5000).nullable(),
    due_start: z.string().regex(isoDate).nullable(),
    due_end: z.string().regex(isoDate).nullable(),
    due_label: z.string().max(80).nullable(),
    status: z.enum(["todo", "doing", "done"]),
    priority: z.enum(["low", "med", "high"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "לא נשלחו שדות לעדכון");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  const { caller } = auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "פרטים לא תקינים");
  }

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

  const canEdit =
    caller.isAdmin ||
    existing.owner_id === caller.userId ||
    existing.assignee_id === caller.userId;
  if (!canEdit) return forbidden("אין הרשאה לערוך את המשימה הזו");

  const patch = parsed.data;
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.description !== undefined)
    update.description = patch.description?.trim() || null;
  if (patch.due_start !== undefined) update.due_start = patch.due_start;
  if (patch.due_end !== undefined) update.due_end = patch.due_end;
  if (patch.due_label !== undefined) update.due_label = patch.due_label?.trim() || null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.priority !== undefined) update.priority = patch.priority;

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", id)
    .select(AGENT_TASK_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
