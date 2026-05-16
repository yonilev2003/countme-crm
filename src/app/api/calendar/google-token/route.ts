// Returns a valid Google access token for the currently authenticated user.
// Used by client-side helpers that need to call the Calendar API directly
// (the access_token is short-lived; this endpoint always returns a fresh one).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessTokenForUser } from "@/lib/google/oauth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const access_token = await getValidAccessTokenForUser(supabase, user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("google_token_expires_at")
      .eq("id", user.id)
      .maybeSingle();
    return NextResponse.json({
      access_token,
      expires_at: profile?.google_token_expires_at ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
