"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSignedDownloadUrl } from "@/lib/storage";
import {
  GoogleAuthError,
  getValidAccessTokenForTeamDrive,
  trashFile,
  uploadFile,
} from "@/lib/google/drive";

// 20 MB matches next.config.ts serverActions.bodySizeLimit and the upload zone UX.
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  storage_path: z.string().min(3),
  mime_type: z.string().max(255).nullable().optional(),
  size: z.number().int().nonnegative().max(MAX_SIZE_BYTES).nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export type CreateDocumentInput = z.input<typeof createDocumentSchema>;

function adminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role env vars");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Pulls bytes back out of Supabase Storage so we can mirror the file into
 * Drive. Uses the service-role client because we may be operating from a
 * background context where the user's session cookie has expired.
 */
async function downloadFromStorage(
  db: SupabaseClient,
  storagePath: string,
): Promise<{ data: Blob; mimeType: string } | null> {
  const { data, error } = await db.storage
    .from("documents")
    .download(storagePath);
  if (error || !data) return null;
  return {
    data,
    mimeType: data.type || "application/octet-stream",
  };
}

/**
 * Fire-and-forget: upload a freshly-created document to the team Drive and
 * stamp the resulting metadata back onto the row. Silently skips when Drive
 * isn't connected (callers shouldn't fail just because Drive is offline).
 *
 * Runs one access-token refresh + retry on 401.
 */
async function mirrorToDrive(
  documentId: string,
  storagePath: string,
  fileName: string,
  mimeType: string,
): Promise<void> {
  const db = adminDb();

  // Bail early when Drive is not configured.
  const { data: cfg } = await db
    .from("team_config")
    .select("shared_drive_refresh_token, shared_drive_folder_id")
    .eq("id", 1)
    .maybeSingle();
  if (!cfg?.shared_drive_refresh_token || !cfg.shared_drive_folder_id) {
    return;
  }

  const folderId = cfg.shared_drive_folder_id;

  const downloaded = await downloadFromStorage(db, storagePath);
  if (!downloaded) {
    console.warn(
      `[drive-mirror] cannot read ${storagePath} from Supabase Storage`,
    );
    return;
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
        })
        .eq("id", documentId);
      if (upErr) {
        console.warn(
          `[drive-mirror] failed to write back drive metadata for ${documentId}:`,
          upErr.message,
        );
      }
      return;
    } catch (err) {
      if (err instanceof GoogleAuthError && attempt === 0) continue;
      console.warn(
        `[drive-mirror] upload failed for ${documentId}:`,
        err instanceof Error ? err.message : String(err),
      );
      return;
    }
  }
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<{ success: true; id: string } | { error: string }> {
  const parsed = createDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "פרטי מסמך לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "לא מחובר" };

  // The storage path must start with the user's id to satisfy bucket RLS.
  // Guard against a client passing someone else's prefix.
  const prefix = parsed.data.storage_path.split("/")[0];
  if (prefix !== user.id) {
    return { error: "נתיב אחסון לא תואם למשתמש" };
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      name: parsed.data.name,
      storage_path: parsed.data.storage_path,
      mime_type: parsed.data.mime_type ?? null,
      size: parsed.data.size ?? null,
      person_id: parsed.data.person_id ?? null,
      project_id: parsed.data.project_id ?? null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Best-effort cleanup of the uploaded object so we don't leak orphans.
    await supabase.storage
      .from("documents")
      .remove([parsed.data.storage_path])
      .catch(() => undefined);
    return { error: error?.message ?? "שמירת מסמך נכשלה" };
  }

  // Fire-and-forget Drive mirror — non-blocking so the user UX stays snappy.
  // Errors are logged but do not surface back to the client.
  const documentId = data.id;
  void mirrorToDrive(
    documentId,
    parsed.data.storage_path,
    parsed.data.name,
    parsed.data.mime_type ?? "application/octet-stream",
  );

  revalidatePath("/documents");
  return { success: true, id: documentId };
}

export async function deleteDocument(
  id: string,
): Promise<{ success: true } | { error: string }> {
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "מזהה לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "לא מחובר" };

  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("id, owner_id, storage_path, drive_file_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!doc) return { error: "מסמך לא נמצא" };
  if (doc.owner_id !== user.id) {
    return { error: "אין הרשאה למחוק מסמך זה" };
  }

  // Drive-only files (storage_path starts with "drive:") have no Supabase
  // Storage object to delete. Skip that step in that case.
  const isDriveOnly =
    typeof doc.storage_path === "string" && doc.storage_path.startsWith("drive:");

  if (!isDriveOnly) {
    // Delete storage object first; if it fails, surface the error and keep
    // the row so the user can retry rather than leaving a dangling DB row.
    const { error: storageErr } = await supabase.storage
      .from("documents")
      .remove([doc.storage_path]);

    if (storageErr) {
      return { error: storageErr.message };
    }
  }

  const { error: dbErr } = await supabase.from("documents").delete().eq("id", id);
  if (dbErr) return { error: dbErr.message };

  // Best-effort Drive trash. Failures are logged, not bubbled — the local
  // delete already succeeded and the next sync would also catch this.
  if (doc.drive_file_id) {
    void trashInDrive(doc.drive_file_id);
  }

  revalidatePath("/documents");
  return { success: true };
}

async function trashInDrive(driveFileId: string): Promise<void> {
  const db = adminDb();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const accessToken = await getValidAccessTokenForTeamDrive(
        db,
        attempt === 1,
      );
      await trashFile(accessToken, driveFileId);
      return;
    } catch (err) {
      if (err instanceof GoogleAuthError && attempt === 0) continue;
      console.warn(
        `[drive-trash] failed for ${driveFileId}:`,
        err instanceof Error ? err.message : String(err),
      );
      return;
    }
  }
}

export async function getDownloadUrl(
  id: string,
): Promise<
  | { url: string; name: string; driveWebViewLink: string | null }
  | { error: string }
> {
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "מזהה לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "לא מחובר" };

  const { data: doc, error } = await supabase
    .from("documents")
    .select("storage_path, name, drive_web_view_link")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!doc) return { error: "מסמך לא נמצא" };

  // Drive-only docs have no local copy — return the web link directly as
  // the "download" URL so the existing UI handler can still open it.
  if (
    typeof doc.storage_path === "string" &&
    doc.storage_path.startsWith("drive:")
  ) {
    if (!doc.drive_web_view_link) {
      return { error: "אין קישור להורדת מסמך זה" };
    }
    return {
      url: doc.drive_web_view_link,
      name: doc.name,
      driveWebViewLink: doc.drive_web_view_link,
    };
  }

  try {
    const url = await getSignedDownloadUrl(supabase, doc.storage_path);
    return {
      url,
      name: doc.name,
      driveWebViewLink: doc.drive_web_view_link ?? null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה ביצירת קישור" };
  }
}
