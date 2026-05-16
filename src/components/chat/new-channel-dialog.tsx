"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Hash, Lock, StickyNote, Check } from "lucide-react";
import { createChannel, createSelfNoteChannel } from "@/app/(app)/chat/actions";

export type TeamMember = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export type NewChannelDialogProps = {
  onClose: () => void;
  currentUserId: string;
  teamMembers: TeamMember[];
};

export function NewChannelDialog({
  onClose,
  currentUserId,
  teamMembers,
}: NewChannelDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set([currentUserId]),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const otherMembers = useMemo(
    () => teamMembers.filter((m) => m.id !== currentUserId),
    [teamMembers, currentUserId],
  );

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedMembers(new Set(teamMembers.map((m) => m.id)));
  }
  function selectNone() {
    setSelectedMembers(new Set([currentUserId]));
  }

  async function onSelfNote() {
    setError(null);
    setSubmitting(true);
    const result = await createSelfNoteChannel();
    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(`/chat/${result.id}`);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (trimmedName.length < 1) {
      setError("יש להזין שם ערוץ");
      return;
    }
    setSubmitting(true);
    const result = await createChannel({
      name: trimmedName,
      description: description.trim(),
      is_private: isPrivate,
      member_ids: Array.from(selectedMembers),
    });
    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(`/chat/${result.id}`);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-channel-title"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6 pb-4">
          <div>
            <h3
              id="new-channel-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              שיחה חדשה
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              ערוץ קבוצתי, פרטי או פתק לעצמך
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Self-note quick action */}
          <button
            type="button"
            onClick={onSelfNote}
            disabled={submitting}
            className="flex w-full items-center gap-3 border-b border-slate-100 bg-amber-50/40 px-6 py-4 text-start transition hover:bg-amber-50 disabled:opacity-60"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <StickyNote className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">
                פתק לעצמי
              </div>
              <div className="text-xs text-slate-600">
                מרחב פרטי לרעיונות, תזכורות ומחשבות
              </div>
            </div>
          </button>

          <form onSubmit={onSubmit} className="space-y-4 p-6">
            <div>
              <label
                htmlFor="channel-name"
                className="block text-start text-sm font-medium text-slate-900"
              >
                שם השיחה
              </label>
              <div className="relative mt-2">
                <Hash
                  className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 start-2.5"
                  aria-hidden
                />
                <input
                  id="channel-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="למשל: שיווק-2026"
                  className="block w-full rounded-lg border border-slate-200 bg-white py-2 ps-8 pe-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="channel-desc"
                className="block text-start text-sm font-medium text-slate-900"
              >
                תיאור (אופציונלי)
              </label>
              <textarea
                id="channel-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder="במה השיחה עוסקת?"
                className="mt-2 block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <span className="block text-start text-sm font-medium text-slate-900">
                נראות
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={
                    !isPrivate
                      ? "flex items-start gap-2 rounded-lg border border-brand-500 bg-brand-50 p-3 text-start"
                      : "flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-start hover:bg-slate-50"
                  }
                  aria-pressed={!isPrivate}
                >
                  <Hash className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      ציבורי
                    </div>
                    <div className="text-xs text-slate-500">
                      כל חברי הצוות יוכלו להצטרף
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={
                    isPrivate
                      ? "flex items-start gap-2 rounded-lg border border-brand-500 bg-brand-50 p-3 text-start"
                      : "flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-start hover:bg-slate-50"
                  }
                  aria-pressed={isPrivate}
                >
                  <Lock className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      פרטי
                    </div>
                    <div className="text-xs text-slate-500">
                      רק מי שתבחר/י כאן
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="block text-start text-sm font-medium text-slate-900">
                  משתתפים
                </span>
                <div className="flex gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded px-2 py-0.5 text-brand-700 hover:bg-brand-50"
                  >
                    כולם
                  </button>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="rounded px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                  >
                    איש
                  </button>
                </div>
              </div>

              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
                {teamMembers.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-slate-500">
                    אין עדיין חברי צוות נוספים
                  </p>
                )}
                {teamMembers.map((m) => {
                  const isSelf = m.id === currentUserId;
                  const checked = selectedMembers.has(m.id);
                  const label =
                    m.display_name ?? m.full_name ?? m.email ?? "—";
                  const initials = (label[0] ?? "?").toUpperCase();
                  return (
                    <label
                      key={m.id}
                      className={
                        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition " +
                        (checked
                          ? "bg-brand-100/60"
                          : "hover:bg-white")
                      }
                    >
                      <span className="relative inline-flex">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isSelf}
                          onChange={() => toggleMember(m.id)}
                          className="peer sr-only"
                        />
                        <span
                          className={
                            "flex h-5 w-5 items-center justify-center rounded border transition " +
                            (checked
                              ? "border-brand-500 bg-brand-500 text-white"
                              : "border-slate-300 bg-white")
                          }
                        >
                          {checked && <Check className="h-3.5 w-3.5" aria-hidden />}
                        </span>
                      </span>

                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="h-7 w-7 rounded-full"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          {initials}
                        </span>
                      )}

                      <span className="min-w-0 flex-1 truncate text-slate-900">
                        {label}
                        {isSelf && (
                          <span className="ms-1.5 text-xs text-slate-500">
                            (אני)
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-start text-xs text-slate-500">
                {selectedMembers.size} משתתפים נבחרו
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-start text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "יוצר..." : "צור שיחה"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
