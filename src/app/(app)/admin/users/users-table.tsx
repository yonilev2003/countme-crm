"use client";

import { useState, useTransition } from "react";
import { Check, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleUserAdmin, updateUserRole, deleteUser } from "./actions";

export type UserRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  is_admin: boolean;
  created_at: string;
};

type Props = {
  users: UserRow[];
  currentUserId: string;
};

export function UsersTable({ users, currentUserId }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 text-start font-medium">משתמש</th>
            <th className="px-4 py-3 text-start font-medium">אימייל</th>
            <th className="px-4 py-3 text-start font-medium">תפקיד</th>
            <th className="px-4 py-3 text-start font-medium">אדמין</th>
            <th className="px-4 py-3 text-start font-medium">הצטרף</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRowView
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRowView({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const displayName = user.display_name?.trim() || user.full_name?.trim() || "—";
  const created = user.created_at
    ? new Date(user.created_at).toLocaleDateString("he-IL")
    : "—";

  return (
    <tr
      className={cn(
        "border-t border-slate-100 transition",
        isSelf ? "bg-brand-50/30" : "hover:bg-slate-50",
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{displayName}</span>
              {isSelf && (
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-800">
                  זה אתה
                </span>
              )}
            </div>
            {user.full_name && user.display_name && user.full_name !== user.display_name && (
              <div className="text-xs text-slate-500">{user.full_name}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700" dir="ltr">
        <span className="block text-start">{user.email ?? "—"}</span>
      </td>
      <td className="px-4 py-3">
        <RoleEditor id={user.id} initial={user.role ?? ""} />
      </td>
      <td className="px-4 py-3">
        <AdminToggle id={user.id} value={user.is_admin} disabled={isSelf} />
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{created}</td>
      <td className="px-4 py-3 text-end">
        {!isSelf && (
          <DeleteButton id={user.id} displayName={displayName} />
        )}
      </td>
    </tr>
  );
}

function RoleEditor({ id, initial }: { id: string; initial: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [savedValue, setSavedValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = value.trim();
    setError(null);
    startTransition(async () => {
      const result = await updateUserRole(id, trimmed);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSavedValue(trimmed);
      setEditing(false);
    });
  }

  function cancel() {
    setValue(savedValue);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
      >
        <span className={savedValue ? "" : "text-slate-400"}>
          {savedValue || "ללא תפקיד"}
        </span>
        <Pencil className="h-3 w-3 text-slate-400 opacity-0 transition group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          maxLength={60}
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-brand-500 p-1.5 text-white hover:opacity-95 disabled:opacity-50"
          aria-label="שמור"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          aria-label="בטל"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function AdminToggle({
  id,
  value,
  disabled,
}: {
  id: string;
  value: boolean;
  disabled: boolean;
}) {
  const [enabled, setEnabled] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (disabled) return;
    const next = !enabled;
    setError(null);
    startTransition(async () => {
      const result = await toggleUserAdmin(id, next);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEnabled(next);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled || pending}
        onClick={toggle}
        title={disabled ? "אינך יכול להסיר את הרשאת האדמין מעצמך" : undefined}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          enabled ? "bg-brand-500" : "bg-slate-300",
          (disabled || pending) && "opacity-60",
          !disabled && !pending && "cursor-pointer",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-all",
            enabled ? "start-[22px]" : "start-0.5",
          )}
        />
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function DeleteButton({
  id,
  displayName,
}: {
  id: string;
  displayName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteUser(id);
      if ("error" in result) {
        setError(result.error);
        setConfirming(false);
        return;
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-600">למחוק את {displayName}?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "מוחק…" : "כן, מחק"}
          </button>
          <button
            type="button"
            onClick={() => { setConfirming(false); setError(null); }}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`מחק את ${displayName}`}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
