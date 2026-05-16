"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { X, Trash2 } from "lucide-react";
import {
  DEFAULT_TASK_INPUT,
  PRIORITY_LABELS_HE,
  STATUS_LABELS_HE,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import {
  createTask,
  deleteTask,
  updateTask,
} from "@/app/(app)/tasks/actions";

export type ProfileOption = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export type PersonOption = {
  id: string;
  name: string;
  company: string | null;
};

type Mode =
  | { kind: "create" }
  | { kind: "edit"; id: string; canDelete: boolean };

type Props = {
  open: boolean;
  mode: Mode;
  initial?: Partial<TaskInput>;
  profiles: ProfileOption[];
  people: PersonOption[];
  onClose: () => void;
  onSaved?: () => void;
};

export function TaskFormDialog({
  open,
  mode,
  initial,
  profiles,
  people,
  onClose,
  onSaved,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [personQuery, setPersonQuery] = useState("");

  const defaults = useMemo<TaskInput>(
    () => ({ ...DEFAULT_TASK_INPUT, ...(initial ?? {}) }),
    [initial],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskInput>({
    defaultValues: defaults,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      reset(defaults);
      setServerError(null);
      const personId = defaults.person_id;
      if (personId) {
        const p = people.find((x) => x.id === personId);
        setPersonQuery(p?.name ?? "");
      } else {
        setPersonQuery("");
      }
    }
  }, [open, defaults, reset, people]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const personId = watch("person_id");

  const filteredPeople = personQuery
    ? people.filter((p) =>
        `${p.name} ${p.company ?? ""}`.toLowerCase().includes(personQuery.toLowerCase()),
      )
    : people.slice(0, 8);

  async function onSubmit(values: TaskInput) {
    setServerError(null);
    setSubmitting(true);
    const result =
      mode.kind === "create"
        ? await createTask(values)
        : await updateTask(mode.id, values);
    setSubmitting(false);

    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onSaved?.();
    onClose();
  }

  async function onDelete() {
    if (mode.kind !== "edit") return;
    const confirmed = window.confirm("למחוק את המשימה?");
    if (!confirmed) return;

    setSubmitting(true);
    const result = await deleteTask(mode.id);
    setSubmitting(false);

    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onSaved?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode.kind === "create" ? "משימה חדשה" : "עריכת משימה"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <Field
            label="כותרת"
            error={errors.title?.message}
            htmlFor="title"
          >
            <input
              id="title"
              type="text"
              {...register("title", {
                required: "שדה חובה",
                minLength: { value: 2, message: "לפחות 2 תווים" },
                maxLength: { value: 200, message: "עד 200 תווים" },
              })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Field>

          <Field label="תיאור" htmlFor="description">
            <textarea
              id="description"
              rows={3}
              {...register("description", {
                maxLength: { value: 5000, message: "עד 5000 תווים" },
              })}
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="סטטוס" htmlFor="status">
              <select
                id="status"
                {...register("status")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              >
                {(["todo", "doing", "done"] as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS_HE[s]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="עדיפות" htmlFor="priority">
              <select
                id="priority"
                {...register("priority")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              >
                {(["low", "med", "high"] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS_HE[p]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="אחראי" htmlFor="assignee_id">
              <select
                id="assignee_id"
                {...register("assignee_id")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— ללא —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="מתאריך" htmlFor="due_start">
              <input
                id="due_start"
                type="date"
                {...register("due_start")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Field>
            <Field label="עד תאריך" htmlFor="due_end">
              <input
                id="due_end"
                type="date"
                {...register("due_end")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Field>
            <Field
              label="תווית טווח"
              htmlFor="due_label"
              hint="לדוגמה: 'מרץ 2026' או 'סוף החודש'"
            >
              <input
                id="due_label"
                type="text"
                {...register("due_label", {
                  maxLength: { value: 80, message: "עד 80 תווים" },
                })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Field>
          </div>

          <Field label="איש קשר" htmlFor="person_query">
            <div className="relative">
              <input
                id="person_query"
                type="text"
                value={personQuery}
                onChange={(e) => {
                  setPersonQuery(e.target.value);
                  if (e.target.value === "") {
                    setValue("person_id", null);
                  }
                }}
                placeholder="חיפוש לפי שם או חברה"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              />
              {personQuery && filteredPeople.length > 0 && !personId && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                  {filteredPeople.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setValue("person_id", p.id);
                          setPersonQuery(p.name);
                        }}
                        className="block w-full px-3 py-1.5 text-start hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">
                          {p.name}
                        </span>
                        {p.company && (
                          <span className="ms-2 text-xs text-slate-500">
                            {p.company}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {personId && (
                <button
                  type="button"
                  onClick={() => {
                    setValue("person_id", null);
                    setPersonQuery("");
                  }}
                  className="absolute inset-y-0 end-2 my-auto flex h-6 items-center rounded-md px-2 text-xs text-slate-500 hover:bg-slate-100"
                >
                  נקה
                </button>
              )}
            </div>
          </Field>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <div>
              {mode.kind === "edit" && mode.canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  מחק
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-start text-sm font-medium text-slate-900"
      >
        {label}
      </label>
      {hint && <p className="mt-0.5 text-start text-xs text-slate-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-start text-xs text-red-600">{error}</p>}
    </div>
  );
}
