import Anthropic from "@anthropic-ai/sdk";

// Anthropic client singleton. Used server-side only (never import in client components).
// Server actions and route handlers may import this.

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const SONNET_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}
