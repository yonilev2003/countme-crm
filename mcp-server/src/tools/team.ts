import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { countmeRequest, describeError } from "../client.js";
import type { Task } from "../types.js";

type TeamMember = {
  user_id: string;
  name: string | null;
  is_admin: boolean;
  role: string | null;
  open_tasks: number;
  overdue_tasks: number;
  done_tasks: number;
};

export function registerTeamTools(server: McpServer): void {
  server.registerTool(
    "countme_get_team_overview",
    {
      title: "Team Overview",
      description: `Get a per-person summary of open, overdue, and done tasks across the whole CountMe team — the basis for a "what's my team up to" briefing.

Returns: one row per team member (with their user_id, for use with countme_get_user_activity or countme_assign_task) plus the count of unassigned open tasks.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await countmeRequest<{ team: TeamMember[]; unassigned_open_tasks: number }>(
          "/api/agent/team/overview",
        );
        const lines = data.team.map(
          (m) =>
            `- ${m.name}${m.is_admin ? " (admin)" : ""}: ${m.open_tasks} פתוחות, ${m.overdue_tasks} באיחור, ${m.done_tasks} הושלמו (id: ${m.user_id})`,
        );
        lines.push(`ללא שיוך: ${data.unassigned_open_tasks}`);
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: data };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_get_project_status",
    {
      title: "Project Status",
      description: `Get a project's task breakdown by status plus its still-open tasks.

Args:
  - project_id (uuid, required)`,
      inputSchema: {
        project_id: z.string().uuid(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ project_id }) => {
      try {
        const data = await countmeRequest<{
          project: { name: string; description: string | null };
          task_counts: { todo: number; doing: number; done: number };
          open_tasks: Task[];
        }>(`/api/agent/projects/${project_id}/status`);
        const c = data.task_counts;
        const text = `פרויקט: ${data.project.name}\nמשימות: ${c.todo} לעשות, ${c.doing} בביצוע, ${c.done} הושלמו\nפתוחות: ${data.open_tasks.length}`;
        return { content: [{ type: "text", text }], structuredContent: data };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_get_user_activity",
    {
      title: "User Activity",
      description: `Get a team member's recent task activity and open/overdue/done counts.

Args:
  - user_id (uuid, required): pass your own id, or (if you're an admin) anyone's — get ids from countme_get_team_overview.`,
      inputSchema: {
        user_id: z.string().uuid(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ user_id }) => {
      try {
        const data = await countmeRequest<{
          profile: { email: string | null; display_name: string | null; role: string | null };
          counts: { open: number; overdue: number; done: number };
          recent_tasks: Task[];
        }>(`/api/agent/users/${user_id}/activity`);
        const p = data.profile;
        const text = `${p.display_name || p.email}: ${data.counts.open} פתוחות, ${data.counts.overdue} באיחור, ${data.counts.done} הושלמו`;
        return { content: [{ type: "text", text }], structuredContent: data };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "countme_get_system_health",
    {
      title: "System Health",
      description:
        "Get a CTO-level snapshot of CountMe: user/project/people counts and task counts by status, overdue, and unassigned. Requires admin.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = await countmeRequest<{
          users: number;
          projects: number;
          people: number;
          tasks: {
            total: number;
            todo: number;
            doing: number;
            done: number;
            overdue: number;
            unassigned: number;
          };
        }>("/api/agent/system/health");
        const t = data.tasks;
        const text = `משתמשים: ${data.users} | פרויקטים: ${data.projects} | אנשים: ${data.people}\nמשימות: ${t.total} סה"כ — ${t.todo} לעשות, ${t.doing} בביצוע, ${t.done} הושלמו, ${t.overdue} באיחור, ${t.unassigned} ללא שיוך`;
        return { content: [{ type: "text", text }], structuredContent: data };
      } catch (error) {
        return { content: [{ type: "text", text: describeError(error) }], isError: true };
      }
    },
  );
}
