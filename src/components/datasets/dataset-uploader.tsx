"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  Upload,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  COLUMN_TYPES,
  COLUMN_TYPE_CHIP,
  COLUMN_TYPE_LABELS_HE,
  type ColumnDef,
  type ColumnType,
} from "@/lib/datasets";
import { createDataset } from "@/app/(app)/datasets/actions";

type ParseResponse = {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  total_rows: number;
  warnings: string[];
};

type Step = "upload" | "preview" | "meta";

export function DatasetUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Parsed data
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceFilename, setSourceFilename] = useState<string>("");

  // Step 3 fields
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  async function handleFile(file: File) {
    setParseError(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/datasets/parse", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `שגיאה בקריאת הקובץ (${res.status})`);
      }
      const data = (await res.json()) as ParseResponse;
      setColumns(data.columns);
      setRows(data.rows);
      setWarnings(data.warnings);
      setSourceFilename(file.name);

      // Default name = filename without extension
      const baseName = file.name.replace(/\.[^.]+$/, "");
      if (!name) setName(baseName);

      setStep("preview");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "שגיאה בקריאת הקובץ");
    } finally {
      setParsing(false);
    }
  }

  function changeColumnType(key: string, type: ColumnType) {
    setColumns((cols) =>
      cols.map((c) => (c.key === key ? { ...c, type } : c)),
    );
  }

  function submit() {
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError("נדרש שם לדאטהסט");
      return;
    }
    startSubmit(async () => {
      const result = await createDataset({
        name: name.trim(),
        description: description.trim() || null,
        source_filename: sourceFilename || null,
        columns_schema: columns,
        rows,
      });
      if ("error" in result) {
        setSubmitError(result.error);
        return;
      }
      router.push(`/datasets/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {step === "upload" && (
        <UploadStep
          inputRef={inputRef}
          parsing={parsing}
          parseError={parseError}
          onSelect={handleFile}
        />
      )}

      {step === "preview" && (
        <PreviewStep
          columns={columns}
          rows={rows}
          warnings={warnings}
          onChangeType={changeColumnType}
          onBack={() => setStep("upload")}
          onNext={() => setStep("meta")}
        />
      )}

      {step === "meta" && (
        <MetaStep
          name={name}
          description={description}
          rowCount={rows.length}
          submitting={submitting}
          error={submitError}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onBack={() => setStep("preview")}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "העלאה" },
    { key: "preview", label: "תצוגה מקדימה" },
    { key: "meta", label: "שם ותיאור" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const active = s.key === current;
        const past = currentIdx > i;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                (active
                  ? "bg-brand-500 text-white"
                  : past
                    ? "bg-brand-100 text-brand-700"
                    : "bg-slate-100 text-slate-500")
              }
            >
              {past ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={
                active
                  ? "font-medium text-slate-900"
                  : past
                    ? "text-slate-700"
                    : "text-slate-500"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 text-slate-300">·</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function UploadStep({
  inputRef,
  parsing,
  parseError,
  onSelect,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  parsing: boolean;
  parseError: string | null;
  onSelect: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onSelect(file);
        }}
        className={
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-12 text-center transition " +
          (dragging
            ? "border-brand-400 bg-brand-50"
            : "border-slate-300 hover:border-brand-300")
        }
      >
        <Upload className="h-10 w-10 text-brand-500" />
        <div className="mt-3 font-display text-lg font-bold text-slate-900">
          גרור קובץ לכאן או לחץ לבחירה
        </div>
        <div className="mt-1 text-sm text-slate-600">
          נתמך: XLSX, XLS, CSV. שורת הכותרות הראשונה — שמות העמודות.
        </div>
        <div className="mt-4 text-xs text-slate-500">
          עד 50 עמודות · עד 100,000 שורות
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelect(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </label>

      {parsing && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          מפענח את הקובץ...
        </div>
      )}
      {parseError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}
    </div>
  );
}

const PREVIEW_ROWS = 20;

function PreviewStep({
  columns,
  rows,
  warnings,
  onChangeType,
  onBack,
  onNext,
}: {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  warnings: string[];
  onChangeType: (key: string, type: ColumnType) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const visibleRows = useMemo(
    () => rows.slice(0, PREVIEW_ROWS),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <strong className="font-display">תצוגה מקדימה.</strong> זוהו{" "}
        <span className="font-semibold">{columns.length}</span> עמודות ו־
        <span className="font-semibold">{rows.length.toLocaleString("he-IL")}</span>{" "}
        שורות. ניתן לעדכן את סוג כל עמודה לפני שמירה.
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="border-b border-slate-200 px-3 py-3 text-start align-top font-medium"
                  >
                    <div
                      className="truncate font-semibold text-slate-900"
                      title={col.label}
                      style={{ maxWidth: "16rem" }}
                    >
                      {col.label}
                    </div>
                    <div className="mt-1.5">
                      <TypeSelect
                        value={col.type}
                        onChange={(t) => onChangeType(col.key, t)}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2 text-slate-800"
                    >
                      <CellPreview value={row[col.key]} type={col.type} />
                    </td>
                  ))}
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1)}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    אין שורות לתצוגה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > PREVIEW_ROWS && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-500">
            מציג {PREVIEW_ROWS} שורות מתוך {rows.length.toLocaleString("he-IL")} —
            כל השורות יישמרו במסד הנתונים.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          חזרה
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <span>המשך</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TypeSelect({
  value,
  onChange,
}: {
  value: ColumnType;
  onChange: (t: ColumnType) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ColumnType)}
      className={
        "rounded-full border-0 px-2 py-0.5 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-500 " +
        COLUMN_TYPE_CHIP[value]
      }
    >
      {COLUMN_TYPES.map((t) => (
        <option key={t} value={t}>
          {COLUMN_TYPE_LABELS_HE[t]}
        </option>
      ))}
    </select>
  );
}

function CellPreview({
  value,
  type,
}: {
  value: unknown;
  type: ColumnType;
}) {
  if (value === null || value === undefined) {
    return <span className="text-slate-400">—</span>;
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
    return (
      <span dir="ltr">{value.toLocaleString("he-IL")}</span>
    );
  }
  if (type === "date" && typeof value === "string") {
    return <span dir="ltr">{value}</span>;
  }
  const s = typeof value === "string" ? value : String(value);
  return <span title={s} className="line-clamp-2">{s}</span>;
}

function MetaStep({
  name,
  description,
  rowCount,
  submitting,
  error,
  onNameChange,
  onDescriptionChange,
  onBack,
  onSubmit,
}: {
  name: string;
  description: string;
  rowCount: number;
  submitting: boolean;
  error: string | null;
  onNameChange: (s: string) => void;
  onDescriptionChange: (s: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">
          שם הדאטהסט
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            placeholder="דאטהסט חדש"
            autoFocus
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          תיאור (לא חובה)
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            placeholder="לדוגמה: מאגר לקוחות מקיץ 2025"
          />
        </label>
        <div className="mt-4 text-xs text-slate-500">
          ייווצר דאטהסט עם {rowCount.toLocaleString("he-IL")} שורות
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          חזרה
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            "צור דאטהסט"
          )}
        </button>
      </div>
    </div>
  );
}
