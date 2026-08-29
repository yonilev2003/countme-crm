// Shared select shape for agent task responses — enough for an LLM to
// present a task usefully (who, what, when) without a second round trip.
export const AGENT_TASK_SELECT = `
  id, title, description, status, priority,
  due_start, due_end, due_label,
  owner_id, assignee_id, person_id, project_id,
  created_at, updated_at,
  assignee:assignee_id ( id, email, display_name, full_name ),
  owner:owner_id ( id, email, display_name, full_name ),
  project:project_id ( id, name )
`;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
