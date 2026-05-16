"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type TopbarProps = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
  isAdmin: boolean;
};

export function Topbar({
  displayName,
  email,
  avatarUrl,
  role,
  isAdmin,
}: TopbarProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (displayName ?? email ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const hasChips = Boolean(role) || isAdmin;

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="text-sm text-slate-500">
        ברוך הבא{displayName ? `, ${displayName.split(" ")[0]}` : ""}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-end">
          <div className="text-sm font-medium text-slate-900">
            {displayName ?? "—"}
          </div>
          {hasChips && (
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              {role && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {role}
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
                  אדמין
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-slate-500">{email}</div>
        </div>

        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName ?? "avatar"}
            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials}
          </div>
        )}

        <button
          onClick={signOut}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="התנתק"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
