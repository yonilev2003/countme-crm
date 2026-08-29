"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { createAgentToken, revokeAgentToken } from "./actions";

export type AgentTokenRow = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function AgentTokensPanel({
  tokens,
  appUrl,
}: {
  tokens: AgentTokenRow[];
  appUrl: string;
}) {
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createAgentToken(name);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setNewToken(result.data.token);
      setName("");
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeAgentToken(id);
    });
  }

  const active = tokens.filter((t) => !t.revoked_at);

  return (
    <div className="space-y-6">
      {newToken && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-medium text-amber-900">
            הטוקן שלך — מוצג פעם אחת בלבד, תעתיק עכשיו:
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs" dir="ltr">
              {newToken}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newToken);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "הועתק" : "העתק"}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800" dir="ltr">
            {appUrl}/api/agent/tasks/mine — Authorization: Bearer {newToken.slice(0, 10)}...
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              שם לטוקן (למשל: "Claude", "ChatGPT")
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ברירת מחדל"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <KeyRound size={16} />
            צור טוקן חדש
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-start font-medium">שם</th>
              <th className="px-4 py-3 text-start font-medium">נוצר</th>
              <th className="px-4 py-3 text-start font-medium">שימוש אחרון</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  אין עדיין טוקנים פעילים
                </td>
              </tr>
            )}
            {active.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-4 py-3 text-slate-600">{fmt(t.created_at)}</td>
                <td className="px-4 py-3 text-slate-600">{fmt(t.last_used_at)}</td>
                <td className="px-4 py-3 text-end">
                  <button
                    type="button"
                    onClick={() => handleRevoke(t.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    בטל
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
