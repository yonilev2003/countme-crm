// Redirect-URI allowlist for OAuth dynamic client registration. This is the
// actual security boundary on self-service registration (RFC 7591 has no
// built-in one): a registered client can only ever redirect an
// authorization code to a host we've decided we trust.
//
// If Claude.ai or ChatGPT present a redirect host not covered here, the
// connector setup will fail with a clear "redirect_uri not allowed" error
// (safe failure) — extend this list rather than loosening the match.
const ALLOWED_EXACT_HOSTS = new Set([
  "claude.ai",
  "chatgpt.com",
  "chat.openai.com",
  "localhost",
  "127.0.0.1",
]);

const ALLOWED_SUFFIXES = [".anthropic.com", ".openai.com"];

export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // OAuth redirect URIs must not carry fragments or embedded credentials.
  if (url.hash || url.username || url.password) return false;

  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  // Native/local MCP clients use an HTTP loopback callback. Never allow an
  // arbitrary scheme merely because its hostname happens to be localhost.
  if (isLoopback) return url.protocol === "http:";

  // Every non-loopback callback must be HTTPS.
  if (url.protocol !== "https:") return false;

  if (ALLOWED_EXACT_HOSTS.has(url.hostname)) return true;
  return ALLOWED_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}
