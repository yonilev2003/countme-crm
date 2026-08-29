// Thin, shared HTTP client for the CountMe agent API. Every tool goes
// through this — one place to hold the base URL, the bearer token, and
// error formatting.

export const API_BASE_URL =
  process.env.COUNTME_API_URL?.replace(/\/$/, "") ??
  "https://countme-crm.vercel.app";

export const CHARACTER_LIMIT = 25000;

export class CountMeApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "CountMeApiError";
  }
}

function getToken(): string {
  const token = process.env.COUNTME_API_TOKEN;
  if (!token) {
    throw new Error(
      "COUNTME_API_TOKEN is not set. Create a personal token in CountMe under Settings → מפתח AI, then set it as an environment variable for this MCP server.",
    );
  }
  return token;
}

export async function countmeRequest<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as
    | (T & { error?: string; message?: string })
    | null;

  if (!res.ok) {
    const message = json?.message ?? `HTTP ${res.status}`;
    throw new CountMeApiError(res.status, message);
  }

  return json as T;
}

/** Formats any thrown error into a short, actionable message for the model. */
export function describeError(error: unknown): string {
  if (error instanceof CountMeApiError) {
    switch (error.status) {
      case 401:
        return "Error: the CountMe token is missing or invalid. Ask the user to check COUNTME_API_TOKEN.";
      case 403:
        return `Error: permission denied — ${error.message}`;
      case 404:
        return `Error: not found — ${error.message}`;
      case 400:
        return `Error: invalid input — ${error.message}`;
      default:
        return `Error: CountMe API request failed (${error.status}) — ${error.message}`;
    }
  }
  return `Error: unexpected failure — ${error instanceof Error ? error.message : String(error)}`;
}

export function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= CHARACTER_LIMIT) return { text, truncated: false };
  return { text: text.slice(0, CHARACTER_LIMIT), truncated: true };
}
