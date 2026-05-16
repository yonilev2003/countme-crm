"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { taskSchema, type TaskInput } from "@/lib/tasks";
import { formatDueRange } from "@/lib/dates";
import { sendTaskAssignedEmail } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

const quickCreateSchema = z.object({
  title: z.string().min(2).max(200),
  due_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_label: z.string().max(80).optional().nullable(),
});

type QuickCreateInput = z.infer<typeof quickCreateSchema>;

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null };
  return { supabase, user };
}

function toPayload(input: TaskInput) {
  // Normalise nullable date strings — Supabase wants nulls, not empty strings.
  return {
    title: input.title.trim(),
    description: input.description?.trim() ? input.description.trim() : null,
    due_start: input.due_start || null,
    due_end: input.due_end || null,
    due_label: input.due_label?.trim() ? input.due_label.trim() : null,
    status: input.status,
    priority: input.priority,
    assignee_id: input.assignee_id || null,
    person_id: input.person_id || null,
    project_id: input.project_id || null,
  };
}

type ProfileLookup = { email: string | null; display_name: string | null; full_name: string | null };

function displayNameOf(p: ProfileLookup | null | undefined): string {
  if (!p) return "חבר/ת צוות";
  return (
    p.display_name?.trim() || p.full_name?.trim() || p.email?.trim() || "חבר/ת צוות"
  );
}

/**
 * Best-effort: fetch assignee email + display info, fetch caller display info, and send the email.
 * Never throws — failures are logged inside `sendTaskAssignedEmail`.
 */
async function notifyTaskAssigned(
  supabase: SupabaseClient,
  args: {
    callerId: string;
    assigneeId: string;
    taskTitle: string;
    taskDescription: string | null;
    dueStart: string | null;
    dueEnd: string | null;
    dueLabel: string | null;
    priority: "low" | "med" | "high";
    status: "todo" | "doing" | "done";
  },
): Promise<void> {
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, full_name")
      .in("id", [args.assigneeId, args.callerId]);

    const assignee = profiles?.find((p) => p.id === args.assigneeId) ?? null;
    const caller = profiles?.find((p) => p.id === args.callerId) ?? null;

    if (!assignee?.email) {
      console.warn("[email] assignee has no email — skipping task notification");
      return;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const taskUrl = `${baseUrl}/tasks`;

    await sendTaskAssignedEmail({
      to: assignee.email,
      toName: displayNameOf(assignee),
      taskTitle: args.taskTitle,
      taskDescription: args.taskDescription,
      dueDisplay: formatDueRange(args.dueStart, args.dueEnd, args.dueLabel),
      priority: args.priority,
      status: args.status,
      assignedByName: displayNameOf(caller),
      taskUrl,
    });
  } catch (err) {
    console.error("[email] notifyTaskAssigned failed:", err);
  }
}

/**
 * Quick-add path used by the natural-language input on /tasks.
 * Sets sensible defaults (status=todo, priority=med, owner=current user, assignee=current user).
 */
export async function createTaskFromParse(
  input: QuickCreateInput,
): Promise<Result<{ id: string }>> {
  const parsed = quickCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "פרטים לא תקינים" };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title.trim(),
      due_start: parsed.data.due_start ?? null,
      due_end: parsed.data.due_end ?? null,
      due_label: parsed.data.due_label?.trim() || null,
      status: "todo",
      priority: "med",
      owner_id: user.id,
      assignee_id: user.id,
    })
    .select("id, assignee_id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Quick-add always self-assigns; skip self-spam.
  if (data.assignee_id && data.assignee_id !== user.id) {
    await notifyTaskAssigned(supabase, {
      callerId: user.id,
      assigneeId: data.assignee_id,
      taskTitle: parsed.data.title.trim(),
      taskDescription: null,
      dueStart: parsed.data.due_start ?? null,
      dueEnd: parsed.data.due_end ?? null,
      dueLabel: parsed.data.due_label?.trim() || null,
      priority: "med",
      status: "todo",
    });
  }

  revalidatePath("/tasks");
  return { success: true, data: { id: data.id } };
}

export async function createTask(
  input: TaskInput,
): Promise<Result<{ id: string }>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים",
    };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const payload = toPayload(parsed.data);
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...payload, owner_id: user.id })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (payload.assignee_id && payload.assignee_id !== user.id) {
    await notifyTaskAssigned(supabase, {
      callerId: user.id,
      assigneeId: payload.assignee_id,
      taskTitle: payload.title,
      taskDescription: payload.description,
      dueStart: payload.due_start,
      dueEnd: payload.due_end,
      dueLabel: payload.due_label,
      priority: payload.priority,
      status: payload.status,
    });
  }

  revalidatePath("/tasks");
  return { success: true, data: { id: data.id } };
}

export async function updateTask(
  id: string,
  input: TaskInput,
): Promise<Result<{ id: string }>> {
  if (!id) return { success: false, error: "מזהה חסר" };

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים",
    };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "לא מחובר" };

  // Capture the previous assignee before updating so we can detect a change.
  const { data: previous } = await supabase
    .from("tasks")
    .select("assignee_id")
    .eq("id", id)
    .maybeSingle();
  const previousAssigneeId = previous?.assignee_id ?? null;

  const payload = toPayload(parsed.data);
  // RLS already restricts to owner or assignee, but the .update() call needs to match a row.
  const { error } = await supabase.from("tasks").update(payload).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  if (
    payload.assignee_id &&
    payload.assignee_id !== previousAssigneeId &&
    payload.assignee_id !== user.id
  ) {
    await notifyTaskAssigned(supabase, {
      callerId: user.id,
      assigneeId: payload.assignee_id,
      taskTitle: payload.title,
      taskDescription: payload.description,
      dueStart: payload.due_start,
      dueEnd: payload.due_end,
      dueLabel: payload.due_label,
      priority: payload.priority,
      status: payload.status,
    });
  }

  revalidatePath("/tasks");
  return { success: true, data: { id } };
}

export async function deleteTask(id: string): Promise<Result<{ id: string }>> {
  if (!id) return { success: false, error: "מזהה חסר" };

  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "לא מחובר" };

  // RLS already restricts to owner.
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/tasks");
  return { success: true, data: { id } };
}

export async function updateTaskStatus(
  id: string,
  status: "todo" | "doing" | "done",
): Promise<Result<{ id: string }>> {
  if (!id) return { success: false, error: "מזהה חסר" };

  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/tasks");
  return { success: true, data: { id } };
}
