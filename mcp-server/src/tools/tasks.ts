import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { countmeRequest, describeError } from "../client.js";
import type { Task } from "../types.js";

function taskLine(t: Task): string {
  const who = t.assignee?.display_name || t.assignee?.full_name || t.assignee?.email || "לא משויך";
  const due = t.due_label || t.due_end || "ללא תאריך";
  return `- [${t.status}/${t.priority}] ${t.title} — ${who} — יעד: ${due} (id: ${t.id})`;
}

function renderTasks(tasks: Task[], emptyMessage: string): string {
  if (tasks.length === 0) return emptyMessage;
  return tasks.map(taskLine).join("\n");
}

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    "countme_get_my_tasks",
    {
      title: "My Open Tasks",
      description: `Get the caller's own CountMe tasks, ordered by due date.

Args:
  - include_done (boolean, default false): also include completed tasks

Returns: a list of tasks with status, priority, due date, and id. Use the id with countme_update_task or countme_complete_task.`,
      inputSchema: {
        include_done: z.boolean().default(false).describe("Also include completed tasks"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ include_done }) => {
      try {
        const data = await countmeRequest<{ tasks: Task[] }>(
          `/api/agent/tasks/mine?include_done=${include_done}`,
        );
        return {
          content: [{ type: "text", text: renderTasks(data.tasks, "אין משימות פתוחות.") }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_get_overdue_tasks",
    {
      title: "Overdue Tasks",
      description: `Get tasks past their due date that aren't done yet.

Args:
  - scope ('self' | 'team', default 'self'): 'team' returns overdue tasks for everyone and requires the caller to be an admin.

Returns: overdue tasks, most urgent first.`,
      inputSchema: {
        scope: z.enum(["self", "team"]).default("self"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ scope }) => {
      try {
        const data = await countmeRequest<{ tasks: Task[]; scope: string }>(
          `/api/agent/tasks/overdue?scope=${scope}`,
        );
        return {
          content: [{ type: "text", text: renderTasks(data.tasks, "אין משימות באיחור.") }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_get_unassigned_tasks",
    {
      title: "Unassigned Tasks",
      description: "Get open CountMe tasks that have no assignee yet. Team-visible.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await countmeRequest<{ tasks: Task[] }>("/api/agent/tasks/unassigned");
        return {
          content: [{ type: "text", text: renderTasks(data.tasks, "אין משימות ללא שיוך.") }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_get_blocked_work",
    {
      title: "Blocked Work",
      description:
        "Get tasks that are in progress (status=doing) but already past their due date — work that's stuck, not just untouched. Team-visible.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await countmeRequest<{ tasks: Task[]; definition: string }>(
          "/api/agent/tasks/blocked",
        );
        return {
          content: [{ type: "text", text: renderTasks(data.tasks, "אין עבודה תקועה כרגע.") }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_create_task",
    {
      title: "Create Task",
      description: `Create a new CountMe task.

Args:
  - title (string, required)
  - description, due_start, due_end, due_label (optional)
  - priority ('low'|'med'|'high', default 'med'), status (default 'todo')
  - assignee_id (uuid, optional): who the task is for. Defaults to the caller. Assigning to someone else requires the caller to be an admin — get their id from countme_get_team_overview first.
  - project_id, person_id (uuid, optional)

Returns: the created task, including its id.`,
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
        const data = await countmeRequest<{ task: Task }>("/api/agent/tasks", {
          method: "POST",
          body: input,
        });
        return {
          content: [{ type: "text", text: `נוצרה משימה: ${taskLine(data.task)}` }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_update_task",
    {
      title: "Update Task",
      description: `Update fields on an existing task (title, description, dates, status, priority). Does NOT reassign — use countme_assign_task for that.

Args:
  - task_id (uuid, required)
  - any subset of: title, description, due_start, due_end, due_label, status, priority

Returns: the updated task.`,
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
        const data = await countmeRequest<{ task: Task }>(`/api/agent/tasks/${task_id}`, {
          method: "PATCH",
          body: patch,
        });
        return {
          content: [{ type: "text", text: `עודכן: ${taskLine(data.task)}` }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_assign_task",
    {
      title: "Assign Task",
      description: `Reassign a task to someone else (or unassign with assignee_id=null). Sends the new assignee a notification email. Only the task's creator or an admin may do this.

Args:
  - task_id (uuid, required)
  - assignee_id (uuid or null)

Returns: the updated task.`,
      inputSchema: {
        task_id: z.string().uuid(),
        assignee_id: z.string().uuid().nullable(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ task_id, assignee_id }) => {
      try {
        const data = await countmeRequest<{ task: Task }>(`/api/agent/tasks/${task_id}/assign`, {
          method: "POST",
          body: { assignee_id },
        });
        return {
          content: [{ type: "text", text: `שויך מחדש: ${taskLine(data.task)}` }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_complete_task",
    {
      title: "Complete Task",
      description:
        "Mark a task as done. Allowed for the task's assignee, its creator, or an admin.\n\nArgs:\n  - task_id (uuid, required)",
      inputSchema: {
        task_id: z.string().uuid(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ task_id }) => {
      try {
        const data = await countmeRequest<{ task: Task }>(`/api/agent/tasks/${task_id}/complete`, {
          method: "POST",
        });
        return {
          content: [{ type: "text", text: `הושלם: ${taskLine(data.task)}` }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );
}
