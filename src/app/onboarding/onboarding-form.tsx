"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { completeOnboarding } from "./actions";

const PRESET_ROLES = ["CTO", "CEO", "CMO"] as const;
const OTHER_KEY = "אחר";

type FormValues = {
  display_name: string;
  roleChoice: string;
  roleOther: string;
};

type Props = {
  initialName: string;
  initialRole: string;
  email: string;
  avatarUrl: string | null;
};

export function OnboardingForm({
  initialName,
  initialRole,
  email,
  avatarUrl,
}: Props) {
  const presetMatch = (PRESET_ROLES as readonly string[]).includes(initialRole);
  const [roleChoice, setRoleChoice] = useState<string>(
    initialRole ? (presetMatch ? initialRole : OTHER_KEY) : "",
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      display_name: initialName,
      roleChoice: roleChoice,
      roleOther: presetMatch ? "" : initialRole,
    },
    mode: "onSubmit",
  });

  function selectRole(choice: string) {
    setRoleChoice(choice);
    setValue("roleChoice", choice, { shouldValidate: true });
    if (choice !== OTHER_KEY) {
      setValue("roleOther", "");
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null);

    const resolvedRole =
      values.roleChoice === OTHER_KEY
        ? values.roleOther.trim()
        : values.roleChoice;

    if (!resolvedRole || resolvedRole.length < 2) {
      setSubmitError("יש לבחור או להזין תפקיד");
      return;
    }

    setSubmitting(true);
    const result = await completeOnboarding({
      display_name: values.display_name.trim(),
      role: resolvedRole,
    });

    if ("error" in result) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    window.location.href = "/tasks";
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-slate-200" />
        )}
        <div className="min-w-0 flex-1 text-start">
          <p className="truncate text-sm font-medium text-slate-900">
            {email}
          </p>
          <p className="text-xs text-slate-500">החשבון המחובר</p>
        </div>
      </div>

      <div>
        <label
          htmlFor="display_name"
          className="block text-start text-sm font-medium text-slate-900"
        >
          שם תצוגה
        </label>
        <p className="mt-1 text-start text-xs text-slate-500">
          כך אנשים יראו אותך במערכת
        </p>
        <input
          id="display_name"
          type="text"
          autoComplete="name"
          {...register("display_name", {
            required: "שדה חובה",
            minLength: { value: 2, message: "לפחות 2 תווים" },
            maxLength: { value: 80, message: "עד 80 תווים" },
          })}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
        />
        {errors.display_name && (
          <p className="mt-1 text-start text-xs text-red-600">
            {errors.display_name.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-start text-sm font-medium text-slate-900">
          תפקיד
        </label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[...PRESET_ROLES, OTHER_KEY].map((option) => {
            const selected = roleChoice === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => selectRole(option)}
                className={
                  selected
                    ? "rounded-lg border border-brand-500 bg-brand-500 px-3 py-2 text-sm font-medium text-white"
                    : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                {option}
              </button>
            );
          })}
        </div>

        {roleChoice === OTHER_KEY && (
          <input
            type="text"
            placeholder="פרט/י תפקיד"
            {...register("roleOther", {
              maxLength: { value: 40, message: "עד 40 תווים" },
            })}
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}

        {errors.roleOther && (
          <p className="mt-1 text-start text-xs text-red-600">
            {errors.roleOther.message}
          </p>
        )}
      </div>

      {submitError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-start text-sm text-red-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "שומר..." : "סיים והיכנס"}
      </button>
    </form>
  );
}
