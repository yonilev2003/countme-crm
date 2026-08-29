// GET /api/agent/tasks/unassigned — get_unassigned_tasks (Team tier).

import { NextResponse } from "next/server";
import { requireCaller } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT } from "@/lib/agent/tasks-select";

export async function GET(request: Request) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;

  const supabase = createAgentServiceClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(AGENT_TASK_SELECT)
    .is("assignee_id", null)
    .neq("status", "done")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data ?? [] });
}
