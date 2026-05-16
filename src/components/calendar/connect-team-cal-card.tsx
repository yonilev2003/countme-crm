"use client";

import { useState, useTransition } from "react";
import { Calendar, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import {
  disconnectTeamCalendar,
  refreshTeamCalendarStatus,
} from "@/app/(app)/admin/calendar/actions";

type TeamConfig = {
  shared_calendar_email: string | null;
  shared_calendar_refresh_token: string | null;
  shared_calendar_token_expires_at: string | null;
  shared_calendar_sync_token: string | null;
  updated_at: string | null;
};

type Props = {
  config: TeamConfig | null;
};

function formatDateTimeIL(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConnectTeamCalCard({ config }: Props) {
  const connected = Boolean(config?.shared_calendar_refresh_token);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDisconnect() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await disconnectTeamCalendar();
      if ("error" in res) setError(res.error);
      else setMessage("נותק בהצלחה");
    });
  }

  function handleRefresh() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await refreshTeamCalendarStatus();
      if ("error" in res) setError(res.error);
      else
        setMessage(
          `סונכרן: נמשכו ${res.pulled}, נדחפו ${res.pushed}, נמחקו ${res.deleted}` +
            (res.conflicts ? `, ${res.conflicts} קונפליקטים` : ""),
        );
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Calendar className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-slate-900">
            יומן צוות משותף
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            יומן Google המשותף לכל הצוות (countme5555@gmail.com). אירועי "צוות"
            מסונכרנים מולו דו-כיוונית.
          </p>

          {connected ? (
            <div className="mt-4 space-y-3">
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">כתובת היומן</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {config?.shared_calendar_email ?? "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">עודכן לאחרונה</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {formatDateTimeIL(config?.updated_at ?? null)}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">פג תוקף Access</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {formatDateTimeIL(
                      config?.shared_calendar_token_expires_at ?? null,
                    )}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">Sync Token</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {config?.shared_calendar_sync_token
                      ? "פעיל"
                      : "(אין — סנכרון מלא בפעם הבאה)"}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  סנכרן עכשיו
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <Unplug className="h-4 w-4" />
                  נתק
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                יומן הצוות לא מחובר. לחיצה למטה תפתח הסכמת Google ל-
                <code className="font-mono">countme5555@gmail.com</code>.
              </p>
              <a
                href="/api/admin/calendar/connect"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                <Link2 className="h-4 w-4" />
                חבר יומן צוות
              </a>
            </div>
          )}

          {message && (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
