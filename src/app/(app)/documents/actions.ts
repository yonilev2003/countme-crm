"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/storage";

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

  revalidatePath("/documents");
  return { success: true, id: data.id };
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
    .select("id, owner_id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!doc) return { error: "מסמך לא נמצא" };
  if (doc.owner_id !== user.id) {
    return { error: "אין הרשאה למחוק מסמך זה" };
  }

  // Delete storage object first; if it fails, surface the error and keep the row
  // so the user can retry rather than leaving a dangling DB row.
  const { error: storageErr } = await supabase.storage
    .from("documents")
    .remove([doc.storage_path]);

  if (storageErr) {
    return { error: storageErr.message };
  }

  const { error: dbErr } = await supabase.from("documents").delete().eq("id", id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/documents");
  return { success: true };
}

export async function getDownloadUrl(
  id: string,
): Promise<{ url: string; name: string } | { error: string }> {
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
    .select("storage_path, name")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!doc) return { error: "מסמך לא נמצא" };

  try {
    const url = await getSignedDownloadUrl(supabase, doc.storage_path);
    return { url, name: doc.name };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה ביצירת קישור" };
  }
}
