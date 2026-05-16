import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth", "/privacy", "/terms"];
const ONBOARDING_SAFE_PATHS = ["/login", "/auth", "/onboarding", "/privacy", "/terms"];

// Cookie that mirrors `profiles.onboarded_at IS NOT NULL`. Set by the
// onboarding server action; checked by middleware on every request to
// skip the DB roundtrip. If absent (older sessions), we fall back to DB
// once and set the cookie ourselves.
const ONBOARDED_COOKIE = "co_onb";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Per @supabase/ssr docs: getUser MUST run before any other logic
  // on the supabaseResponse to refresh the session cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic =
    pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const isOnboardingPath = ONBOARDING_SAFE_PATHS.some((p) =>
      pathname.startsWith(p),
    );

    // Fast path: cookie says we're onboarded → skip DB query entirely
    const cookieOnboarded = request.cookies.get(ONBOARDED_COOKIE)?.value === "1";

    let onboarded = cookieOnboarded;

    if (!cookieOnboarded) {
      // Fallback: query the DB once and set the cookie for future requests
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      onboarded = Boolean(profile?.onboarded_at);
      if (onboarded) {
        supabaseResponse.cookies.set(ONBOARDED_COOKIE, "1", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 365, // 1 year
        });
      }
    }

    if (!onboarded && !isOnboardingPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (onboarded && pathname.startsWith("/onboarding")) {
      const url = request.nextUrl.clone();
      url.pathname = "/tasks";
      return NextResponse.redirect(url);
    }
  } else {
    // No user: clear stale onboarding cookie
    if (request.cookies.has(ONBOARDED_COOKIE)) {
      supabaseResponse.cookies.delete(ONBOARDED_COOKIE);
    }
  }

  return supabaseResponse;
}

