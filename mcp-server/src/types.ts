export type ProfileRef = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
} | null;

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  priority: "low" | "med" | "high";
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
  owner_id: string;
  assignee_id: string | null;
  person_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  assignee: ProfileRef;
  owner: ProfileRef;
  project: { id: string; name: string } | null;
};
