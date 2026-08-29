// Shared by the /tasks server actions and the /api/agent write operations —
// both create or reassign tasks and need the same "notify the new assignee
// by email" behavior. Never throws: a notification failure must not fail
// the task mutation itself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTaskAssignedEmail } from "@/lib/email";
import { formatDueRange } from "@/lib/dates";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";

type ProfileLookup = {
  email: string | null;
  display_name: string | null;
  full_name: string | null;
};

export function displayNameOf(p: ProfileLookup | null | undefined): string {
  return (
    p?.display_name?.trim() || p?.full_name?.trim() || p?.email?.trim() || "חבר/ת צוות"
  );
}

export async function notifyTaskAssigned(
  supabase: SupabaseClient,
  args: {
    callerId: string;
    assigneeId: string;
    taskTitle: string;
    taskDescription: string | null;
    dueStart: string | null;
    dueEnd: string | null;
    dueLabel: string | null;
    priority: TaskPriority;
    status: TaskStatus;
  },
): Promise<void> {
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, full_name")
      .in("id", [args.assigneeId, args.callerId]);

    const assignee = profiles?.find((p) => p.id === args.assigneeId) ?? null;
    const caller = profiles?.find((p) => p.id === args.callerId) ?? null;

    if (!assignee?.email) {
      console.warn("[email] assignee has no email — skipping task notification");
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const taskUrl = `${baseUrl}/tasks`;

    await sendTaskAssignedEmail({
      to: assignee.email,
      toName: displayNameOf(assignee),
      taskTitle: args.taskTitle,
      taskDescription: args.taskDescription,
      dueDisplay: formatDueRange(args.dueStart, args.dueEnd, args.dueLabel),
      priority: args.priority,
      status: args.status,
      assignedByName: displayNameOf(caller),
      taskUrl,
    });
  } catch (err) {
    console.error("[email] notifyTaskAssigned failed:", err);
  }
}
