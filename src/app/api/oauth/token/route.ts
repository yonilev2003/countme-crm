// POST /api/oauth/token — OAuth 2.1 authorization_code + PKCE exchange.
// The "access_token" handed back is just a normal CountMe personal agent
// token (see src/lib/agent/auth.ts) — same table, same permission checks
// as one created by hand in /settings/agent. No new trust model, just a
// standards-shaped way to obtain one.

import { NextResponse } from "next/server";
import {
  getOAuthClient,
  verifyClientSecret,
  consumeAuthCode,
} from "@/lib/oauth/store";
import { verifyPkce } from "@/lib/oauth/pkce";
import {
  createAgentServiceClient,
  generateAgentToken,
  hashAgentToken,
} from "@/lib/agent/auth";

function errorResponse(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse("invalid_request", "Expected form-urlencoded body");

  const grantType = form.get("grant_type");
  if (grantType !== "authorization_code") {
    return errorResponse("unsupported_grant_type", "Only authorization_code is supported");
  }

  const code = form.get("code");
  const redirectUri = form.get("redirect_uri");
  const clientId = form.get("client_id");
  const clientSecret = form.get("client_secret");
  const codeVerifier = form.get("code_verifier");

  if (
    typeof code !== "string" ||
    typeof redirectUri !== "string" ||
    typeof clientId !== "string" ||
    typeof codeVerifier !== "string"
  ) {
    return errorResponse("invalid_request", "Missing code, redirect_uri, client_id, or code_verifier");
  }

  const client = await getOAuthClient(clientId);
  if (!client) return errorResponse("invalid_client", "Unknown client_id", 401);
  if (!verifyClientSecret(client, typeof clientSecret === "string" ? clientSecret : null)) {
    return errorResponse("invalid_client", "Client authentication failed", 401);
  }

  const consumed = await consumeAuthCode({ code, clientId, redirectUri });
  if (!consumed) {
    return errorResponse("invalid_grant", "Authorization code is invalid, expired, or already used");
  }

  if (!verifyPkce(codeVerifier, consumed.codeChallenge)) {
    return errorResponse("invalid_grant", "PKCE verification failed");
  }

  const rawToken = generateAgentToken();
  const service = createAgentServiceClient();
  const { error } = await service.from("agent_tokens").insert({
    user_id: consumed.userId,
    name: client.client_name,
    token_hash: hashAgentToken(rawToken),
  });
  if (error) {
    return NextResponse.json({ error: "server_error", error_description: error.message }, { status: 500 });
  }

  return NextResponse.json({
    access_token: rawToken,
    token_type: "Bearer",
  });
}
