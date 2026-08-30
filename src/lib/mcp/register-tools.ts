// Registers the same 12 CountMe operations as mcp-server/ (the local
// stdio server), but for the remote Streamable HTTP endpoint at
// /api/mcp. Each tool calls the already-shipped, already-reviewed
// /api/agent/* REST routes internally — no business logic lives here,
// only the MCP tool schema/description wrapper. See docs/agent-api.md
// for the one HTTP contract both wrap.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { agentApiRequest, describeMcpError } from "./client";

type Ctx = { baseUrl: string; token: string };

function textResult(text: string, structuredContent?: object) {
  const base = { content: [{ type: "text" as const, text }] };
  return structuredContent
    ? { ...base, structuredContent: structuredContent as Record<string, unknown> }
    : base;
}
function errorResult(error: unknown) {
  return { content: [{ type: "text" as const, text: describeMcpError(error) }], isError: true };
}

// Minimal shape used just for the human-readable summary line.
type TaskLike = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_end: string | null;
  due_label: string | null;
  assignee?: { display_name?: string | null; full_name?: string | null; email?: string | null } | null;
};

function taskLine(t: TaskLike): string {
  const who = t.assignee?.display_name || t.assignee?.full_name || t.assignee?.email || "לא משויך";
  const due = t.due_label || t.due_end || "ללא תאריך";
  return `- [${t.status}/${t.priority}] ${t.title} — ${who} — יעד: ${due} (id: ${t.id})`;
}
function renderTasks(tasks: TaskLike[], empty: string): string {
  return tasks.length === 0 ? empty : tasks.map(taskLine).join("\n");
}

