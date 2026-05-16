"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  PERSON_STATUSES,
  STATUS_LABELS_HE,
  personSchema,
  parseTagsInput,
  type Person,
  type PersonInput,
  type PersonStatus,
} from "@/lib/people";
import { cn } from "@/lib/utils";

type FormFields = {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  status: PersonStatus;
  notes: string;
  tagsRaw: string;
};

type ActionResult = { success: true; id: string } | { error: string };

type Props = {
  initialValues: Person | null;
  submitLabel: string;
  cancelHref: string;
  action: (input: PersonInput) => Promise<ActionResult>;
};

export function PeopleForm({
  initialValues,
  submitLabel,
  cancelHref,
  action,
}: Props) {
  const router = useRouter();
  const isEdit = initialValues !== null;
  const editingId = initialValues?.id ?? null;
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
  const [, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormFields>({
    defaultValues: {
      name: initialValues?.name ?? "",
      email: initialValues?.email ?? "",
      phone: initialValues?.phone ?? "",
      company: initialValues?.company ?? "",
      role: initialValues?.role ?? "",
      status: initialValues?.status ?? "lead",
      notes: initialValues?.notes ?? "",
      tagsRaw: "",
    },
    mode: "onSubmit",
  });

  const status = watch("status");

  function commitTagsFromRaw() {
    const raw = watch("tagsRaw");
    if (!raw.trim()) return;
    const newTags = parseTagsInput(raw);
    if (newTags.length === 0) return;
    setTags((prev) => {
      const merged = [...prev];
      for (const t of newTags) {
        if (!merged.includes(t)) merged.push(t);
      }
      return merged.slice(0, 40);
    });
    setValue("tagsRaw", "");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function selectStatus(s: PersonStatus) {
    setValue("status", s, { shouldValidate: false });
  }

  function onSubmit(values: FormFields) {
    setSubmitError(null);

    // Capture any remaining tag text the user didn't blur out yet
    let finalTags = [...tags];
    if (values.tagsRaw.trim()) {
      const more = parseTagsInput(values.tagsRaw);
      for (const t of more) {
        if (!finalTags.includes(t)) finalTags.push(t);
      }
      finalTags = finalTags.slice(0, 40);
    }

    const parsed = personSchema.safeParse({
      name: values.name,
      email: values.email,
      phone: values.phone,
      company: values.company,
      role: values.role,
      status: values.status,
      notes: values.notes,
      tags: finalTags,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setSubmitError(first?.message ?? "פרטים לא תקינים");
      return;
    }

    // Optimistic UX: we navigate away IMMEDIATELY so the user feels the save
    // landed in <50ms. The actual server action keeps running in the
    // background; if it fails, we route back to the form with the error.
    //
    // Edit: we already know the id, so we can land on /people/{id} directly.
    // Create: we don't have an id yet, so we go to /people and rely on
    //         router.refresh() to bring in the new row at the top once the
    //         server action finishes.
    setSubmitting(true);
    const optimisticHref = isEdit && editingId
      ? `/people/${editingId}`
      : "/people";

    // Fire the server action without awaiting — handle the result async.
    const actionPromise = action(parsed.data);

    startTransition(() => {
      router.push(optimisticHref);
    });

    actionPromise
      .then((result) => {
        if ("error" in result) {
          // Bring the user back to the form with the error visible.
          setSubmitError(result.error);
          setSubmitting(false);
          router.back();
          return;
        }
        // Success: trigger a refresh so the newly-created/updated row appears.
        router.refresh();
        setSubmitting(false);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "שגיאה בשמירה";
        setSubmitError(message);
        setSubmitting(false);
        router.back();
      });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label
          htmlFor="name"
          className="block text-start text-sm font-medium text-slate-900"
        >
          שם מלא <span className="text-red-600">*</span>
        </label>
        <input
          id="name"
          type="text"
          autoComplete="off"
          {...register("name", {
            required: "שדה חובה",
            minLength: { value: 2, message: "לפחות 2 תווים" },
            maxLength: { value: 120, message: "עד 120 תווים" },
          })}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
        />
        {errors.name && (
          <p className="mt-1 text-start text-xs text-red-600">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="email"
            className="block text-start text-sm font-medium text-slate-900"
          >
            אימייל
          </label>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="off"
            {...register("email")}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-start text-sm font-medium text-slate-900"
          >
            טלפון
          </label>
          <input
            id="phone"
            type="tel"
            dir="ltr"
            autoComplete="off"
            {...register("phone")}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="company"
            className="block text-start text-sm font-medium text-slate-900"
          >
            חברה
          </label>
          <input
            id="company"
            type="text"
            autoComplete="off"
            {...register("company")}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor="role"
            className="block text-start text-sm font-medium text-slate-900"
          >
            תפקיד
          </label>
          <input
            id="role"
            type="text"
            autoComplete="off"
            {...register("role")}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-start text-sm font-medium text-slate-900">
          סטטוס
        </label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PERSON_STATUSES.map((option) => {
            const selected = status === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => selectStatus(option)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition",
                  selected
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {STATUS_LABELS_HE[option]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="tagsRaw"
          className="block text-start text-sm font-medium text-slate-900"
        >
          תיוגים
        </label>
        <p className="mt-1 text-start text-xs text-slate-500">
          הפרד/י עם פסיק או רווח
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`הסר ${tag}`}
                className="rounded-full p-0.5 text-brand-700 hover:bg-brand-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id="tagsRaw"
            type="text"
            placeholder={tags.length === 0 ? "למשל: VIP, ספק, חיפה" : ""}
            {...register("tagsRaw")}
            onBlur={commitTagsFromRaw}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commitTagsFromRaw();
              }
            }}
            className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-start text-sm font-medium text-slate-900"
        >
          הערות
        </label>
        <textarea
          id="notes"
          rows={5}
          {...register("notes", {
            maxLength: { value: 5000, message: "עד 5000 תווים" },
          })}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
        />
        {errors.notes && (
          <p className="mt-1 text-start text-xs text-red-600">
            {errors.notes.message}
          </p>
        )}
      </div>

      {submitError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-start text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "שומר..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
