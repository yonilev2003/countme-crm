"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Check, AlertCircle, RotateCcw, X } from "lucide-react";
import { createTaskFromParse } from "@/app/(app)/tasks/actions";
import { TaskDueDisplay } from "@/components/tasks/task-due-display";
import { cn } from "@/lib/utils";

type Recent =
  | { kind: "success"; title: string }
  | { kind: "error"; title: string; message: string };

type Alternative = {
  due_start: string;
  due_end: string;
  due_label: string | null;
  hint: string;
};

type ParseResult = {
  title: string;
  due_start: string;
  due_end: string;
  due_label: string | null;
  confidence: "high" | "med" | "low";
  alternatives?: Alternative[];
};

type Status =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "parsed"; result: ParseResult; original: string }
  | { kind: "saving" }
  | { kind: "error"; message: string };

export function TaskQuickAdd() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Optimistic "just added" indicator that auto-dismisses after 3s.
  // We show success the moment confirmSave is called and only flip to error
  // if the server action fails after the fact.
  const [recent, setRecent] = useState<Recent | null>(null);

  useEffect(() => {
    if (recent?.kind !== "success") return;
    const t = setTimeout(() => {
      setRecent((cur) => (cur?.kind === "success" ? null : cur));
    }, 3000);
    return () => clearTimeout(t);
  }, [recent]);

  async function runParse(value: string) {
    if (value.trim().length < 2) return;
    setStatus({ kind: "parsing" });

    try {
      const res = await fetch("/api/ai/parse-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value.trim() }),
      });

      if (!res.ok) {
        setStatus({ kind: "error", message: "שגיאה בפענוח. נסו שוב." });
        return;
      }

      const result = (await res.json()) as ParseResult;
      setStatus({ kind: "parsed", result, original: value.trim() });
    } catch {
      setStatus({ kind: "error", message: "שגיאת רשת. נסו שוב." });
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "parsing" || status.kind === "saving") return;
    runParse(text);
  }

  function confirmSave() {
    if (status.kind !== "parsed") return;

    // Optimistic: clear the input, show the "just added" chip, refresh the
    // table — all BEFORE the server action resolves. The action runs in the
    // background; on error we replace the chip with an error message.
    const parsed = status.result;
    const optimisticTitle = parsed.title;

    setText("");
    setStatus({ kind: "idle" });
    setRecent({ kind: "success", title: optimisticTitle });
    inputRef.current?.focus();
    router.refresh();

    createTaskFromParse({
      title: parsed.title,
      due_start: parsed.due_start,
      due_end: parsed.due_end,
      due_label: parsed.due_label,
    })
      .then((result) => {
        if (!result.success) {
          setRecent({
            kind: "error",
            title: optimisticTitle,
            message: result.error,
          });
          return;
        }
        // Final reconcile — the previous refresh might have raced the insert.
        router.refresh();
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "שגיאה לא ידועה";
        setRecent({ kind: "error", title: optimisticTitle, message });
      });
  }

  function reset() {
    setStatus({ kind: "idle" });
    inputRef.current?.focus();
  }

  function pickAlternative(alt: Alternative) {
    if (status.kind !== "parsed") return;
    setStatus({
      kind: "parsed",
      original: status.original,
      result: {
        ...status.result,
        due_start: alt.due_start,
        due_end: alt.due_end,
        due_label: alt.due_label,
        confidence: "high",
        alternatives: undefined,
      },
    });
  }

  const parsing = status.kind === "parsing";
  const parsed = status.kind === "parsed";
  const saving = status.kind === "saving";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-brand-500" />
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (status.kind === "parsed" || status.kind === "error") {
                setStatus({ kind: "idle" });
              }
            }}
            placeholder="הוסף במהירות — לדוגמה: סקירה מחר"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-10 pe-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
            disabled={saving}
          />
        </div>
        <button
          type="submit"
          disabled={text.trim().length < 2 || parsing || saving}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {parsing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              מפענח...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              פענח עם AI
            </>
          )}
        </button>
      </form>

      {status.kind === "error" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {status.message}
          <button
            type="button"
            onClick={reset}
            className="ms-auto rounded-md px-2 py-0.5 text-xs hover:bg-red-100"
          >
            נסה שוב
          </button>
        </div>
      )}

      {parsed && (
        <ParsedPreview
          result={status.result}
          original={status.original}
          onConfirm={confirmSave}
          onReset={reset}
          onPickAlternative={pickAlternative}
          saving={saving}
        />
      )}

      {recent?.kind === "success" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check className="h-4 w-4 shrink-0" />
          <span className="truncate">נוסף: {recent.title}</span>
          <button
            type="button"
            onClick={() => setRecent(null)}
            aria-label="סגור"
            className="ms-auto rounded-md px-2 py-0.5 text-xs hover:bg-emerald-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {recent?.kind === "error" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">שגיאה בשמירת &quot;{recent.title}&quot;: {recent.message}</span>
          <button
            type="button"
            onClick={() => setRecent(null)}
            aria-label="סגור"
            className="ms-auto rounded-md px-2 py-0.5 text-xs hover:bg-red-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {saving && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          שומר...
        </div>
      )}
    </div>
  );
}

function ParsedPreview({
  result,
  original,
  onConfirm,
  onReset,
  onPickAlternative,
  saving,
}: {
  result: ParseResult;
  original: string;
  onConfirm: () => void;
  onReset: () => void;
  onPickAlternative: (alt: Alternative) => void;
  saving: boolean;
}) {
  const confidence = result.confidence;
  const showAlternatives =
    (confidence !== "high" || (result.alternatives?.length ?? 0) > 0) &&
    (result.alternatives?.length ?? 0) > 0;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">כותרת</span>
            <ConfidenceChip confidence={confidence} />
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-900">
            {result.title}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-500">תאריך</span>
            <TaskDueDisplay
              due_start={result.due_start}
              due_end={result.due_end}
              due_label={result.due_label}
            />
          </div>
          {original !== result.title && (
            <p className="mt-1 text-xs text-slate-400">
              קלט מקורי: <span className="text-slate-500">{original}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            התחל מחדש
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            הוסף
          </button>
        </div>
      </div>

      {showAlternatives && (
        <div className="border-t border-slate-200 pt-2">
          <p className="mb-1.5 text-xs text-slate-500">
            התכוונת אולי ל-
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.alternatives!.map((alt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickAlternative(alt)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                <span>{alt.hint}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {alt.due_label ??
                    `${alt.due_start === alt.due_end ? alt.due_start : `${alt.due_start} – ${alt.due_end}`}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceChip({ confidence }: { confidence: "high" | "med" | "low" }) {
  const map = {
    high: { label: "ודאי", cls: "bg-emerald-100 text-emerald-800" },
    med: { label: "חלקי", cls: "bg-amber-100 text-amber-800" },
    low: { label: "לא ברור", cls: "bg-red-100 text-red-800" },
  } as const;
  const { label, cls } = map[confidence];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        cls,
      )}
    >
      {label}
    </span>
  );
}
