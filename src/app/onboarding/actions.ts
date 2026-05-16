"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  display_name: z.string().min(2).max(80),
  role: z.string().min(2).max(40),
});

export async function completeOnboarding(input: {
  display_name: string;
  role: string;
}): Promise<{ success: true } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: "פרטים לא תקינים" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "לא מחובר" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      role: parsed.data.role,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
