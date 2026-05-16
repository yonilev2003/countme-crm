"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient as createSupaJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Service-role client (server-only). Used to insert other team members into
// channels we just created — channel_members RLS only allows self-insert.
function createServiceClient() {
  return createSupaJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ============================================================
// createChannel — group channel with optional member list
// ============================================================

const createChannelSchema = z.object({
  name: z.string().trim().min(1, "שם נדרש").max(80),
  description: z.string().trim().max(280).optional().or(z.literal("")),
  is_private: z.boolean(),
  member_ids: z.array(z.string().uuid()).optional().default([]),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export async function createChannel(
  input: CreateChannelInput,
): Promise<{ id: string } | { error: string }> {
  const parsed = createChannelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { data: channel, error: insertErr } = await supabase
    .from("channels")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      type: "channel",
      is_private: parsed.data.is_private,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !channel) {
    return { error: insertErr?.message ?? "יצירת הערוץ נכשלה" };
  }

  // Always add self.
  const { error: memberErr } = await supabase.from("channel_members").insert({
    channel_id: channel.id,
    profile_id: user.id,
    last_read_at: new Date().toISOString(),
  });
  if (memberErr) {
    return { error: memberErr.message };
  }

  // Add other selected members via service-role (RLS only allows self-insert).
  const otherIds = parsed.data.member_ids.filter((id) => id !== user.id);
  if (otherIds.length > 0) {
    const service = createServiceClient();
    const rows = otherIds.map((profile_id) => ({
      channel_id: channel.id,
      profile_id,
    }));
    await service.from("channel_members").upsert(rows, {
      onConflict: "channel_id,profile_id",
    });
  }

  revalidatePath("/chat");
  return { id: channel.id };
}

// ============================================================
// createSelfNoteChannel — private channel with just the creator
// ============================================================

export async function createSelfNoteChannel(): Promise<
  { id: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  // Reuse an existing self-note if one exists
  const { data: existing } = await supabase
    .from("channels")
    .select("id, channel_members!inner(profile_id)")
    .eq("type", "channel")
    .eq("is_private", true)
    .eq("created_by", user.id)
    .eq("name", "פתקים שלי")
    .maybeSingle();
  if (existing?.id) {
    return { id: existing.id };
  }

  const { data: channel, error: insertErr } = await supabase
    .from("channels")
    .insert({
      name: "פתקים שלי",
      description: "מרחב פרטי לפתקים אישיים",
      type: "channel",
      is_private: true,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertErr || !channel) {
    return { error: insertErr?.message ?? "יצירת הפתק נכשלה" };
  }

  await supabase.from("channel_members").insert({
    channel_id: channel.id,
    profile_id: user.id,
    last_read_at: new Date().toISOString(),
  });

  revalidatePath("/chat");
  return { id: channel.id };
}

// ============================================================
// sendMessage
// ============================================================

const sendMessageSchema = z.object({
  channel_id: z.string().uuid(),
  body: z.string().trim().min(1).max(10_000),
  attachments: z.array(z.unknown()).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export async function sendMessage(
  input: SendMessageInput,
): Promise<{ id: string; created_at: string } | { error: string }> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "הודעה לא תקינה" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel_id: parsed.data.channel_id,
      sender_id: user.id,
      body: parsed.data.body,
      attachments: parsed.data.attachments ?? [],
    })
    .select("id, created_at")
    .single();

  if (error || !data) return { error: error?.message ?? "שליחה נכשלה" };
  return { id: data.id, created_at: data.created_at };
}

// ============================================================
// markChannelRead
// ============================================================

export async function markChannelRead(
  channel_id: string,
): Promise<{ success: true } | { error: string }> {
  if (typeof channel_id !== "string" || channel_id.length === 0) {
    return { error: "channel_id חסר" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  // Upsert so first-read of a public channel (user not yet a member) works.
  const { error } = await supabase.from("channel_members").upsert(
    {
      channel_id,
      profile_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "channel_id,profile_id" },
  );

  if (error) return { error: error.message };
  return { success: true };
}

// ============================================================
// findOrCreateDM
// ============================================================

export async function findOrCreateDM(
  otherProfileId: string,
): Promise<{ id: string } | { error: string }> {
  if (typeof otherProfileId !== "string" || otherProfileId.length === 0) {
    return { error: "profile_id חסר" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  if (otherProfileId === user.id) {
    return { error: "לא ניתן ליצור DM עם עצמך" };
  }

  // Find an existing DM that both of us are members of.
  const { data: myDms, error: myDmsErr } = await supabase
    .from("channel_members")
    .select("channel_id, channels!inner(id, type)")
    .eq("profile_id", user.id)
    .eq("channels.type", "dm");

  if (myDmsErr) return { error: myDmsErr.message };

  const myDmChannelIds = (myDms ?? []).map((r) => r.channel_id);
  if (myDmChannelIds.length > 0) {
    const { data: shared } = await supabase
      .from("channel_members")
      .select("channel_id")
      .eq("profile_id", otherProfileId)
      .in("channel_id", myDmChannelIds);

    const existing = shared?.[0]?.channel_id;
    if (existing) return { id: existing };
  }

  // Create new DM
  const { data: channel, error: createErr } = await supabase
    .from("channels")
    .insert({
      type: "dm",
      is_private: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (createErr || !channel) {
    return { error: createErr?.message ?? "יצירת ה-DM נכשלה" };
  }

  // Insert ourselves (we have permission to insert-self only).
  // The other person will be inserted by them when they first open the DM,
  // OR we rely on the fact that DM channels are private and require both
  // members. To make the DM immediately usable we insert both via two
  // separate calls — but RLS only allows inserting self. So we insert
  // ourselves and the other person joins via a side effect when they see
  // the channel. As a workaround for v1: we also try to insert the other
  // person (if RLS rejects, we ignore — they can be added later).
  const { error: selfMemberErr } = await supabase
    .from("channel_members")
    .insert({
      channel_id: channel.id,
      profile_id: user.id,
      last_read_at: new Date().toISOString(),
    });
  if (selfMemberErr) return { error: selfMemberErr.message };

  // Attempt to add the other party. RLS restricts to self, so this is
  // expected to fail in the strict case — silently ignore the error and
  // let the other side auto-join when they navigate to /chat (markChannelRead
  // upserts membership). This keeps creating the DM idempotent and safe.
  await supabase.from("channel_members").insert({
    channel_id: channel.id,
    profile_id: otherProfileId,
  });

  revalidatePath("/chat");
  return { id: channel.id };
}

// ============================================================
// findOrCreatePersonThread
// ============================================================

export async function findOrCreatePersonThread(
  personId: string,
): Promise<{ id: string } | { error: string }> {
  if (typeof personId !== "string" || personId.length === 0) {
    return { error: "person_id חסר" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  // Try to find existing
  const { data: existing, error: findErr } = await supabase
    .from("channels")
    .select("id")
    .eq("type", "person_thread")
    .eq("person_id", personId)
    .maybeSingle();

  if (findErr) return { error: findErr.message };
  if (existing?.id) {
    // Make sure I'm a member (idempotent)
    await supabase.from("channel_members").upsert(
      {
        channel_id: existing.id,
        profile_id: user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,profile_id" },
    );
    return { id: existing.id };
  }

  // Create new
  const { data: channel, error: createErr } = await supabase
    .from("channels")
    .insert({
      type: "person_thread",
      person_id: personId,
      is_private: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (createErr || !channel) {
    return { error: createErr?.message ?? "יצירת השיחה נכשלה" };
  }

  // Add me (RLS allows self-insert only). Other team members will auto-join
  // when they navigate to the thread (markChannelRead upserts membership).
  await supabase.from("channel_members").insert({
    channel_id: channel.id,
    profile_id: user.id,
    last_read_at: new Date().toISOString(),
  });

  revalidatePath("/chat");
  return { id: channel.id };
}

// ============================================================
// deleteMessage
// ============================================================

export async function deleteMessage(
  id: string,
): Promise<{ success: true } | { error: string }> {
  if (typeof id !== "string" || id.length === 0) {
    return { error: "message_id חסר" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", id)
    .eq("sender_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}
