"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  DATASET_MAX_COLUMNS,
  DATASET_MAX_ROWS,
  type ColumnType,
} from "@/lib/datasets";

// Chunk size for the dataset_rows insert. 500 strikes a balance between
// round-trip count and Postgres's parameter limit (we send rows as JSONB
// objects, so the per-row parameter footprint is small).
const ROW_INSERT_CHUNK = 500;

const columnTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "boolean",
  "unknown",
]) satisfies z.ZodType<ColumnType>;

const columnDefSchema = z.object({
  key: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  type: columnTypeSchema,
  order: z.number().int().nonnegative(),
});

const createSchema = z.object({
  name: z.string().min(1, "נדרש שם").max(200, "עד 200 תווים"),
  description: z.string().max(2000).optional().nullable(),
  source_filename: z.string().max(500).optional().nullable(),
  columns_schema: z
    .array(columnDefSchema)
    .min(1, "אין עמודות")
    .max(DATASET_MAX_COLUMNS, `עד ${DATASET_MAX_COLUMNS} עמודות`),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .max(DATASET_MAX_ROWS, `עד ${DATASET_MAX_ROWS} שורות`),
});

export type CreateDatasetInput = z.input<typeof createSchema>;

type CreateResult = { success: true; id: string } | { error: string };
type MutateResult = { success: true; id: string } | { error: string };
type DeleteResult = { success: true } | { error: string };

export async function createDataset(
  input: CreateDatasetInput,
): Promise<CreateResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { name, description, source_filename, columns_schema, rows } =
    parsed.data;

  const { data: created, error: insertErr } = await supabase
    .from("datasets")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      source_filename: source_filename?.trim() || null,
      columns_schema,
      row_count: rows.length,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    return { error: insertErr?.message ?? "יצירת דאטהסט נכשלה" };
  }

  const datasetId = created.id;

  // Bulk insert rows in chunks. If any chunk fails we delete the dataset row
  // so we don't leave half-imported data lying around (cascade clears any
  // rows that did make it in).
  for (let i = 0; i < rows.length; i += ROW_INSERT_CHUNK) {
    const slice = rows.slice(i, i + ROW_INSERT_CHUNK);
    const payload = slice.map((data, idx) => ({
      dataset_id: datasetId,
      row_index: i + idx,
      data,
    }));
    const { error: rowErr } = await supabase
      .from("dataset_rows")
      .insert(payload);
    if (rowErr) {
      await supabase.from("datasets").delete().eq("id", datasetId);
      return { error: `שמירת שורות נכשלה: ${rowErr.message}` };
    }
  }

  revalidatePath("/datasets");
  revalidatePath(`/datasets/${datasetId}`);
  return { success: true, id: datasetId };
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  columns_schema: z
    .array(columnDefSchema)
    .min(1)
    .max(DATASET_MAX_COLUMNS)
    .optional(),
});

export type UpdateDatasetInput = z.input<typeof updateSchema>;

export async function updateDataset(
  id: string,
  input: UpdateDatasetInput,
): Promise<MutateResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "מזהה לא תקין" };
  }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description?.trim() || null;
  }
  if (parsed.data.columns_schema !== undefined) {
    patch.columns_schema = parsed.data.columns_schema;
  }
  if (Object.keys(patch).length === 0) return { success: true, id };

  // RLS on `datasets` already enforces owner-only update, but we double-check
  // here so we can return a friendlier Hebrew message instead of an empty
  // result row.
  const { data: existing } = await supabase
    .from("datasets")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "דאטהסט לא נמצא" };
  if (existing.owner_id !== user.id) return { error: "אין הרשאה לעדכן" };

  const { error } = await supabase.from("datasets").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/datasets");
  revalidatePath(`/datasets/${id}`);
  return { success: true, id };
}

export async function deleteDataset(id: string): Promise<DeleteResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "מזהה לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { data: existing } = await supabase
    .from("datasets")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "דאטהסט לא נמצא" };
  if (existing.owner_id !== user.id) return { error: "אין הרשאה למחוק" };

  const { error } = await supabase.from("datasets").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/datasets");
  return { success: true };
}

export async function deleteRow(rowId: string): Promise<DeleteResult> {
  if (!z.string().uuid().safeParse(rowId).success) {
    return { error: "מזהה לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  // Resolve dataset → check ownership in one query.
  const { data: row } = await supabase
    .from("dataset_rows")
    .select("id, dataset_id, datasets!inner(owner_id)")
    .eq("id", rowId)
    .maybeSingle();

  if (!row) return { error: "שורה לא נמצאה" };

  // The join returns the related dataset; pick out the owner.
  // Supabase types render this as an object or array depending on relation
  // cardinality — normalise both shapes.
  const related = (row as { datasets: { owner_id: string } | { owner_id: string }[] })
    .datasets;
  const ownerId = Array.isArray(related)
    ? related[0]?.owner_id
    : related?.owner_id;
  if (!ownerId) return { error: "שורה ללא דאטהסט" };
  if (ownerId !== user.id) return { error: "אין הרשאה למחוק" };

  const { error: delErr } = await supabase
    .from("dataset_rows")
    .delete()
    .eq("id", rowId);
  if (delErr) return { error: delErr.message };

  // Update the cached row_count on the parent dataset (best-effort).
  const datasetId = (row as { dataset_id: string }).dataset_id;
  const { count } = await supabase
    .from("dataset_rows")
    .select("id", { count: "exact", head: true })
    .eq("dataset_id", datasetId);
  if (typeof count === "number") {
    await supabase
      .from("datasets")
      .update({ row_count: count })
      .eq("id", datasetId);
  }

  revalidatePath(`/datasets/${datasetId}`);
  revalidatePath("/datasets");
  return { success: true };
}
