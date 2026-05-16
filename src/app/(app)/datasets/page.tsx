import Link from "next/link";
import { Database, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DatasetCard } from "@/components/datasets/dataset-card";
import type { DatasetOwner, DatasetRow } from "@/lib/datasets";

export const dynamic = "force-dynamic";

export default async function DatasetsPage() {
  const supabase = await createClient();

  const [datasetsRes, profilesRes] = await Promise.all([
    supabase
      .from("datasets")
      .select(
        "id, name, description, source_filename, columns_schema, row_count, owner_id, created_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, full_name, avatar_url"),
  ]);

  const datasets = (datasetsRes.data ?? []) as DatasetRow[];
  const profiles = (profilesRes.data ?? []) as DatasetOwner[];
  const ownersById = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">דאטה</h1>
          <p className="mt-2 text-slate-600">
            דאטהסטים מיובאים מקבצי XLSX ו־CSV
          </p>
        </div>
        <Link
          href="/datasets/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          דאטהסט חדש
        </Link>
      </div>

      {datasets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((d) => (
            <DatasetCard
              key={d.id}
              dataset={d}
              owner={ownersById.get(d.owner_id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Database className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-slate-900">
        עדיין אין דאטהסטים
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        ייבא טבלה ראשונה מקובץ XLSX או CSV. נזהה את העמודות, נציע סוגים ונשמור
        את כל השורות לחיפוש וסינון.
      </p>
      <Link
        href="/datasets/new"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
      >
        <Plus className="h-4 w-4" />
        דאטהסט חדש
      </Link>
    </div>
  );
}
