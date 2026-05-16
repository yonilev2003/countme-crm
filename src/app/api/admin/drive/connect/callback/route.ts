// OAuth callback for the shared team Drive connect flow. Exchanges the
// `code` for refresh/access tokens, persists them on `team_config`, then —
// if no folder has been configured yet — creates the designated root folder
// inside the user's My Drive and stores its id.
//
// Folder auto-creation is idempotent: if `shared_drive_folder_id` is already
// set we never create another one. This lets an admin reconnect (e.g.,
// rotate tokens) without spawning duplicate folders.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createFolder, getUserInfoEmail } from "@/lib/google/drive";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "team_drive_oauth_state";
const TOKEN_CACHE_TTL_SECONDS = 55 * 60;
const DEFAULT_FOLDER_NAME = "הנהלת CountMe — מסמכים";

function failRedirect(origin: string, reason: string) {
  return NextResponse.redirect(
    `${origin}/admin/drive?error=${encodeURIComponent(reason)}`,
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
    redirect_uri: `${origin}/api/admin/drive/connect/callback`,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Team Drive token exchange failed:", tokenRes.status, text);
    return failRedirect(origin, "token_exchange_failed");
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };

  if (!tokens.refresh_token) {
    // No refresh token typically means the user previously granted access
    // without revoking. `prompt=consent` should prevent this — bail loudly.
    return failRedirect(origin, "no_refresh_token");
  }

  const expiresAt = new Date(
    Date.now() + TOKEN_CACHE_TTL_SECONDS * 1000,
  ).toISOString();

  // Service-role write to team_config (singleton id=1)
  const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check whether a folder is already configured before we go create another.
  const { data: existingCfg, error: cfgErr } = await admin
    .from("team_config")
    .select("shared_drive_folder_id, shared_drive_folder_name")
    .eq("id", 1)
    .maybeSingle();
  if (cfgErr) {
    console.error("Failed to read team_config before folder create:", cfgErr);
    return failRedirect(origin, "persist_failed");
  }

  let folderId = existingCfg?.shared_drive_folder_id ?? null;
  const folderName =
    existingCfg?.shared_drive_folder_name ?? DEFAULT_FOLDER_NAME;

  if (!folderId) {
    try {
      const folder = await createFolder(tokens.access_token, folderName);
      folderId = folder.id;
    } catch (err) {
      console.error("Failed to create Drive root folder:", err);
      return failRedirect(origin, "folder_create_failed");
    }
  }

  // Log the connected email for visibility (non-fatal if it fails).
  const email = await getUserInfoEmail(tokens.access_token);
  if (email) {
    console.info("Team Drive connected to", email);
  }

  const { error: upErr } = await admin
    .from("team_config")
    .update({
      shared_drive_refresh_token: tokens.refresh_token,
      shared_drive_access_token: tokens.access_token,
      shared_drive_token_expires_at: expiresAt,
      shared_drive_folder_id: folderId,
      shared_drive_folder_name: folderName,
    })
    .eq("id", 1);

  if (upErr) {
    console.error("Failed to persist team Drive tokens:", upErr);
    return failRedirect(origin, "persist_failed");
  }

  return NextResponse.redirect(`${origin}/admin/drive?connected=1`);
}
