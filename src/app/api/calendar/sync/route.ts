// POST /api/calendar/sync — bidirectional Google Calendar sync.
// Body: { kind: 'personal' | 'team' | 'both' }
// Returns aggregated { pulled, pushed, deleted, conflicts } counts.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncPersonal, syncTeam, type SyncResult } from "@/lib/google/sync";

type SyncKind = "personal" | "team" | "both";

function isSyncKind(v: unknown): v is SyncKind {
  return v === "personal" || v === "team" || v === "both";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let kind: SyncKind = "both";
  try {
    const body = await request.json().catch(() => ({}));
    if (isSyncKind(body?.kind)) kind = body.kind;
  } catch {
    // Default to both on parse error
  }

  const results: SyncResult[] = [];
  const errors: { kind: string; error: string }[] = [];

  if (kind === "personal" || kind === "both") {
    try {
      results.push(await syncPersonal(user.id, supabase));
    } catch (err) {
      errors.push({
        kind: "personal",
        error: err instanceof Error ? err.message : "unknown_error",
      });
    }
  }

  if (kind === "team" || kind === "both") {
    try {
      results.push(await syncTeam(user.id));
    } catch (err) {
      errors.push({
        kind: "team",
        error: err instanceof Error ? err.message : "unknown_error",
      });
    }
  }

  const totals = results.reduce(
    (acc, r) => ({
      pulled: acc.pulled + r.pulled,
      pushed: acc.pushed + r.pushed,
      deleted: acc.deleted + r.deleted,
      conflicts: acc.conflicts + r.conflicts,
    }),
    { pulled: 0, pushed: 0, deleted: 0, conflicts: 0 },
  );

  return NextResponse.json({ ...totals, results, errors });
}
