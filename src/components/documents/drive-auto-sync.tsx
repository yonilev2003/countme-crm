"use client";

// Background-only Drive sync trigger for the documents page. Posts to
// /api/documents/sync every `intervalMs` while the tab is visible. Renders
// nothing — it is purely a side-effect component.
//
// Pattern mirrors calendar-shell.tsx: a re-entrancy guard, a visibility
// listener that fires an immediate sync when the tab regains focus, and
// router.refresh() when the server reports new/changed/deleted rows so the
// page re-renders with fresh data.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  intervalMs?: number;
};

type SyncResponse = {
  pulled?: number;
  pushed?: number;
  deleted?: number;
  errors?: string[];
  error?: string;
};

export function DriveAutoSync({ intervalMs = 90_000 }: Props) {
  const router = useRouter();
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (busyRef.current) return;
      if (typeof document === "undefined") return;
      if (document.hidden) return;
      busyRef.current = true;
      try {
        const res = await fetch("/api/documents/sync", { method: "POST" });
        if (!res.ok) return;
        const json = (await res.json()) as SyncResponse;
        if (cancelled) return;
        const changed =
          (json.pulled ?? 0) + (json.pushed ?? 0) + (json.deleted ?? 0);
        if (changed > 0) router.refresh();
      } catch {
        // Auto-sync failures are silent — user-initiated buttons can surface them.
      } finally {
        busyRef.current = false;
      }
    }

    run();
    const id = window.setInterval(run, intervalMs);
    const onVisibility = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router]);

  return null;
}
