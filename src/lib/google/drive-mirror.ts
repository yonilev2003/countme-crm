// Shared "mirror one document to the team Google Drive" routine, used by both
// the create-time upload path (documents/actions.ts) and the background repair
// sweep (drive-sync.ts). Centralizing it keeps the writeback + status
// bookkeeping identical no matter who triggers the mirror.
//
// Server-only: relies on the service-role client and the team Drive refresh
// token. Never import from a client component (a type-only import is fine).

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GoogleAuthError,
  getValidAccessTokenForTeamDrive,
  uploadFile,
} from "./drive";

export type MirrorStatus = "synced" | "failed" | "skipped";

/**
 * Service-role Supabase client. Used because the mirror may run from a
 * background context (sweep) where no user session exists, and because it
 * needs to read the team Drive tokens out of `team_config`.
 */
export function adminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role env vars");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Pulls bytes back out of Supabase Storage so we can push them to Drive. */
async function downloadFromStorage(
  db: SupabaseClient,
  storagePath: string,
): Promise<{ data: Blob; mimeType: string } | null> {
  const { data, error } = await db.storage
    .from("documents")
    .download(storagePath);
  if (error || !data) return null;
  return { data, mimeType: data.type || "application/octet-stream" };
}

async function markFailed(
  db: SupabaseClient,
  documentId: string,
  error: string,
): Promise<void> {
  const { error: upErr } = await db
    .from("documents")
    .update({
      drive_sync_status: "failed",
      drive_sync_error: error.slice(0, 500),
    })
    .eq("id", documentId);
  if (upErr) {
    console.warn(
      `[drive-mirror] could not mark ${documentId} failed: ${upErr.message}`,
    );
  }
}

export type MirrorInput = {
  documentId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
};

/**
 * Uploads a single CRM document to the team Drive folder and stamps the
 * resulting metadata + sync status back onto the row. Never throws — always
 * resolves to a status the caller can surface or count:
 *   - "synced"  : file is in Drive, row updated, status='synced'
 *   - "failed"  : upload failed, row marked status='failed' with the error
 *   - "skipped" : Drive isn't connected — row left 'pending' for a later sweep
 *
 * Runs one access-token refresh + retry on 401.
 */
export async function mirrorDocumentToDrive(
  db: SupabaseClient,
  { documentId, storagePath, fileName, mimeType }: MirrorInput,
): Promise<MirrorStatus> {
  // Bail early when Drive is not configured — leave the row 'pending' so the
  // repair sweep picks it up once an admin connects Drive.
  const { data: cfg } = await db
    .from("team_config")
    .select("shared_drive_refresh_token, shared_drive_folder_id")
    .eq("id", 1)
    .maybeSingle();
  if (!cfg?.shared_drive_refresh_token || !cfg.shared_drive_folder_id) {
    return "skipped";
  }
  const folderId = cfg.shared_drive_folder_id;

  const downloaded = await downloadFromStorage(db, storagePath);
  if (!downloaded) {
    await markFailed(db, documentId, `cannot read ${storagePath} from Storage`);
    return "failed";
  }

  const effectiveMime = mimeType || downloaded.mimeType;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const accessToken = await getValidAccessTokenForTeamDrive(
        db,
        attempt === 1,
      );
      const file = await uploadFile(
        accessToken,
        folderId,
        fileName,
        effectiveMime,
        downloaded.data,
      );

      const { error: upErr } = await db
        .from("documents")
        .update({
          drive_file_id: file.id,
          drive_modified_time: file.modifiedTime
            ? new Date(file.modifiedTime).toISOString()
            : new Date().toISOString(),
          drive_web_view_link: file.webViewLink ?? null,
          drive_mime_type: file.mimeType ?? effectiveMime,
          drive_sync_status: "synced",
          drive_sync_error: null,
          drive_synced_at: new Date().toISOString(),
        })
        .eq("id", documentId);
      if (upErr) {
        // The bytes ARE in Drive but we failed to record it. Mark failed so the
        // sweep reconciles; in the (near-impossible) case the writeback keeps
        // failing this could leave a duplicate in Drive — an acceptable, easily
        // cleaned-up outcome for an internal tool.
        await markFailed(db, documentId, `writeback failed: ${upErr.message}`);
        return "failed";
      }
      return "synced";
    } catch (err) {
      if (err instanceof GoogleAuthError && attempt === 0) continue;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[drive-mirror] upload failed for ${documentId}: ${msg}`);
      await markFailed(db, documentId, msg);
      return "failed";
    }
  }
  return "failed";
}