export function registerCountMeTools(server: McpServer, ctx: Ctx): void {
  const { baseUrl, token } = ctx;
  const call = <T>(path: string, init?: Parameters<typeof agentApiRequest>[3]) =>
    agentApiRequest<T>(baseUrl, token, path, init);

  server.registerTool(
    "countme_get_my_tasks",
    {
      title: "My Open Tasks",
      description:
        "Get the caller's own CountMe tasks, ordered by due date.\n\nArgs:\n  - include_done (boolean, default false)",
      inputSchema: { include_done: z.boolean().default(false) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ include_done }) => {
      try {
        const data = await call<{ tasks: TaskLike[] }>(`/api/agent/tasks/mine?include_done=${include_done}`);
        return textResult(renderTasks(data.tasks, "אין משימות פתוחות."), data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_get_overdue_tasks",
    {
      title: "Overdue Tasks",
      description:
        "Get tasks past their due date that aren't done.\n\nArgs:\n  - scope ('self'|'team', default 'self') — 'team' requires admin.",
      inputSchema: { scope: z.enum(["self", "team"]).default("self") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ scope }) => {
      try {
        const data = await call<{ tasks: TaskLike[] }>(`/api/agent/tasks/overdue?scope=${scope}`);
        return textResult(renderTasks(data.tasks, "אין משימות באיחור."), data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_get_unassigned_tasks",
    {
      title: "Unassigned Tasks",
      description: "Get open tasks with no assignee (team-visible).",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await call<{ tasks: TaskLike[] }>("/api/agent/tasks/unassigned");
        return textResult(renderTasks(data.tasks, "אין משימות ללא שיוך."), data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_get_blocked_work",
    {
      title: "Blocked Work",
      description: "Get tasks that are in progress (doing) but already past due — team-visible.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await call<{ tasks: TaskLike[] }>("/api/agent/tasks/blocked");
        return textResult(renderTasks(data.tasks, "אין עבודה תקועה כרגע."), data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_get_team_overview",
    {
      title: "Team Overview",
      description: "Per-person open/overdue/done task counts across the team.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await call<{
          team: { user_id: string; name: string | null; is_admin: boolean; open_tasks: number; overdue_tasks: number; done_tasks: number }[];
          unassigned_open_tasks: number;
        }>("/api/agent/team/overview");
        const lines = data.team.map(
          (m) => `- ${m.name}${m.is_admin ? " (admin)" : ""}: ${m.open_tasks} פתוחות, ${m.overdue_tasks} באיחור, ${m.done_tasks} הושלמו (id: ${m.user_id})`,
        );
        lines.push(`ללא שיוך: ${data.unassigned_open_tasks}`);
        return textResult(lines.join("\n"), data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_get_project_status",
    {
      title: "Project Status",
      description: "Task breakdown and open tasks for one project.\n\nArgs:\n  - project_id (uuid, required)",
      inputSchema: { project_id: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ project_id }) => {
      try {
        const data = await call<{
          project: { name: string };
          task_counts: { todo: number; doing: number; done: number };
          open_tasks: TaskLike[];
        }>(`/api/agent/projects/${project_id}/status`);
        const c = data.task_counts;
        return textResult(
          `פרויקט: ${data.project.name}\nמשימות: ${c.todo} לעשות, ${c.doing} בביצוע, ${c.done} הושלמו\nפתוחות: ${data.open_tasks.length}`,
          data,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_get_user_activity",
    {
      title: "User Activity",
      description: "A team member's recent task activity (self, or anyone if admin).\n\nArgs:\n  - user_id (uuid, required)",
      inputSchema: { user_id: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ user_id }) => {
      try {
        const data = await call<{
          profile: { email: string | null; display_name: string | null };
          counts: { open: number; overdue: number; done: number };
        }>(`/api/agent/users/${user_id}/activity`);
        const p = data.profile;
        return textResult(
          `${p.display_name || p.email}: ${data.counts.open} פתוחות, ${data.counts.overdue} באיחור, ${data.counts.done} הושלמו`,
          data,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_get_system_health",
    {
      title: "System Health",
      description: "CTO-level snapshot of users/projects/tasks (admin only).",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await call<{
          users: number; projects: number; people: number;
          tasks: { total: number; todo: number; doing: number; done: number; overdue: number; unassigned: number };
        }>("/api/agent/system/health");
        const t = data.tasks;
        return textResult(
          `משתמשים: ${data.users} | פרויקטים: ${data.projects} | אנשים: ${data.people}\nמשימות: ${t.total} סה"כ — ${t.todo} לעשות, ${t.doing} בביצוע, ${t.done} הושלמו, ${t.overdue} באיחור, ${t.unassigned} ללא שיוך`,
          data,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_create_task",
    {
      title: "Create Task",
      description:
        "Create a new CountMe task. Assigning to someone else (assignee_id != caller) requires admin.\n\nArgs:\n  - title (required), description, due_start, due_end, due_label, priority (default med), status (default todo), assignee_id, project_id, person_id",
      inputSchema: {
        title: z.string().min(2).max(200),
        description: z.string().max(5000).optional(),
        due_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        due_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        due_label: z.string().max(80).optional(),
        priority: z.enum(["low", "med", "high"]).default("med"),
        status: z.enum(["todo", "doing", "done"]).default("todo"),
        assignee_id: z.string().uuid().optional(),
        project_id: z.string().uuid().optional(),
        person_id: z.string().uuid().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const data = await call<{ task: TaskLike }>("/api/agent/tasks", { method: "POST", body: input });
        return textResult(`נוצרה משימה: ${taskLine(data.task)}`, data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_update_task",
    {
      title: "Update Task",
      description:
        "Update fields on an existing task (not the assignee — use countme_assign_task).\n\nArgs:\n  - task_id (required) + any subset of title/description/due_start/due_end/due_label/status/priority",
      inputSchema: {
        task_id: z.string().uuid(),
        title: z.string().min(2).max(200).optional(),
        description: z.string().max(5000).nullable().optional(),
        due_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        due_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        due_label: z.string().max(80).nullable().optional(),
        status: z.enum(["todo", "doing", "done"]).optional(),
        priority: z.enum(["low", "med", "high"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ task_id, ...patch }) => {
      try {
        const data = await call<{ task: TaskLike }>(`/api/agent/tasks/${task_id}`, { method: "PATCH", body: patch });
        return textResult(`עודכן: ${taskLine(data.task)}`, data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_assign_task",
    {
      title: "Assign Task",
      description:
        "Reassign a task (or unassign with assignee_id=null). Only the task's owner or an admin may do this; emails the new assignee.\n\nArgs:\n  - task_id (required), assignee_id (uuid or null)",
      inputSchema: { task_id: z.string().uuid(), assignee_id: z.string().uuid().nullable() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ task_id, assignee_id }) => {
      try {
        const data = await call<{ task: TaskLike }>(`/api/agent/tasks/${task_id}/assign`, {
          method: "POST",
          body: { assignee_id },
        });
        return textResult(`שויך מחדש: ${taskLine(data.task)}`, data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    "countme_complete_task",
    {
      title: "Complete Task",
      description: "Mark a task as done (assignee, owner, or admin).\n\nArgs:\n  - task_id (required)",
      inputSchema: { task_id: z.string().uuid() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ task_id }) => {
      try {
        const data = await call<{ task: TaskLike }>(`/api/agent/tasks/${task_id}/complete`, { method: "POST" });
        return textResult(`הושלם: ${taskLine(data.task)}`, data);
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
