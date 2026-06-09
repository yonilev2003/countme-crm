// Bidirectional Google Drive sync for the documents module. Idempotent — the
// second run in a row should be a near-no-op.
//
// Reconciliation rules:
//  - Drive → CRM: every file in the designated folder is upserted into the
//    documents table by drive_file_id. Newly-discovered files (added in Drive
//    directly) get an INSERT with a synthetic storage_path of
//    `drive:${drive_file_id}` (they live only in Drive — there is no
//    Supabase Storage copy by design).
//  - CRM → Drive: rows that already have a drive_file_id but vanished from
//    the Drive listing are treated as Drive-side deletes and removed from
//    the CRM table. (CRM-side deletes are pushed at delete-time from
//    actions.ts via trashFile, so we don't need a push pass here.)
//  - Trashed files in Drive are treated identically to missing — we drop the
//    matching CRM row.
//
// Use the service-role client throughout so RLS doesn't block writes the
// trigger user wouldn't normally be allowed to make (e.g., inserting a row
// owned by a different admin).

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GoogleAuthError,
  getValidAccessTokenForTeamDrive,
  listFolderContents,
  type DriveFile,
} from "./drive";
import { mirrorDocumentToDrive } from "./drive-mirror";

// Per-sweep cap on CRM → Drive repair uploads. Keeps a single sync run bounded;
// the recurring interval drains any remaining backlog over subsequent runs.
const REPAIR_BATCH = 25;

export type DriveSyncResult = {
  pulled: number;
  pushed: number;
  deleted: number;
  errors: string[];
};

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role env vars");
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Returns the profile id of the first admin in the system, used as the
 * owner_id for documents that originated in Drive (no obvious CRM owner).
 */
async function firstAdminId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Lists every file in the configured Drive folder, handling pagination.
 * Returns a flat array — folder sizes for an internal CRM stay well under
 * what a single in-memory walk can handle.
 */
async function listAllFolderFiles(
  accessToken: string,
  folderId: string,
): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const page = await listFolderContents(accessToken, folderId, pageToken);
    out.push(...page.files);
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

/**
 * Drive byte counts arrive as strings (or are absent for Google-native types).
 * Parse defensively to a number, returning null when unknown.
 */
function parseSize(size: string | undefined): number | null {
  if (!size) return null;
  const n = Number(size);
  return Number.isFinite(n) ? n : null;
}

/**
 * One-shot retry on 401 by forcing an access-token refresh. Mirrors the
 * calendar sync's syncTeam pattern.
 */
export async function syncDocumentsWithDrive(): Promise<DriveSyncResult> {
  let force = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await syncOnce(force);
    } catch (err) {
      if (err instanceof GoogleAuthError && attempt === 0) {
        force = true;
        continue;
      }
      throw err;
    }
  }
  throw new Error("syncDocumentsWithDrive: exhausted retries");
}

