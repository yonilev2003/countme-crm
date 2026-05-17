"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePerson } from "../actions";

export function DeletePersonButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(`למחוק את "${name}"? לא ניתן לשחזר.`)) return;
    startTransition(async () => {
      const res = await deletePerson(id);
      if ("success" in res) {
        router.push("/people");
        router.refresh();
      } else {
        alert(res.error || "המחיקה נכשלה");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 active:scale-95 disabled:opacity-60"
      aria-label={`מחק את ${name}`}
    >
      {pending ? "מוחק..." : "מחק"}
    </button>
  );
}
