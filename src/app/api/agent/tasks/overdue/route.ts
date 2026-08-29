// GET /api/agent/tasks/overdue — get_overdue_tasks.
// Personal tier by default (your own overdue tasks). ?scope=team requires
// admin and returns overdue tasks across the whole team.

import { NextResponse } from "next/server";
import { requireCaller, forbidden } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT, todayIso } from "@/lib/agent/tasks-select";

export async function GET(request: Request) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  const { caller } = auth;

  const scope = new URL(request.url).searchParams.get("scope") ?? "self";
  if (scope === "team" && !caller.isAdmin) {
    return forbidden("צפייה בכל הצוות דורשת הרשאת אדמין");
  }

  const supabase = createAgentServiceClient();
  let query = supabase
    .from("tasks")
    .select(AGENT_TASK_SELECT)
    .neq("status", "done")
    .lt("due_end", todayIso())
    .order("due_end", { ascending: true });

  if (scope !== "team") query = query.eq("assignee_id", caller.userId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ scope, tasks: data ?? [] });
}
