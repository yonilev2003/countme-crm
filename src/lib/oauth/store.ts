import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { createAgentServiceClient } from "@/lib/agent/auth";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

export type OAuthClient = {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string;
  redirect_uris: string[];
};

function hashSecret(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateClientId(): string {
  return `mcp_${randomBytes(12).toString("hex")}`;
}

export function generateClientSecret(): string {
  return `mcps_${randomBytes(24).toString("base64url")}`;
}

export async function createOAuthClient(input: {
  clientName: string;
  redirectUris: string[];
  public: boolean;
}): Promise<{ clientId: string; clientSecret: string | null }> {
  const clientId = generateClientId();
  const clientSecret = input.public ? null : generateClientSecret();

  const service = createAgentServiceClient();
  const { error } = await service.from("oauth_clients").insert({
    client_id: clientId,
    client_secret_hash: clientSecret ? hashSecret(clientSecret) : null,
    client_name: input.clientName.slice(0, 100) || "AI connector",
    redirect_uris: input.redirectUris,
  });
  if (error) throw new Error(error.message);

  return { clientId, clientSecret };
}

export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  const service = createAgentServiceClient();
  const { data } = await service
    .from("oauth_clients")
    .select("client_id, client_secret_hash, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  return data ?? null;
}

export function verifyClientSecret(client: OAuthClient, provided: string | null): boolean {
  if (!client.client_secret_hash) return provided === null || provided === undefined;
  if (!provided) return false;
  const expected = Buffer.from(client.client_secret_hash, "utf8");
  const actual = Buffer.from(hashSecret(provided), "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createAuthCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<string> {
  const code = randomBytes(24).toString("base64url");
  const service = createAgentServiceClient();
  const { error } = await service.from("oauth_auth_codes").insert({
    code,
    user_id: input.userId,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export async function consumeAuthCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
}): Promise<{ userId: string; codeChallenge: string } | null> {
  const service = createAgentServiceClient();
  const { data } = await service
    .from("oauth_auth_codes")
    .select("user_id, client_id, redirect_uri, code_challenge, expires_at, used_at")
    .eq("code", input.code)
    .maybeSingle();

  if (!data) return null;
  if (data.used_at) return null;
  if (data.client_id !== input.clientId) return null;
  if (data.redirect_uri !== input.redirectUri) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  // Single-use: mark consumed immediately so a retried/leaked code can't
  // be replayed even within its TTL.
  await service
    .from("oauth_auth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", input.code);

  return { userId: data.user_id, codeChallenge: data.code_challenge };
}
