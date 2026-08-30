"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAuthCode, getOAuthClient } from "@/lib/oauth/store";

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
  if (typeof state === "string" && state) target.searchParams.set("state", state);
  redirect(target.toString());
}
