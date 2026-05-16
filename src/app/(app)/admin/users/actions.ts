"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { success: true } | { error: string };

const roleSchema = z
  .string()
  .max(60, "תפקיד עד 60 תווים")
  .transform((v) => v.trim());

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "לא מחובר" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return { ok: false, error: "אין הרשאת אדמין" };
  }
  return { ok: true, userId: user.id };
}

export async function updateUserRole(
  id: string,
  role: string,
): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "תפקיד לא תקין" };
  }
  const trimmed = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: trimmed.length === 0 ? null : trimmed })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserAdmin(
  id: string,
  value: boolean,
): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  // Defensive: never let an admin demote themselves via this action.
  if (id === guard.userId) {
    return { error: "לא ניתן להסיר הרשאת אדמין מעצמך" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: value })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}
