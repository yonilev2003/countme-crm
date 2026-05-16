// POST /api/documents/sync — bidirectional Drive sync trigger.
// Body: (none) — there's a single Drive folder to reconcile.
// Returns: aggregated { pulled, pushed, deleted } plus any non-fatal errors.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncDocumentsWithDrive } from "@/lib/google/drive-sync";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const r = await syncDocumentsWithDrive();
    return NextResponse.json({
      pulled: r.pulled,
      pushed: r.pushed,
      deleted: r.deleted,
      errors: r.errors,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
