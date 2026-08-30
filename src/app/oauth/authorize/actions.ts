"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAuthCode, getOAuthClient } from "@/lib/oauth/store";

async function getIssuer(): Promise<string> {
  // Derive the issuer from trusted server request headers, never from a
  // hidden form field or redirect URI supplied by the OAuth client.
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || h.get("host")?.trim();
  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host?.startsWith("localhost") ? "http" : "https");

  if (!host) return "https://countme-crm.vercel.app";
  return `${proto}://${host}`;
}

export async function approveAuthorization(formData: FormData): Promise<void> {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const state = formData.get("state");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Re-validate server-side — never trust the hidden form fields alone.
  // The consent page only ever renders a redirect_uri it already checked
  // against this client's registered list, but a forged direct POST to
  // this action must not be able to redirect an auth code anywhere else.
  const client = await getOAuthClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    redirect("/oauth/authorize?error=invalid_client_or_redirect");
  }

  const code = await createAuthCode({
    userId: user.id,
    clientId,
    redirectUri,
    codeChallenge,
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  target.searchParams.set("iss", await getIssuer());
  if (typeof state === "string" && state) target.searchParams.set("state", state);
  redirect(target.toString());
}

export async function denyAuthorization(formData: FormData): Promise<void> {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = formData.get("state");

  const client = await getOAuthClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    redirect("/oauth/authorize?error=invalid_client_or_redirect");
  }

  const target = new URL(redirectUri);
  target.searchParams.set("error", "access_denied");
  target.searchParams.set("iss", await getIssuer());
  if (typeof state === "string" && state) target.searchParams.set("state", state);
  redirect(target.toString());
}
