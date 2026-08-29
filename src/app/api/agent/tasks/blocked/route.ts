// GET /api/agent/tasks/blocked — get_blocked_work (Team tier).
//
// The schema has no explicit "blocked" status (task_status is just
// todo/doing/done), so this defines "blocked" as the closest honest proxy:
// work someone already started (status = doing) that is now past its due
// date — i.e. actively in progress but stuck, as opposed to
// get_overdue_tasks which also includes untouched (todo) overdue work.

import { NextResponse } from "next/server";
import { requireCaller } from "@/lib/agent/respond";
import { createAgentServiceClient } from "@/lib/agent/auth";
import { AGENT_TASK_SELECT, todayIso } from "@/lib/agent/tasks-select";

export async function GET(request: Request) {
  const auth = await requireCaller(request);
  if ("error" in auth) return auth.error;

  const supabase = createAgentServiceClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(AGENT_TASK_SELECT)
    .eq("status", "doing")
    .lt("due_end", todayIso())
    .order("due_end", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    definition: "status=doing וגם עבר תאריך היעד (due_end)",
    tasks: data ?? [],
  });
}
