"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export async function createProject(
  input: CreateProjectInput,
): Promise<
  { success: true; id: string } | { success: false; error: string }
> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "פרטים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "שגיאה ביצירת פרויקט" };
  }

  revalidatePath("/gantt");
  return { success: true, id: data.id };
}

const updateTaskDatesSchema = z.object({
  taskId: z.string().uuid(),
  due_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  due_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  due_label: z.string().max(120).optional().nullable(),
});

export async function updateTaskDates(input: {
  taskId: string;
  due_start: string | null;
  due_end: string | null;
  due_label?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateTaskDatesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "תאריכים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const { error } = await supabase
    .from("tasks")
    .update({
      due_start: parsed.data.due_start,
      due_end: parsed.data.due_end,
      due_label: parsed.data.due_label ?? null,
    })
    .eq("id", parsed.data.taskId);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

const finalizeTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  due_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  due_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  due_label: z.string().max(120).optional().nullable(),
});

const finalizeImportSchema = z.object({
  projectName: z.string().min(1).max(200),
  projectDescription: z.string().max(2000).optional().nullable(),
  importId: z.string().uuid().optional().nullable(),
  tasks: z.array(finalizeTaskSchema).min(1),
});

export type FinalizeImportInput = z.infer<typeof finalizeImportSchema>;

export async function finalizeImport(
  input: FinalizeImportInput,
): Promise<
  { success: true; projectId: string } | { success: false; error: string }
> {
  const parsed = finalizeImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "נתוני ייבוא לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "לא מחובר" };

  // Compute project date range from tasks (if not specified).
  const validStarts = parsed.data.tasks
    .map((t) => t.due_start)
    .filter((d): d is string => !!d)
    .sort();
  const validEnds = parsed.data.tasks
    .map((t) => t.due_end)
    .filter((d): d is string => !!d)
    .sort();
  const projectStart = validStarts[0] ?? null;
  const projectEnd = validEnds[validEnds.length - 1] ?? null;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: parsed.data.projectName,
      description: parsed.data.projectDescription ?? null,
      start_date: projectStart,
      end_date: projectEnd,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return {
      success: false,
      error: projectError?.message ?? "שגיאה ביצירת פרויקט",
    };
  }

  const taskRows = parsed.data.tasks.map((t) => ({
    title: t.title,
    description: t.description ?? null,
    due_start: t.due_start,
    due_end: t.due_end,
    due_label: t.due_label ?? null,
    project_id: project.id,
    owner_id: user.id,
  }));

  const { error: tasksError } = await supabase.from("tasks").insert(taskRows);
  if (tasksError) {
    // Best-effort cleanup so we don't leave an empty project around.
    await supabase.from("projects").delete().eq("id", project.id);
    return { success: false, error: tasksError.message };
  }

  if (parsed.data.importId) {
    await supabase
      .from("gantt_imports")
      .update({ status: "done", project_id: project.id })
      .eq("id", parsed.data.importId);
  }

  revalidatePath("/gantt");
  revalidatePath(`/gantt/${project.id}`);
  return { success: true, projectId: project.id };
}
