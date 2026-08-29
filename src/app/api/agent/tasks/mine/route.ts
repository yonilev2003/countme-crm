// GET /api/agent/tasks/mine — get_my_tasks (Personal tier).
// Query: ?include_done=true to also return completed tasks.

import { NextResponse } from "next/server";
import { requireCaller } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT } from "@/lib/agent/tasks-select";

export async function GET(request: Request) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;
  const { caller } = auth;

  const includeDone =
    new URL(request.url).searchParams.get("include_done") === "true";

  const supabase = createAgentServiceClient();
  let query = supabase
    .from("tasks")
    .select(AGENT_TASK_SELECT)
    .eq("assignee_id", caller.userId)
    .order("due_end", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (!includeDone) query = query.neq("status", "done");

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data ?? [] });
}
