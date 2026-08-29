"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createAgentServiceClient,
  generateAgentToken,
  hashAgentToken,
} from "@/lib/agent/auth";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Creates a new personal agent token. The raw value is returned once and never stored. */
export async function createAgentToken(
  name: string,
): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const trimmedName = name.trim().slice(0, 60) || "ברירת מחדל";
  const raw = generateAgentToken();
  const service = createAgentServiceClient();

  const { error } = await service.from("agent_tokens").insert({
    user_id: user.id,
    name: trimmedName,
    token_hash: hashAgentToken(raw),
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/agent");
  return { success: true, data: { token: raw } };
}

export async function revokeAgentToken(id: string): Promise<Result<null>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const supabase = await createClient();
  // RLS (agent_tokens_update_own) already scopes this to the caller's own rows.
  const { error } = await supabase
    .from("agent_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/agent");
  return { success: true, data: null };
}
