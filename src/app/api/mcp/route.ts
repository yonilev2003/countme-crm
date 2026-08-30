// POST /api/mcp — remote MCP endpoint (Streamable HTTP, stateless) for
// Claude.ai / ChatGPT "custom connector" and Claude Code/Desktop. Auth is
// the same personal bearer token used by /api/agent/* (minted via the
// OAuth flow at /oauth/authorize + /api/oauth/token, or copy-pasted from
// /settings/agent) — this endpoint adds no new trust model, only a
// standards-shaped transport on top of the same tokens.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveAgentCaller } from "@/lib/agent/auth";
import { registerCountMeTools } from "@/lib/mcp/register-tools";

export const dynamic = "force-dynamic";

function extractBearerToken(request: Request): string | null {
  const match = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  const caller = await resolveAgentCaller(request);
  const token = extractBearerToken(request);
  if (!caller || !token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    });
  }

  const server = new McpServer({ name: "countme-mcp-server", version: "1.0.0" });
  registerCountMeTools(server, { baseUrl: origin, token });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
