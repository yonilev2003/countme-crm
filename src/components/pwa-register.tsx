"use client";

import { useEffect } from "react";

// Registers the service worker once, client-side only, so the app is
// installable as a PWA on phones and desktops. Skipped outside production
// to avoid fighting Next's dev-mode HMR with a stale cached worker.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
