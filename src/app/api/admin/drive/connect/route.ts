// Initiates Google OAuth for the shared team Drive (countme5555@gmail.com).
// Same pattern as the team calendar connect: nonce in httpOnly cookie,
// admin gate, redirect to Google's consent screen.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TEAM_DRIVE_EMAIL = "countme5555@gmail.com";
const STATE_COOKIE = "team_drive_oauth_state";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  // Admin gate — only admins can initiate the shared-Drive OAuth.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      `${origin}/admin/drive?error=${encodeURIComponent(
        "missing_google_client_id",
      )}`,
    );
  }

  // CSRF nonce — set as cookie, send as `state`, verify on callback.
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 min — covers OAuth round-trip
  });

  const redirectUri = `${origin}/api/admin/drive/connect/callback`;

  // drive.file is the non-sensitive per-file scope. Combined with the
  // auto-created root folder, this lets us fully manage our own files
  // without triggering Google's verification banner.
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file email profile",
    access_type: "offline",
    prompt: "consent", // forces refresh_token on every connect
    include_granted_scopes: "true",
    login_hint: TEAM_DRIVE_EMAIL,
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
