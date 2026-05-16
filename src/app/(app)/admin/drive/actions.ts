"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { syncDocumentsWithDrive } from "@/lib/google/drive-sync";

function adminDb() {
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

/**
 * Clears all Drive credentials and folder reference on the singleton config.
 * Does NOT delete files in Drive — those remain in the user's account.
 */
export async function disconnectTeamDrive(): Promise<
  { success: true } | { error: string }
> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const db = adminDb();
  const { error: upErr } = await db
    .from("team_config")
    .update({
      shared_drive_refresh_token: null,
      shared_drive_access_token: null,
      shared_drive_token_expires_at: null,
      shared_drive_folder_id: null,
      shared_drive_last_sync: null,
    })
    .eq("id", 1);

  if (upErr) return { error: upErr.message };

  revalidatePath("/admin/drive");
  revalidatePath("/documents");
  return { success: true };
}

/**
 * Runs a full Drive ↔ CRM reconciliation and returns the aggregate counts.
 */
export async function forceResyncTeamDrive(): Promise<
  { pulled: number; pushed: number; deleted: number; errors: string[] } | { error: string }
> {
  const { error } = await requireAdmin();
  if (error) return { error };

  try {
    const r = await syncDocumentsWithDrive();
    revalidatePath("/admin/drive");
    revalidatePath("/documents");
    return {
      pulled: r.pulled,
      pushed: r.pushed,
      deleted: r.deleted,
      errors: r.errors,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "שגיאה בסנכרון",
    };
  }
}
