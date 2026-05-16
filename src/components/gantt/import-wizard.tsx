"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ChevronLeft, AlertCircle } from "lucide-react";
import { finalizeImport } from "@/app/(app)/gantt/actions";

// Shape returned from /api/gantt/parse-xlsx
type ParseOption = {
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
  hint: string;
};

type ParseRow = {
  rowIndex: number;
  title: string;
  description: string | null;
  ambiguous: boolean;
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
  alternatives: ParseOption[];
};

type ParseResponse = {
  importId: string | null;
  rows: ParseRow[];
};

type Step = "upload" | "disambiguate" | "meta";

type Resolved = {
  rowIndex: number;
  title: string;
  description: string | null;
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
};

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParseRow[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/gantt/parse-xlsx", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "שגיאה בפענוח הקובץ");
      }
      const data: ParseResponse = await res.json();
      setRows(data.rows);
      setImportId(data.importId);
      // Default choice = first alternative for ambiguous rows.
      const initialChoices: Record<number, number> = {};
      data.rows.forEach((r) => {
        if (r.ambiguous && r.alternatives.length > 0) {
          initialChoices[r.rowIndex] = 0;
        }
      });
      setChoices(initialChoices);

      const hasAmbiguous = data.rows.some((r) => r.ambiguous);
      setStep(hasAmbiguous ? "disambiguate" : "meta");
      const baseName = file.name.replace(/\.[^.]+$/, "");
      if (!projectName) setProjectName(baseName);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "שגיאה בפענוח הקובץ");
    } finally {
      setParsing(false);
    }
  }

  function resolveRows(): Resolved[] {
    return rows.map((r) => {
      if (r.ambiguous) {
        const idx = choices[r.rowIndex] ?? 0;
        const alt = r.alternatives[idx];
        return {
          rowIndex: r.rowIndex,
          title: r.title,
          description: r.description,
          due_start: alt?.due_start ?? null,
          due_end: alt?.due_end ?? null,
          due_label: alt?.due_label ?? null,
        };
      }
      return {
        rowIndex: r.rowIndex,
        title: r.title,
        description: r.description,
        due_start: r.due_start,
        due_end: r.due_end,
        due_label: r.due_label,
      };
    });
  }

  function submit() {
    setSubmitError(null);
    const tasks = resolveRows().map((r) => ({
      title: r.title,
      description: r.description,
      due_start: r.due_start,
      due_end: r.due_end,
      due_label: r.due_label,
    }));
    if (tasks.length === 0) {
      setSubmitError("אין משימות לייבא");
      return;
    }
    if (projectName.trim().length === 0) {
      setSubmitError("נדרש שם פרויקט");
      return;
    }
    startSubmit(async () => {
      const res = await finalizeImport({
        projectName: projectName.trim(),
        projectDescription: projectDescription.trim() || null,
        importId: importId ?? null,
        tasks,
      });
      if (!res.success) {
        setSubmitError(res.error);
        return;
      }
      router.push(`/gantt/${res.projectId}`);
    });
  }

  // ====== render ======
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

      {step === "disambiguate" && (
        <DisambiguateStep
          rows={rows}
          choices={choices}
          onChoose={(rowIndex, optionIndex) =>
            setChoices((c) => ({ ...c, [rowIndex]: optionIndex }))
          }
          onBack={() => setStep("upload")}
          onNext={() => setStep("meta")}
        />
      )}

      {step === "meta" && (
        <MetaStep
          name={projectName}
          description={projectDescription}
          taskCount={rows.length}
          submitting={submitting}
          error={submitError}
          onNameChange={setProjectName}
          onDescriptionChange={setProjectDescription}
          onBack={() =>
            setStep(
              rows.some((r) => r.ambiguous) ? "disambiguate" : "upload",
            )
          }
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "העלאה" },
    { key: "disambiguate", label: "תאריכים" },
    { key: "meta", label: "פרטי פרויקט" },
  ];
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const active = s.key === current;
        const past =
          steps.findIndex((x) => x.key === current) >
          steps.findIndex((x) => x.key === s.key);
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
              {i + 1}
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
          גרור קובץ XLSX לכאן
        </div>
        <div className="mt-1 text-sm text-slate-600">או לחץ לבחירת קובץ</div>
        <div className="mt-4 text-xs text-slate-500">
          עמודה A — כותרת משימה · עמודה B — תאריך / טווח / ביטוי · עמודה C —
          תיאור (לא חובה)
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelect(f);
            // reset so picking the same file again still fires onChange
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </label>

      {parsing && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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

function DisambiguateStep({
  rows,
  choices,
  onChoose,
  onBack,
  onNext,
}: {
  rows: ParseRow[];
  choices: Record<number, number>;
  onChoose: (rowIndex: number, optionIndex: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const ambiguous = rows.filter((r) => r.ambiguous);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <strong className="font-display">בחר תאריך עבור כל משימה.</strong>{" "}
        חלק מהביטויים סובלים מכמה פרשנויות — בחר את ההתאמה המתאימה.
      </div>

      <div className="space-y-3">
        {ambiguous.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            לא נמצאו תאריכים מעורפלים. ניתן להמשיך לשלב הבא.
          </div>
        ) : (
          ambiguous.map((row) => {
            const chosen = choices[row.rowIndex] ?? 0;
            return (
              <div
                key={row.rowIndex}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">
                      {row.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      ביטוי שורה: {row.due_label ?? "ללא"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.alternatives.length === 0 ? (
                    <span className="text-xs text-slate-500">
                      אין הצעות — המשימה תיווצר ללא תאריך
                    </span>
                  ) : (
                    row.alternatives.map((alt, i) => {
                      const active = i === chosen;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onChoose(row.rowIndex, i)}
                          className={
                            "rounded-full px-3 py-1.5 text-xs transition " +
                            (active
                              ? "bg-brand-500 text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300")
                          }
                        >
                          {alt.hint}
                          {alt.due_start && alt.due_end && (
                            <span className="ms-1 opacity-80">
                              · {alt.due_start}
                              {alt.due_start !== alt.due_end
                                ? `→${alt.due_end}`
                                : ""}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
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

function MetaStep({
  name,
  description,
  taskCount,
  submitting,
  error,
  onNameChange,
  onDescriptionChange,
  onBack,
  onSubmit,
}: {
  name: string;
  description: string;
  taskCount: number;
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
          שם הפרויקט
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            placeholder="פרויקט חדש"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          תיאור (לא חובה)
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </label>
        <div className="mt-4 text-xs text-slate-500">
          הפרויקט ייווצר עם {taskCount} משימות
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
          {submitting ? "יוצר פרויקט..." : "צור פרויקט"}
        </button>
      </div>
    </div>
  );
}
