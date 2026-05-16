// Initiates Google OAuth for the shared team calendar (countme5555@gmail.com).
// Generates a state nonce, stores it in an httpOnly cookie, then redirects
// the admin to Google. The callback route validates state before swapping
// the code for tokens.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TEAM_CAL_EMAIL = "countme5555@gmail.com";
const STATE_COOKIE = "team_cal_oauth_state";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  // Admin gate — only admins can initiate the shared-calendar OAuth.
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
      `${origin}/admin/calendar?error=${encodeURIComponent(
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

  const redirectUri = `${origin}/api/admin/calendar/connect/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar email profile",
    access_type: "offline",
    prompt: "consent", // forces refresh_token on every connect
    include_granted_scopes: "true",
    login_hint: TEAM_CAL_EMAIL,
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
