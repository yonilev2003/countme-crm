"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  COLUMN_TYPE_CHIP,
  COLUMN_TYPE_LABELS_HE,
  type ColumnDef,
  type ColumnType,
  type DatasetDataRow,
  type DatasetRow,
} from "@/lib/datasets";
import { cn } from "@/lib/utils";
import { deleteRow } from "@/app/(app)/datasets/actions";

type SortDir = "asc" | "desc";

const PAGE_SIZE = 100;

type Props = {
  dataset: DatasetRow;
  rows: DatasetDataRow[];
  isOwner: boolean;
};

type ColumnFilter = {
  text?: string;
  numberMin?: string;
  numberMax?: string;
  dateMin?: string;
  dateMax?: string;
  boolean?: "true" | "false" | "";
};

export function DatasetTable({ dataset, rows, isOwner }: Props) {
  const columns = dataset.columns_schema;
  const [globalQuery, setGlobalQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  // Apply filters → returns rows that survive global search + per-column rules.
  const filtered = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    return rows.filter((r) => {
      // Global text search across text-typed columns
      if (q) {
        const textHaystack = columns
          .filter((c) => c.type === "text" || c.type === "unknown")
          .map((c) => {
            const v = r.data[c.key];
            return typeof v === "string" ? v.toLowerCase() : "";
          })
          .join(" ");
        if (!textHaystack.includes(q)) return false;
      }

      // Per-column filters
      for (const col of columns) {
        const f = filters[col.key];
        if (!f) continue;
        const v = r.data[col.key];
        if (col.type === "text" || col.type === "unknown") {
          if (f.text && f.text.trim()) {
            const needle = f.text.trim().toLowerCase();
            const hay =
              typeof v === "string" ? v.toLowerCase() : String(v ?? "").toLowerCase();
            if (!hay.includes(needle)) return false;
          }
        } else if (col.type === "number") {
          const num = typeof v === "number" ? v : null;
          if (f.numberMin && f.numberMin.trim() !== "") {
            const min = Number(f.numberMin);
            if (Number.isFinite(min) && (num === null || num < min)) return false;
          }
          if (f.numberMax && f.numberMax.trim() !== "") {
            const max = Number(f.numberMax);
            if (Number.isFinite(max) && (num === null || num > max)) return false;
          }
        } else if (col.type === "date") {
          const ds = typeof v === "string" ? v : null;
          if (f.dateMin && f.dateMin.trim() !== "") {
            if (!ds || ds < f.dateMin) return false;
          }
          if (f.dateMax && f.dateMax.trim() !== "") {
            if (!ds || ds > f.dateMax) return false;
          }
        } else if (col.type === "boolean") {
          if (f.boolean === "true" && v !== true) return false;
          if (f.boolean === "false" && v !== false) return false;
        }
      }
      return true;
    });
  }, [rows, columns, globalQuery, filters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a.data[sortKey];
      const bv = b.data[sortKey];
      // nulls sort to the end
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (col.type === "number" && typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      if (col.type === "boolean") {
        const an = av ? 1 : 0;
        const bn = bv ? 1 : 0;
        return (an - bn) * dir;
      }
      // Dates are ISO date strings; lexical sort == chronological
      const as = String(av);
      const bs = String(bv);
      return as.localeCompare(bs, "he") * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => sorted.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE),
    [sorted, clampedPage],
  );

  function toggleSort(key: string) {
    setPage(0);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function updateFilter(key: string, patch: ColumnFilter) {
    setPage(0);
    setFilters((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function clearAllFilters() {
    setFilters({});
    setGlobalQuery("");
    setPage(0);
  }

  const hasActiveFilter =
    globalQuery.trim().length > 0 ||
    Object.values(filters).some(
      (f) =>
        (f.text && f.text.trim()) ||
        (f.numberMin && f.numberMin.trim()) ||
        (f.numberMax && f.numberMax.trim()) ||
        (f.dateMin && f.dateMin.trim()) ||
        (f.dateMax && f.dateMax.trim()) ||
        f.boolean,
    );

  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={globalQuery}
            onChange={(e) => {
              setGlobalQuery(e.target.value);
              setPage(0);
            }}
            placeholder="חיפוש בעמודות טקסט..."
            className="block w-full rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            {sorted.length.toLocaleString("he-IL")} שורות
            {hasActiveFilter && (
              <span> (מסונן מתוך {rows.length.toLocaleString("he-IL")})</span>
            )}
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
            >
              <X className="h-3 w-3" />
              נקה סינון
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-700">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="border-b border-slate-200 px-3 py-2.5 text-start align-top font-medium"
                    style={{ minWidth: "12rem" }}
                  >
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex w-full items-center justify-between gap-2 text-start font-semibold text-slate-900 hover:text-brand-700"
                      >
                        <span className="truncate" title={col.label}>
                          {col.label}
                        </span>
                        <SortIcon
                          active={sortKey === col.key}
                          dir={sortDir}
                        />
                      </button>
                      <TypeChip type={col.type} />
                      <ColumnFilterControl
                        col={col}
                        value={filters[col.key] ?? {}}
                        onChange={(patch) => updateFilter(col.key, patch)}
                      />
                    </div>
                  </th>
                ))}
                {isOwner && (
                  <th
                    className="border-b border-slate-200 px-3 py-2.5 text-start font-medium"
                    style={{ width: "2.5rem" }}
                    aria-label="פעולות"
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <DataRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  isOwner={isOwner}
                />
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + (isOwner ? 1 : 0)}
                    className="px-3 py-10 text-center text-sm text-slate-500"
                  >
                    לא נמצאו שורות התואמות לסינון
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
            <div>
              עמוד {clampedPage + 1} מתוך {pageCount}
            </div>
            <div className="flex items-center gap-1">
              <PaginationButton
                onClick={() => setPage(0)}
                disabled={clampedPage === 0}
                ariaLabel="עמוד ראשון"
              >
                <ChevronFirst className="h-4 w-4" />
              </PaginationButton>
              <PaginationButton
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={clampedPage === 0}
                ariaLabel="עמוד קודם"
              >
                <ChevronRight className="h-4 w-4" />
              </PaginationButton>
              <PaginationButton
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={clampedPage >= pageCount - 1}
                ariaLabel="עמוד הבא"
              >
                <ChevronLeft className="h-4 w-4" />
              </PaginationButton>
              <PaginationButton
                onClick={() => setPage(pageCount - 1)}
                disabled={clampedPage >= pageCount - 1}
                ariaLabel="עמוד אחרון"
              >
                <ChevronLast className="h-4 w-4" />
              </PaginationButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
  return dir === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 text-brand-700" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-brand-700" />
  );
}

function TypeChip({ type }: { type: ColumnType }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        COLUMN_TYPE_CHIP[type],
      )}
    >
      {COLUMN_TYPE_LABELS_HE[type]}
    </span>
  );
}

