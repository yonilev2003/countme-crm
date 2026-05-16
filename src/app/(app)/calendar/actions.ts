"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncPersonal, syncTeam } from "@/lib/google/sync";

export type EventKind = "personal" | "team";

type CreateEventInput = {
  title: string;
  description?: string;
  start_at: string; // ISO
  end_at: string; // ISO
  kind: EventKind;
  person_id?: string | null;
  project_id?: string | null;
  attendee_profile_ids?: string[]; // only relevant when kind=team
};

type UpdateEventInput = Partial<Omit<CreateEventInput, "kind">> & {
  id: string;
};

function newLocalEtag(): string {
  return `local-${crypto.randomUUID()}`;
}

export async function createEvent(
  input: CreateEventInput,
): Promise<{ success: true; id: string } | { error: string }> {
  if (!input.title || input.title.trim().length < 1) {
    return { error: "כותרת חובה" };
  }
  if (!input.start_at || !input.end_at) {
    return { error: "יש להזין תאריך התחלה וסיום" };
  }
  if (new Date(input.end_at) <= new Date(input.start_at)) {
    return { error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  // Only admins can create team events (v1 policy).
  if (input.kind === "team") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_admin) {
      return { error: "רק אדמין יכול ליצור אירועי צוות" };
    }
  }

  const { data: inserted, error } = await supabase
    .from("events")
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      start_at: input.start_at,
      end_at: input.end_at,
      kind: input.kind,
      person_id: input.person_id ?? null,
      project_id: input.project_id ?? null,
      owner_id: user.id,
      local_updated_at: new Date().toISOString(),
      local_etag: newLocalEtag(),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "שגיאה ביצירת אירוע" };
  }

  // Attendees (team events only)
  if (input.kind === "team" && input.attendee_profile_ids?.length) {
    const rows = input.attendee_profile_ids.map((pid) => ({
      event_id: inserted.id,
      profile_id: pid,
      response: "pending" as const,
    }));
    await supabase.from("event_attendees").insert(rows);
  }

  revalidatePath("/calendar");
  return { success: true, id: inserted.id };
}

export async function updateEvent(
  input: UpdateEventInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const patch: Record<string, unknown> = {
    local_updated_at: new Date().toISOString(),
    local_etag: newLocalEtag(),
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.start_at !== undefined) patch.start_at = input.start_at;
  if (input.end_at !== undefined) patch.end_at = input.end_at;
  if (input.person_id !== undefined) patch.person_id = input.person_id;
  if (input.project_id !== undefined) patch.project_id = input.project_id;

  if (input.start_at && input.end_at) {
    if (new Date(input.end_at) <= new Date(input.start_at)) {
      return { error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" };
    }
  }

  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", input.id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // Replace attendees if provided
  if (input.attendee_profile_ids) {
    await supabase.from("event_attendees").delete().eq("event_id", input.id);
    if (input.attendee_profile_ids.length) {
      const rows = input.attendee_profile_ids.map((pid) => ({
        event_id: input.id,
        profile_id: pid,
        response: "pending" as const,
      }));
      await supabase.from("event_attendees").insert(rows);
    }
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteEvent(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return { success: true };
}

/**
 * Triggers a bidirectional sync from the server side. Calls the sync engine
 * lib functions directly (no HTTP round-trip) so we keep the user's session
 * context for personal sync.
 */
export async function requestSync(
  kind: "personal" | "team" | "both" = "both",
): Promise<{
  pulled: number;
  pushed: number;
  deleted: number;
  conflicts: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { pulled: 0, pushed: 0, deleted: 0, conflicts: 0, errors: ["unauthorized"] };
  }

  const errors: string[] = [];
  let pulled = 0;
  let pushed = 0;
  let deleted = 0;
  let conflicts = 0;

  if (kind === "personal" || kind === "both") {
    try {
      const r = await syncPersonal(user.id, supabase);
      pulled += r.pulled;
      pushed += r.pushed;
      deleted += r.deleted;
      conflicts += r.conflicts;
    } catch (err) {
      errors.push(`אישי: ${err instanceof Error ? err.message : "שגיאה"}`);
    }
  }

  if (kind === "team" || kind === "both") {
    try {
      const r = await syncTeam(user.id);
      pulled += r.pulled;
      pushed += r.pushed;
      deleted += r.deleted;
      conflicts += r.conflicts;
    } catch (err) {
      errors.push(`צוות: ${err instanceof Error ? err.message : "שגיאה"}`);
    }
  }

  revalidatePath("/calendar");
  return { pulled, pushed, deleted, conflicts, errors };
}
