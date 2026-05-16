"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { taskSchema, type TaskInput } from "@/lib/tasks";

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
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
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

  const payload = toPayload(parsed.data);
  // RLS already restricts to owner or assignee, but the .update() call needs to match a row.
  const { error } = await supabase.from("tasks").update(payload).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
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