function ColumnFilterControl({
  col,
  value,
  onChange,
}: {
  col: ColumnDef;
  value: ColumnFilter;
  onChange: (patch: ColumnFilter) => void;
}) {
  if (col.type === "text" || col.type === "unknown") {
    return (
      <input
        type="text"
        value={value.text ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="סינון..."
        className="block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-brand-400"
      />
    );
  }
  if (col.type === "number") {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value.numberMin ?? ""}
          onChange={(e) => onChange({ numberMin: e.target.value })}
          placeholder="מ־"
          className="block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-brand-400"
          dir="ltr"
        />
        <input
          type="number"
          value={value.numberMax ?? ""}
          onChange={(e) => onChange({ numberMax: e.target.value })}
          placeholder="עד"
          className="block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-brand-400"
          dir="ltr"
        />
      </div>
    );
  }
  if (col.type === "date") {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={value.dateMin ?? ""}
          onChange={(e) => onChange({ dateMin: e.target.value })}
          className="block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-brand-400"
          dir="ltr"
        />
        <input
          type="date"
          value={value.dateMax ?? ""}
          onChange={(e) => onChange({ dateMax: e.target.value })}
          className="block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-brand-400"
          dir="ltr"
        />
      </div>
    );
  }
  // boolean
  return (
    <select
      value={value.boolean ?? ""}
      onChange={(e) =>
        onChange({
          boolean: e.target.value as ColumnFilter["boolean"],
        })
      }
      className="block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-brand-400"
    >
      <option value="">הכל</option>
      <option value="true">כן</option>
      <option value="false">לא</option>
    </select>
  );
}

function DataRow({
  row,
  columns,
  isOwner,
}: {
  row: DatasetDataRow;
  columns: ColumnDef[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm("למחוק את השורה?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteRow(row.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr
      className={cn(
        "group border-t border-slate-100 transition",
        pending ? "opacity-50" : "hover:bg-slate-50/60",
      )}
    >
      {columns.map((col) => (
        <td key={col.key} className="px-3 py-2 align-top text-slate-800">
          <CellValue value={row.data[col.key]} type={col.type} />
        </td>
      ))}
      {isOwner && (
        <td className="px-3 py-2 align-top">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            aria-label="מחק שורה"
            title={error ?? "מחק שורה"}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100",
              error && "opacity-100 text-rose-600",
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

function CellValue({ value, type }: { value: unknown; type: ColumnType }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-300">—</span>;
  }
  if (type === "boolean") {
    return value ? (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
        כן
      </span>
    ) : (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        לא
      </span>
    );
  }
  if (type === "number" && typeof value === "number") {
    return <span dir="ltr">{value.toLocaleString("he-IL")}</span>;
  }
  if (type === "date" && typeof value === "string") {
    return <span dir="ltr">{value}</span>;
  }
  const s = typeof value === "string" ? value : String(value);
  return (
    <span className="line-clamp-3" title={s}>
      {s}
    </span>
  );
}

function PaginationButton({
  onClick,
  disabled,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
      <h2 className="font-display text-xl font-bold text-slate-900">
        אין שורות בדאטהסט
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        ייבא קובץ XLSX או CSV חדש כדי להתחיל לעבוד.
      </p>
    </div>
  );
}
