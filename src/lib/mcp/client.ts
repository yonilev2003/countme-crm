// Shared HTTP helper for the remote MCP endpoint's tool handlers. Mirrors
// mcp-server/src/client.ts (the local stdio server) but takes the token and
// base URL explicitly per-request instead of reading them from env vars,
// since this runs in-process inside the shared Next.js server, not a
// single-user local process.

export class McpApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "McpApiError";
  }
}

export async function agentApiRequest<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as
    | (T & { message?: string })
    | null;

  if (!res.ok) {
    throw new McpApiError(res.status, json?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export function describeMcpError(error: unknown): string {
  if (error instanceof McpApiError) {
    return `Error (${error.status}): ${error.message}`;
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
