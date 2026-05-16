"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { personSchema, type PersonInput } from "@/lib/people";

type CreateResult = { success: true; id: string } | { error: string };
type MutateResult = { success: true; id: string } | { error: string };
type DeleteResult = { success: true } | { error: string };

export async function createPerson(input: PersonInput): Promise<CreateResult> {
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { data, error } = await supabase
    .from("people")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      company: parsed.data.company ?? null,
      role: parsed.data.role ?? null,
      status: parsed.data.status,
      tags: parsed.data.tags ?? [],
      notes: parsed.data.notes ?? null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!data) return { error: "שגיאה ביצירת איש הקשר" };

  revalidatePath("/people");
  revalidatePath(`/people/${data.id}`);
  return { success: true, id: data.id };
}

export async function updatePerson(
  id: string,
  input: PersonInput,
): Promise<MutateResult> {
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("people")
    .update({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      company: parsed.data.company ?? null,
      role: parsed.data.role ?? null,
      status: parsed.data.status,
      tags: parsed.data.tags ?? [],
      notes: parsed.data.notes ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
  return { success: true, id };
}

export async function deletePerson(id: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/people");
  return { success: true };
}
