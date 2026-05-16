"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, FileSpreadsheet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import type { DatasetOwner, DatasetRow } from "@/lib/datasets";

type Props = {
  dataset: DatasetRow;
  owner: DatasetOwner | null;
};

function ownerDisplayName(o: DatasetOwner | null): string {
  if (!o) return "—";
  return o.display_name?.trim() || o.full_name?.trim() || "—";
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/u).slice(0, 2);
  return (
    parts
      .map((p) => Array.from(p)[0] ?? "")
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?"
  );
}

export function DatasetCard({ dataset, owner }: Props) {
  const ownerName = ownerDisplayName(owner);

  return (
    <Link
      href={`/datasets/${dataset.id}`}
      className="group flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Database className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-display text-base font-bold text-slate-900 group-hover:text-brand-700"
            title={dataset.name}
          >
            {dataset.name}
          </h3>
          {dataset.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
              {dataset.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
          <Database className="h-3 w-3" />
          {dataset.row_count.toLocaleString("he-IL")} שורות
        </span>
        {dataset.source_filename && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
            title={dataset.source_filename}
          >
            <FileSpreadsheet className="h-3 w-3" />
            <span className="max-w-[10rem] truncate" dir="ltr">
              {dataset.source_filename}
            </span>
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 truncate">
          {owner?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={owner.avatar_url}
              alt=""
              className="h-5 w-5 shrink-0 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
              {initialsOf(ownerName)}
            </span>
          )}
          <span className="truncate">{ownerName}</span>
        </div>
        <RelativeUpdated iso={dataset.updated_at} />
      </div>
    </Link>
  );
}

function RelativeUpdated({ iso }: { iso: string }) {
  // Defer to client so the "X ago" anchor doesn't drift between SSR/CSR.
  const [text, setText] = useState<string>("");
  useEffect(() => {
    try {
      setText(
        formatDistanceToNow(new Date(iso), { addSuffix: true, locale: he }),
      );
    } catch {
      setText("");
    }
  }, [iso]);
  const fallback = (() => {
    try {
      return new Date(iso).toLocaleDateString("he-IL");
    } catch {
      return "—";
    }
  })();
  return <span suppressHydrationWarning>{text || fallback}</span>;
}
