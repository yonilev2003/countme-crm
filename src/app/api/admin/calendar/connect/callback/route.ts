// OAuth callback for the shared team calendar connect flow. Exchanges the
// `code` for refresh/access tokens, fetches the calendar email, and persists
// everything into team_config (singleton row id=1).
//
// We use the service-role client for the write so that the policy
// `team_config_update_admin` (which gates UPDATE to admins) is bypassed
// safely on a server-side admin-verified flow. The admin gate is enforced
// above the service-role write.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getUserInfoEmail } from "@/lib/google/calendar";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "team_cal_oauth_state";
const TOKEN_CACHE_TTL_SECONDS = 55 * 60;

function failRedirect(origin: string, reason: string) {
  return NextResponse.redirect(
    `${origin}/admin/calendar?error=${encodeURIComponent(reason)}`,
  );
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);

  // Authenticate the admin first — protects callback against replay by non-admins.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return failRedirect(origin, "not_admin");

  // Validate state nonce
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const returnedState = searchParams.get("state");
  // Clear the cookie regardless — single use.
  cookieStore.delete(STATE_COOKIE);
  if (!expectedState || expectedState !== returnedState) {
    return failRedirect(origin, "invalid_state");
  }

  const error = searchParams.get("error");
  if (error) return failRedirect(origin, error);

  const code = searchParams.get("code");
  if (!code) return failRedirect(origin, "missing_code");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!clientId || !clientSecret) return failRedirect(origin, "missing_google_credentials");
  if (!serviceRoleKey || !supabaseUrl) return failRedirect(origin, "missing_supabase_service_role");

  // Exchange authorization code for tokens
  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/admin/calendar/connect/callback`,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Team calendar token exchange failed:", tokenRes.status, text);
    return failRedirect(origin, "token_exchange_failed");
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };

  if (!tokens.refresh_token) {
    // No refresh token usually means the user previously granted access
    // without revoking. `prompt=consent` should prevent this — bail loudly.
    return failRedirect(origin, "no_refresh_token");
  }

  const email = await getUserInfoEmail(tokens.access_token);
  const expiresAt = new Date(
    Date.now() + TOKEN_CACHE_TTL_SECONDS * 1000,
  ).toISOString();

  // Service-role write to team_config (singleton id=1)
  const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: upErr } = await admin
    .from("team_config")
    .update({
      shared_calendar_email: email,
      shared_calendar_refresh_token: tokens.refresh_token,
      shared_calendar_access_token: tokens.access_token,
      shared_calendar_token_expires_at: expiresAt,
      shared_calendar_sync_token: null, // reset sync state on reconnect
    })
    .eq("id", 1);

  if (upErr) {
    console.error("Failed to persist team calendar tokens:", upErr);
    return failRedirect(origin, "persist_failed");
  }

  return NextResponse.redirect(`${origin}/admin/calendar?connected=1`);
}
