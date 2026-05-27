"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupaJsClient } from "@supabase/supabase-js";

function createServiceClient() {
  return createSupaJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

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

export async function deleteUser(id: string): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { error: guard.error };

  if (id === guard.userId) {
    return { error: "לא ניתן למחוק את עצמך" };
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(id);

  if (error) {
    // FK restrict errors are verbose; surface a cleaner message.
    const msg = error.message ?? "";
    if (msg.includes("violates foreign key") || msg.includes("restrict")) {
      return {
        error:
          "לא ניתן למחוק: למשתמש יש פרויקטים, משימות או הודעות. העבר את הבעלות תחילה.",
      };
    }
    return { error: msg };
  }

  revalidatePath("/admin/users");
  return { success: true };
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
