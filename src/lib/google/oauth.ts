// Google OAuth helpers: refresh access tokens for both personal users and the
// shared team calendar. Google access tokens last ~1h; we refresh proactively
// when the cached value has < 5 minutes left.
//
// We cache `expires_at` conservatively at 55 minutes from issuance — this gives
// a safety buffer well before Google's hard 60-minute expiry.

import type { SupabaseClient } from "@supabase/supabase-js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const TOKEN_CACHE_TTL_SECONDS = 55 * 60; // 55 min
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 min remaining → refresh

export type RefreshTokenResponse = {
  access_token: string;
  expires_in: number;
};

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Google token refresh failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return {
    access_token: json.access_token,
    expires_in: json.expires_in ?? TOKEN_CACHE_TTL_SECONDS,
  };
}

function isStillValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs - Date.now() > REFRESH_THRESHOLD_MS;
}

function newExpiresAt(): string {
  return new Date(Date.now() + TOKEN_CACHE_TTL_SECONDS * 1000).toISOString();
}

/**
 * Returns a valid Google access token for the given user. Refreshes via the
 * stored refresh_token when expired (or nearing expiry, or when `force=true`).
 * Throws if the user has never granted offline access (no refresh_token).
 */
export async function getValidAccessTokenForUser(
  supabase: SupabaseClient,
  userId: string,
  force = false,
): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "google_refresh_token, google_access_token, google_token_expires_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  if (!profile?.google_refresh_token) {
    throw new Error(
      "No Google refresh token on profile; user must re-authenticate with calendar scope",
    );
  }

  if (
    !force &&
    profile.google_access_token &&
    isStillValid(profile.google_token_expires_at)
  ) {
    return profile.google_access_token;
  }

  const refreshed = await refreshAccessToken(profile.google_refresh_token);
  const expiresAt = newExpiresAt();

  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      google_access_token: refreshed.access_token,
      google_token_expires_at: expiresAt,
    })
    .eq("id", userId);

  if (upErr) {
    // Non-fatal: we still got a valid access token, just couldn't cache it.
    console.warn("Failed to cache refreshed access token:", upErr.message);
  }

  return refreshed.access_token;
}

/**
 * Returns a valid Google access token for the shared team calendar account
 * (countme5555@gmail.com). Refresh token lives in team_config (singleton, id=1).
 * Throws if team calendar was never connected by an admin.
 */
export async function getValidAccessTokenForTeam(
  supabase: SupabaseClient,
  force = false,
): Promise<string> {
  const { data: cfg, error } = await supabase
    .from("team_config")
    .select(
      "shared_calendar_refresh_token, shared_calendar_access_token, shared_calendar_token_expires_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load team_config: ${error.message}`);
  if (!cfg?.shared_calendar_refresh_token) {
    throw new Error(
      "Team calendar not connected; admin must connect via /admin/calendar",
    );
  }

  if (
    !force &&
    cfg.shared_calendar_access_token &&
    isStillValid(cfg.shared_calendar_token_expires_at)
  ) {
    return cfg.shared_calendar_access_token;
  }

  const refreshed = await refreshAccessToken(cfg.shared_calendar_refresh_token);
  const expiresAt = newExpiresAt();

  const { error: upErr } = await supabase
    .from("team_config")
    .update({
      shared_calendar_access_token: refreshed.access_token,
      shared_calendar_token_expires_at: expiresAt,
    })
    .eq("id", 1);

  if (upErr) {
    console.warn(
      "Failed to cache refreshed team access token:",
      upErr.message,
    );
  }

  return refreshed.access_token;
}
