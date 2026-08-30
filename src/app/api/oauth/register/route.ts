// POST /api/oauth/register — RFC 7591 Dynamic Client Registration.
// Unauthenticated by design (this is how a client self-registers before
// any user has approved anything) — the redirect-URI host allowlist is
// the actual control here, not a login check.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createOAuthClient } from "@/lib/oauth/store";
import { isAllowedRedirectUri } from "@/lib/oauth/allowlist";

const registerSchema = z.object({
  redirect_uris: z.array(z.string().url()).min(1),
  client_name: z.string().max(100).optional(),
  token_endpoint_auth_method: z.enum(["client_secret_post", "none"]).default("client_secret_post"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const { redirect_uris, client_name, token_endpoint_auth_method } = parsed.data;

  const disallowed = redirect_uris.find((uri) => !isAllowedRedirectUri(uri));
  if (disallowed) {
    return NextResponse.json(
      {
        error: "invalid_redirect_uri",
        error_description: `Redirect URI not on the allowlist: ${disallowed}`,
      },
      { status: 400 },
    );
  }

  const { clientId, clientSecret } = await createOAuthClient({
    clientName: client_name ?? "AI connector",
    redirectUris: redirect_uris,
    public: token_endpoint_auth_method === "none",
  });

  return NextResponse.json(
    {
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      client_name: client_name ?? "AI connector",
      redirect_uris,
      token_endpoint_auth_method,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201 },
  );
}
