import { z } from "zod";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "med" | "high";

// ISO date string (YYYY-MM-DD) — sanity check; full validity is enforced by Postgres.
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const isoDateField = z
  .string()
  .regex(isoDateRegex, "תאריך לא תקין (צריך להיות YYYY-MM-DD)")
  .optional()
  .nullable();

export const taskSchema = z.object({
  title: z
    .string()
    .min(2, "כותרת חייבת לכלול לפחות 2 תווים")
    .max(200, "כותרת ארוכה מדי"),
  description: z.string().max(5000).optional().nullable(),
  due_start: isoDateField,
  due_end: isoDateField,
  due_label: z.string().max(80).optional().nullable(),
  status: z.enum(["todo", "doing", "done"]),
  priority: z.enum(["low", "med", "high"]),
  assignee_id: z.string().uuid().optional().nullable(),
  person_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
});

export type TaskInput = z.infer<typeof taskSchema>;

export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  person_id: string | null;
  project_id: string | null;
  owner_id: string;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS_HE: Record<TaskStatus, string> = {
  todo: "לעשות",
  doing: "בביצוע",
  done: "הושלם",
};

export const PRIORITY_LABELS_HE: Record<TaskPriority, string> = {
  low: "נמוכה",
  med: "בינונית",
  high: "גבוהה",
};

export const STATUS_ORDER: ReadonlyArray<TaskStatus> = ["todo", "doing", "done"];
export const PRIORITY_ORDER: ReadonlyArray<TaskPriority> = ["high", "med", "low"];

export const DEFAULT_TASK_INPUT: TaskInput = {
  title: "",
  description: null,
  due_start: null,
  due_end: null,
  due_label: null,
  status: "todo",
  priority: "med",
  assignee_id: null,
  person_id: null,
  project_id: null,
};
