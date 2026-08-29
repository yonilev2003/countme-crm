// GET /api/health — liveness probe + Supabase keep-alive.
// Hit daily by Vercel Cron (see vercel.json) so the free-tier Supabase
// project registers activity and is never auto-paused again. Executes a
// real query against Postgres; returns only status, never data.

import { NextResponse } from "next/server";
import { createClient as createSupaJsClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service role reaches the DB regardless of RLS; fall back to anon so the
  // probe still generates DB activity if the service key is ever rotated out.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, db: "unconfigured" },
      { status: 500 },
    );
  }

  const supabase = createSupaJsClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from("profiles")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, db: "down", error: error.message },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, db: "up" });
}
