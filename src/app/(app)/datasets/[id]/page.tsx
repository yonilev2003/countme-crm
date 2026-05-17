import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileSpreadsheet, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DatasetTable } from "@/components/datasets/dataset-table";
import {
  DATASET_MAX_ROWS,
  type ColumnDef,
  type DatasetDataRow,
  type DatasetOwner,
  type DatasetRow,
} from "@/lib/datasets";
import { DeleteDatasetButton } from "./delete-dataset-button";

// v1 caps server-side fetch at 10,000 rows. The wizard accepts up to 100,000
// for storage, but rendering a fully-client interactive table beyond 10k is
// the wrong UX — we'd move that to a paged server query in a future iteration.
const ROW_FETCH_LIMIT = 10_000;

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DatasetDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: datasetRow } = await supabase
    .from("datasets")
    .select(
      "id, name, description, source_filename, columns_schema, row_count, owner_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!datasetRow) notFound();

  // Normalise the JSONB columns_schema into our typed ColumnDef[]
  const rawCols = (datasetRow.columns_schema ?? []) as unknown;
  const columns: ColumnDef[] = Array.isArray(rawCols)
    ? (rawCols as ColumnDef[])
    : [];
  const dataset: DatasetRow = {
    ...(datasetRow as DatasetRow),
    columns_schema: columns,
  };

  const { data: rowsRes } = await supabase
    .from("dataset_rows")
    .select("id, dataset_id, row_index, data, created_at")
    .eq("dataset_id", id)
    .order("row_index", { ascending: true })
    .limit(ROW_FETCH_LIMIT);

  const rows = (rowsRes ?? []) as DatasetDataRow[];

  const { data: ownerRow } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, avatar_url")
    .eq("id", dataset.owner_id)
    .maybeSingle();
  const owner = (ownerRow ?? null) as DatasetOwner | null;

  const isOwner = Boolean(user && user.id === dataset.owner_id);
  const ownerName =
    owner?.display_name?.trim() || owner?.full_name?.trim() || "—";
  const truncated = dataset.row_count > rows.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link href="/datasets" className="hover:text-slate-700">
          דאטה
        </Link>
        <ChevronRight className="h-4 w-4 -scale-x-100" aria-hidden />
        <span className="text-slate-900">{dataset.name}</span>
      </nav>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {dataset.name}
            </h1>
            {dataset.description && (
              <p className="mt-1 text-sm text-slate-600">
                {dataset.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-slate-700">
                  {dataset.row_count.toLocaleString("he-IL")}
                </span>
                שורות · {dataset.columns_schema.length} עמודות
              </span>
              {dataset.source_filename && (
                <span className="inline-flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span dir="ltr">{dataset.source_filename}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {ownerName}
              </span>
            </div>
          </div>
          {isOwner && (
            <DeleteDatasetButton id={dataset.id} name={dataset.name} />
          )}
        </div>

        {truncated && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            מוצגות {rows.length.toLocaleString("he-IL")} שורות מתוך{" "}
            {dataset.row_count.toLocaleString("he-IL")} (מגבלת תצוגה{" "}
            {ROW_FETCH_LIMIT.toLocaleString("he-IL")} לעת עתה).
          </div>
        )}
        {dataset.row_count > DATASET_MAX_ROWS && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            הדאטהסט מכיל יותר מ־
            {DATASET_MAX_ROWS.toLocaleString("he-IL")} שורות — חלק מהפעולות עשויות
            להיות איטיות.
          </div>
        )}
      </div>

      <DatasetTable dataset={dataset} rows={rows} isOwner={isOwner} />
    </div>
  );
}

