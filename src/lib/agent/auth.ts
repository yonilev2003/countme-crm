// Bearer-token auth for the /api/agent/* operations layer. This is the one
// front door external LLM tool connectors (Claude, ChatGPT, ...) get: a
// personal token resolves to exactly one profile, never to a raw DB
// connection. See docs/agent-api.md for the full contract.

import { randomBytes, createHash } from "crypto";
import { createClient as createSupaJsClient } from "@supabase/supabase-js";

const TOKEN_PREFIX = "cme_";

export function generateAgentToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashAgentToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function createServiceClient() {
  return createSupaJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type AgentCaller = {
  userId: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
};

/** Resolves the `Authorization: Bearer <token>` header to the calling profile, or null. */
export async function resolveAgentCaller(
  request: Request,
): Promise<AgentCaller | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;

  const raw = match[1];
  if (!raw.startsWith(TOKEN_PREFIX)) return null;

  const tokenHash = hashAgentToken(raw);
  const service = createServiceClient();

  const { data: token } = await service
    .from("agent_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!token || token.revoked_at) return null;

  const { data: profile } = await service
    .from("profiles")
    .select("id, email, display_name, full_name, is_admin")
    .eq("id", token.user_id)
    .maybeSingle();

  if (!profile) return null;

  // Best-effort — never blocks the request on failure.
  void service
    .from("agent_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", token.id)
    .then(() => {});

  return {
    userId: profile.id,
    email: profile.email,
    displayName: profile.display_name || profile.full_name,
    isAdmin: Boolean(profile.is_admin),
  };
}

export { createServiceClient as createAgentServiceClient };
