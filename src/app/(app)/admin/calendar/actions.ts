"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { syncTeam } from "@/lib/google/sync";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role env vars");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" as const, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return { error: "אין הרשאה" as const, user: null };

  return { user, error: null };
}

export async function disconnectTeamCalendar(): Promise<
  { success: true } | { error: string }
> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const db = adminClient();
  const { error: upErr } = await db
    .from("team_config")
    .update({
      shared_calendar_email: null,
      shared_calendar_refresh_token: null,
      shared_calendar_access_token: null,
      shared_calendar_token_expires_at: null,
      shared_calendar_sync_token: null,
    })
    .eq("id", 1);

  if (upErr) return { error: upErr.message };

  revalidatePath("/admin/calendar");
  revalidatePath("/calendar");
  return { success: true };
}

export async function refreshTeamCalendarStatus(): Promise<
  { pulled: number; pushed: number; deleted: number; conflicts: number } | { error: string }
> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "אין הרשאה" };

  try {
    const r = await syncTeam(user.id);
    revalidatePath("/admin/calendar");
    revalidatePath("/calendar");
    return {
      pulled: r.pulled,
      pushed: r.pushed,
      deleted: r.deleted,
      conflicts: r.conflicts,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "שגיאה בסנכרון" };
  }
}
