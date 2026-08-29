// GET /api/agent/system/health — get_system_health (Admin/CTO tier).
// A richer, authenticated sibling of the public /api/health keep-alive
// probe: counts an admin actually cares about for a CTO briefing.

import { NextResponse } from "next/server";
import { requireCaller, forbidden } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { todayIso } from "@/lib/agent/tasks-select";

export async function GET(request: Request) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  if (!auth.caller.isAdmin) return forbidden("בריאות המערכת דורשת הרשאת אדמין");

  const supabase = createAgentServiceClient();
  const [{ count: userCount }, { count: projectCount }, { count: peopleCount }, { data: tasks }] =
    await Promise.all([
      supabase.from("profiles").select("id", { head: true, count: "exact" }),
      supabase.from("projects").select("id", { head: true, count: "exact" }),
      supabase.from("people").select("id", { head: true, count: "exact" }),
      supabase.from("tasks").select("status, due_end, assignee_id"),
    ]);

  const today = todayIso();
  const rows = tasks ?? [];

  return NextResponse.json({
    ok: true,
    users: userCount ?? 0,
    projects: projectCount ?? 0,
    people: peopleCount ?? 0,
    tasks: {
      total: rows.length,
      todo: rows.filter((t) => t.status === "todo").length,
      doing: rows.filter((t) => t.status === "doing").length,
      done: rows.filter((t) => t.status === "done").length,
      overdue: rows.filter(
        (t) => t.status !== "done" && t.due_end !== null && t.due_end < today,
      ).length,
      unassigned: rows.filter((t) => t.assignee_id === null && t.status !== "done")
        .length,
    },
  });
}
