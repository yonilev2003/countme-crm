"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/storage";
import {
  GoogleAuthError,
  getValidAccessTokenForTeamDrive,
  trashFile,
} from "@/lib/google/drive";
import {
  adminDb,
  mirrorDocumentToDrive,
  type MirrorStatus,
} from "@/lib/google/drive-mirror";

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

export async function createDocument(
  input: CreateDocumentInput,
): Promise<{ success: true; id: string; drive: MirrorStatus } | { error: string }> {
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

  // Mirror to Drive synchronously so the caller learns whether the file
  // actually reached Drive (immediate verification). The helper never throws
  // and marks the row 'failed'/'pending' on any problem, so a slow or failed
  // Drive upload can't break the save — the background sweep repairs it.
  const documentId = data.id;
  const drive = await mirrorDocumentToDrive(adminDb(), {
    documentId,
    storagePath: parsed.data.storage_path,
    fileName: parsed.data.name,
    mimeType: parsed.data.mime_type ?? "application/octet-stream",
  });

  revalidatePath("/documents");
  return { success: true, id: documentId, drive };
}

/**
 * Manually re-attempts the Drive mirror for a single document. Used by the
 * "retry" affordance on a card whose create-time mirror failed. Owner-only.
 */
export async function retryDriveSync(
  id: string,
): Promise<{ status: MirrorStatus } | { error: string }> {
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
    .select("id, owner_id, name, storage_path, mime_type")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!doc) return { error: "מסמך לא נמצא" };
  if (doc.owner_id !== user.id) {
    return { error: "אין הרשאה לסנכרן מסמך זה" };
  }
  if (
    typeof doc.storage_path === "string" &&
    doc.storage_path.startsWith("drive:")
  ) {
    return { error: "מסמך זה קיים רק ב-Drive" };
  }

  const status = await mirrorDocumentToDrive(adminDb(), {
    documentId: doc.id,
    storagePath: doc.storage_path,
    fileName: doc.name,
    mimeType: doc.mime_type ?? "application/octet-stream",
  });

  revalidatePath("/documents");
  return { status };
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
