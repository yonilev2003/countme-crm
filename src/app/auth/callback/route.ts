import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google's access tokens last ~1 hour. We track expiration conservatively
// at 55 minutes to refresh proactively.
const GOOGLE_TOKEN_TTL_SECONDS = 55 * 60;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const next = searchParams.get("next") ?? "/tasks";

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session?.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "exchange_failed")}`,
    );
  }

  const { session } = data;
  const { provider_refresh_token, provider_token, user } = session;

  // Critical: provider_refresh_token is returned ONLY on first consent.
  // Persist it immediately or lose calendar sync capability forever.
  if (provider_refresh_token) {
    const expiresAt = new Date(
      Date.now() + GOOGLE_TOKEN_TTL_SECONDS * 1000,
    ).toISOString();

    const meta = user.user_metadata ?? {};
    const profilePatch = {
      email: user.email ?? null,
      full_name: meta.full_name ?? meta.name ?? null,
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
      google_refresh_token: provider_refresh_token,
      google_access_token: provider_token ?? null,
      google_token_expires_at: expiresAt,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profilePatch)
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to persist refresh token:", profileError);
      return NextResponse.redirect(
        `${origin}/login?error=profile_update_failed`,
      );
    }
  } else if (provider_token) {
    // Access token without refresh — first consent already happened.
    // Update what we can; calendar features will need re-consent if expired.
    const expiresAt = new Date(
      Date.now() + GOOGLE_TOKEN_TTL_SECONDS * 1000,
    ).toISOString();

    await supabase
      .from("profiles")
      .update({
        google_access_token: provider_token,
        google_token_expires_at: expiresAt,
      })
      .eq("id", user.id);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
