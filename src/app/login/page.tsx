"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar",
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-slate-900">
            countme CRM
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            המערכת הפנימית של הצוות
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#fff"
              d="M21.35 11.1H12v3.18h5.39c-.24 1.31-1.5 3.85-5.39 3.85a6.13 6.13 0 1 1 0-12.26 5.62 5.62 0 0 1 3.95 1.53l2.7-2.6A9.4 9.4 0 0 0 12 2.3a9.7 9.7 0 1 0 0 19.4c5.6 0 9.3-3.93 9.3-9.46 0-.65-.07-1.15-.15-1.6Z"
            />
          </svg>
          <span>{loading ? "מתחבר..." : "התחבר עם Google"}</span>
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          רק חברי הצוות עם חשבון Google מאושר יוכלו להתחבר
        </p>
      </div>
    </main>
  );
}
