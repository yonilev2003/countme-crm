"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/app/(app)/calendar/actions";

export type DialogProfile = { id: string; display_name: string; email: string | null };
export type DialogPerson = { id: string; name: string };
export type DialogProject = { id: string; name: string };

export type DialogEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  kind: "personal" | "team";
  person_id: string | null;
  project_id: string | null;
  attendee_profile_ids: string[];
  owner_id: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  isAdmin: boolean;
  initial?: DialogEvent | null; // edit mode if set
  defaultDate?: Date | null;
  profiles: DialogProfile[];
  people: DialogPerson[];
  projects: DialogProject[];
};

function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Format YYYY-MM-DDTHH:mm in local time (what datetime-local expects)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string): string {
  if (!v) return "";
  // datetime-local has no zone; treat as local time and convert to ISO UTC
  const d = new Date(v);
  return d.toISOString();
}

function buildDefaultStart(defaultDate?: Date | null): string {
  const base = defaultDate ? new Date(defaultDate) : new Date();
  // Default to next round hour
  base.setMinutes(0, 0, 0);
  if (!defaultDate) base.setHours(base.getHours() + 1);
  else base.setHours(9);
  return toLocalInputValue(base.toISOString());
}

function buildDefaultEnd(start: string): string {
  if (!start) return "";
  const d = new Date(start);
  d.setHours(d.getHours() + 1);
  return toLocalInputValue(d.toISOString());
}

export function EventDialog({
  open,
  onClose,
  currentUserId,
  isAdmin,
  initial,
  defaultDate,
  profiles,
  people,
  projects,
}: Props) {
  const editMode = Boolean(initial);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [kind, setKind] = useState<"personal" | "team">("personal");
  const [personId, setPersonId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setStartLocal(toLocalInputValue(initial.start_at));
      setEndLocal(toLocalInputValue(initial.end_at));
      setKind(initial.kind);
      setPersonId(initial.person_id ?? "");
      setProjectId(initial.project_id ?? "");
      setAttendeeIds(initial.attendee_profile_ids);
    } else {
      const s = buildDefaultStart(defaultDate);
      setTitle("");
      setDescription("");
      setStartLocal(s);
      setEndLocal(buildDefaultEnd(s));
      setKind("personal");
      setPersonId("");
      setProjectId("");
      setAttendeeIds([]);
    }
    setError(null);
  }, [open, initial, defaultDate]);

  if (!open) return null;

  // Only the owner can edit/delete; admin can also create team events.
  const canDelete = editMode && initial?.owner_id === currentUserId;
  const canSubmit =
    title.trim().length > 0 && startLocal.length > 0 && endLocal.length > 0;

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    setError(null);
    if (!canSubmit) {
      setError("יש למלא כותרת ותאריכים");
      return;
    }
    const start_at = fromLocalInputValue(startLocal);
    const end_at = fromLocalInputValue(endLocal);

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        start_at,
        end_at,
        person_id: personId || null,
        project_id: projectId || null,
        attendee_profile_ids: kind === "team" ? attendeeIds : [],
      };
      const res = editMode
        ? await updateEvent({ id: initial!.id, ...payload })
        : await createEvent({ ...payload, kind });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!initial || !canDelete) return;
    if (!window.confirm("למחוק את האירוע?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteEvent(initial.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {editMode ? "עריכת אירוע" : "אירוע חדש"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!editMode && isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-900">
                סוג אירוע
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind("personal")}
                  className={
                    "rounded-lg border px-3 py-2 text-sm font-medium " +
                    (kind === "personal"
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                  }
                >
                  אישי
                </button>
                <button
                  type="button"
                  onClick={() => setKind("team")}
                  className={
                    "rounded-lg border px-3 py-2 text-sm font-medium " +
                    (kind === "team"
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                  }
                >
                  צוות
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="ev-title" className="block text-sm font-medium text-slate-900">
              כותרת
            </label>
            <input
              id="ev-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="פגישה, שיחה, סקירה..."
            />
          </div>

          <div>
            <label htmlFor="ev-desc" className="block text-sm font-medium text-slate-900">
              תיאור
            </label>
            <textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ev-start" className="block text-sm font-medium text-slate-900">
                התחלה
              </label>
              <input
                id="ev-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => {
                  setStartLocal(e.target.value);
                  if (!endLocal || endLocal <= e.target.value) {
                    setEndLocal(buildDefaultEnd(e.target.value));
                  }
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="ev-end" className="block text-sm font-medium text-slate-900">
                סיום
              </label>
              <input
                id="ev-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ev-person" className="block text-sm font-medium text-slate-900">
                איש קשר
              </label>
              <select
                id="ev-person"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— ללא —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ev-project" className="block text-sm font-medium text-slate-900">
                פרויקט
              </label>
              <select
                id="ev-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— ללא —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {kind === "team" && (
            <div>
              <label className="block text-sm font-medium text-slate-900">
                משתתפים מהצוות
              </label>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {profiles.length === 0 && (
                  <p className="px-2 py-1 text-xs text-slate-500">אין משתמשים</p>
                )}
                {profiles.map((p) => {
                  const checked = attendeeIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAttendee(p.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-slate-800">{p.display_name}</span>
                      {p.email && (
                        <span className="text-xs text-slate-500">{p.email}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div>
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
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
              disabled={pending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !canSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editMode ? "שמור" : "צור"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
