"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Hash, Lock } from "lucide-react";
import { createChannel } from "@/app/(app)/chat/actions";

export type NewChannelDialogProps = {
  onClose: () => void;
};

export function NewChannelDialog({ onClose }: NewChannelDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-channel-title"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3
              id="new-channel-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              ערוץ חדש
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              ערוצים מאגדים שיחות סביב נושא משותף
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="channel-name"
              className="block text-start text-sm font-medium text-slate-900"
            >
              שם הערוץ
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
                autoFocus
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
              placeholder="במה הערוץ עוסק?"
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
                    כל חברי הצוות יראו
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
                    רק חברים מוזמנים
                  </div>
                </div>
              </button>
            </div>
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
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "יוצר..." : "צור ערוץ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
