"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type TopbarProps = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function Topbar({ name, email, avatarUrl }: TopbarProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (name ?? email ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="text-sm text-slate-500">
        ברוך הבא{name ? `, ${name.split(" ")[0]}` : ""}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-end">
          <div className="text-sm font-medium text-slate-900">{name ?? "—"}</div>
          <div className="text-xs text-slate-500">{email}</div>
        </div>

        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name ?? "avatar"}
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
