// POST /api/oauth/register — RFC 7591 Dynamic Client Registration.
// Unauthenticated by design (this is how a client self-registers before
// any user has approved anything) — the redirect-URI host allowlist is
// the actual control here, not a login check.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createOAuthClient } from "@/lib/oauth/store";
import { isAllowedRedirectUri } from "@/lib/oauth/allowlist";

const registerSchema = z.object({
  redirect_uris: z.array(z.string().url().max(2048)).min(1).max(10),
  client_name: z.string().min(1).max(100).optional(),
  token_endpoint_auth_method: z.enum(["client_secret_post", "none"]).default("client_secret_post"),
  // MCP 2026 clients declare native/web during DCR. We don't use this as a
  // trust signal — redirect_uris are still independently allowlisted — but
  // echoing it keeps registration metadata standards-shaped.
  application_type: z.enum(["native", "web"]).optional(),
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

  const { redirect_uris, client_name, token_endpoint_auth_method, application_type } = parsed.data;

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
      ...(application_type ? { application_type } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201 },
  );
}