async function syncOnce(forceRefresh: boolean): Promise<DriveSyncResult> {
  const db = adminClient();
  const errors: string[] = [];
  let pulled = 0;
  let deleted = 0;
  let pushed = 0; // CRM → Drive repair uploads, counted in the pass below

  // Load Drive config (folder + token will be checked inside the helper).
  const { data: cfg, error: cfgErr } = await db
    .from("team_config")
    .select("shared_drive_folder_id")
    .eq("id", 1)
    .maybeSingle();
  if (cfgErr) {
    throw new Error(`Failed to load team_config: ${cfgErr.message}`);
  }
  if (!cfg?.shared_drive_folder_id) {
    throw new Error(
      "Drive folder not configured; reconnect via /admin/drive",
    );
  }

  const folderId = cfg.shared_drive_folder_id;
  const accessToken = await getValidAccessTokenForTeamDrive(db, forceRefresh);

  // Walk Drive
  const driveFiles = await listAllFolderFiles(accessToken, folderId);

  // Look up the fallback owner once — used when a Drive file has no CRM row yet.
  let fallbackOwnerId: string | null = null;
  const seenDriveIds = new Set<string>();

  for (const file of driveFiles) {
    if (!file.id) continue;

    // Trashed files: treat like deletes — remove the matching CRM row.
    if (file.trashed) {
      const { error: delErr } = await db
        .from("documents")
        .delete()
        .eq("drive_file_id", file.id);
      if (delErr) {
        errors.push(`delete trashed ${file.id}: ${delErr.message}`);
      } else {
        deleted += 1;
      }
      continue;
    }

    seenDriveIds.add(file.id);

    const { data: existing, error: lookupErr } = await db
      .from("documents")
      .select("id, drive_modified_time")
      .eq("drive_file_id", file.id)
      .maybeSingle();

    if (lookupErr) {
      errors.push(`lookup ${file.id}: ${lookupErr.message}`);
      continue;
    }

    const driveModified = new Date(file.modifiedTime).toISOString();

    if (existing?.id) {
      // Only touch the row when Drive's modifiedTime actually changed —
      // keeps the sync cheap when nothing has happened upstream. We compare
      // by ISO equality after both sides are normalized.
      const localModified = existing.drive_modified_time
        ? new Date(existing.drive_modified_time).toISOString()
        : null;
      if (localModified === driveModified) continue;

      const { error: upErr } = await db
        .from("documents")
        .update({
          name: file.name,
          mime_type: file.mimeType,
          drive_mime_type: file.mimeType,
          size: parseSize(file.size),
          drive_modified_time: driveModified,
          drive_web_view_link: file.webViewLink ?? null,
          // Seeing the file live in Drive confirms it's synced.
          drive_sync_status: "synced",
          drive_synced_at: driveModified,
        })
        .eq("id", existing.id);
      if (upErr) {
        errors.push(`update ${file.id}: ${upErr.message}`);
      } else {
        pulled += 1;
      }
      continue;
    }

    // No matching row → this file was created directly in Drive. Insert.
    if (!fallbackOwnerId) {
      fallbackOwnerId = await firstAdminId(db);
    }
    if (!fallbackOwnerId) {
      errors.push(
        "no admin profile to own Drive-imported file " + file.name,
      );
      continue;
    }

    const { error: insErr } = await db.from("documents").insert({
      name: file.name,
      // Files that live only in Drive get a synthetic storage_path so that
      // the NOT NULL + UNIQUE constraints stay satisfied. Anything starting
      // with `drive:` is understood by the UI as "no local copy".
      storage_path: `drive:${file.id}`,
      mime_type: file.mimeType,
      size: parseSize(file.size),
      owner_id: fallbackOwnerId,
      drive_file_id: file.id,
      drive_modified_time: driveModified,
      drive_web_view_link: file.webViewLink ?? null,
      drive_mime_type: file.mimeType,
      // Originated in Drive → already synced by definition.
      drive_sync_status: "synced",
      drive_synced_at: driveModified,
    });
    if (insErr) {
      errors.push(`insert ${file.id}: ${insErr.message}`);
    } else {
      pulled += 1;
    }
  }

  // Drive-side deletes: rows that still hold a drive_file_id but no longer
  // appear in the live Drive listing.
  const { data: trackedRows, error: listErr } = await db
    .from("documents")
    .select("id, drive_file_id, storage_path")
    .not("drive_file_id", "is", null);
  if (listErr) {
    errors.push(`list tracked: ${listErr.message}`);
  } else {
    for (const row of trackedRows ?? []) {
      if (!row.drive_file_id) continue;
      if (seenDriveIds.has(row.drive_file_id)) continue;

      // Drive-only doc (no Supabase Storage copy): drop the row outright.
      // CRM-managed doc with storage backing: still drop the row — the user
      // removed it from Drive, so the sync intent is "this is gone".
      const { error: delErr } = await db
        .from("documents")
        .delete()
        .eq("id", row.id);
      if (delErr) {
        errors.push(`delete missing ${row.drive_file_id}: ${delErr.message}`);
      } else {
        deleted += 1;
      }
    }
  }

  // Repair pass (CRM → Drive): re-push any CRM-backed file that still hasn't
  // reached Drive — a create-time mirror that failed, was dropped when the
  // serverless instance froze, or ran while Drive was disconnected. Drive-only
  // rows (storage_path 'drive:...') have no local bytes to push, so skip them.
  const { data: needPush, error: needErr } = await db
    .from("documents")
    .select("id, name, storage_path, mime_type")
    .in("drive_sync_status", ["pending", "failed"])
    .not("storage_path", "like", "drive:%")
    .limit(REPAIR_BATCH);
  if (needErr) {
    errors.push(`list pending push: ${needErr.message}`);
  } else {
    for (const row of needPush ?? []) {
      const status = await mirrorDocumentToDrive(db, {
        documentId: row.id,
        storagePath: row.storage_path,
        fileName: row.name,
        mimeType: row.mime_type ?? "application/octet-stream",
      });
      if (status === "synced") {
        pushed += 1;
      } else if (status === "failed") {
        errors.push(`push ${row.id} failed`);
      }
      // "skipped" can't happen here (Drive is connected if we got this far).
    }
  }

  // Stamp last-sync timestamp on the singleton.
  const { error: stampErr } = await db
    .from("team_config")
    .update({ shared_drive_last_sync: new Date().toISOString() })
    .eq("id", 1);
  if (stampErr) {
    errors.push(`stamp last_sync: ${stampErr.message}`);
  }

  return { pulled, pushed, deleted, errors };
}
