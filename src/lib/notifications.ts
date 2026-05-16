// Server-side helper that gathers everything the topbar notification bell
// shows: tasks recently assigned to me, mentions in chat, and unread chat
// counts. Each sub-query is best-effort — if one fails, we still return
// whatever else we managed to gather instead of throwing.

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationItem =
  | {
      type: "task_assigned";
      id: string;
      title: string;
      status: string;
      created_at: string;
      href: string;
    }
  | {
      type: "chat_unread";
      channel_id: string;
      channel_label: string;
      count: number;
      href: string;
    }
  | {
      type: "chat_mention";
      message_id: string;
      channel_id: string;
      channel_label: string;
      preview: string;
      sender_name: string;
      created_at: string;
      href: string;
    };

type ChannelRow = {
  id: string;
  name: string | null;
  type: "channel" | "dm" | "person_thread";
  person_id: string | null;
};

type MemberRow = {
  channel_id: string;
  last_read_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
};

type MessageRow = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Resolve a channel into a Hebrew label suitable for the notification panel.
 * Mirrors the logic in chat/_data.ts but kept local so we don't import a
 * chat-private module.
 */
function labelForChannel(
  channel: ChannelRow,
  peopleById: Map<string, string>,
  dmOtherProfile: ProfileRow | undefined,
): string {
  if (channel.type === "channel") {
    return channel.name ?? "(ללא שם)";
  }
  if (channel.type === "person_thread") {
    const personName = channel.person_id
      ? peopleById.get(channel.person_id)
      : undefined;
    return `שיחת CRM: ${personName ?? "—"}`;
  }
  // dm
  return (
    dmOtherProfile?.display_name ??
    dmOtherProfile?.full_name ??
    "חבר/ת צוות"
  );
}

export async function loadNotificationsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];

  // ------------------------------------------------------------------
  // 1) Tasks assigned to me in the last 14 days, not yet done.
  // ------------------------------------------------------------------
  try {
    const cutoff = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, created_at")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .gt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const t of (tasks ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      created_at: string;
    }>) {
      items.push({
        type: "task_assigned",
        id: t.id,
        title: t.title,
        status: t.status,
        created_at: t.created_at,
        href: "/tasks",
      });
    }
  } catch {
    // best-effort
  }

  // ------------------------------------------------------------------
  // 2) Load channels + memberships once so we can compute unread + labels
  //    for both #2 (unread) and #3 (mentions).
  // ------------------------------------------------------------------
  let myChannels: ChannelRow[] = [];
  const myLastReadByChannel = new Map<string, string | null>();
  const channelLabelById = new Map<string, string>();
  let displayName: string | null = null;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", userId)
      .maybeSingle();
    displayName =
      (profile?.display_name as string | null | undefined) ??
      (profile?.full_name as string | null | undefined) ??
      null;
  } catch {
    // skip mentions silently
  }

  try {
    // RLS already filters to channels the user can see, but only the
    // user's own memberships expose last_read_at — so we grab those first
    // and key everything off the membership list.
    const { data: myMembers } = await supabase
      .from("channel_members")
      .select("channel_id, last_read_at")
      .eq("profile_id", userId);
    for (const m of (myMembers ?? []) as MemberRow[]) {
      myLastReadByChannel.set(m.channel_id, m.last_read_at);
    }

    const channelIds = Array.from(myLastReadByChannel.keys());
    if (channelIds.length > 0) {
      const { data: channels } = await supabase
        .from("channels")
        .select("id, name, type, person_id")
        .in("id", channelIds);
      myChannels = (channels ?? []) as ChannelRow[];

      // Resolve person labels for person_thread channels.
      const personIds = myChannels
        .filter((c) => c.type === "person_thread" && c.person_id)
        .map((c) => c.person_id as string);
      const peopleById = new Map<string, string>();
      if (personIds.length > 0) {
        const { data: people } = await supabase
          .from("people")
          .select("id, name")
          .in("id", personIds);
        for (const p of (people ?? []) as Array<{ id: string; name: string }>) {
          peopleById.set(p.id, p.name);
        }
      }

      // Resolve "other person" labels for DM channels.
      const dmIds = myChannels.filter((c) => c.type === "dm").map((c) => c.id);
      const dmOtherProfileByChannel = new Map<string, ProfileRow>();
      if (dmIds.length > 0) {
        const { data: dmMembers } = await supabase
          .from("channel_members")
          .select("channel_id, profile_id")
          .in("channel_id", dmIds);
        const otherProfileByChannel = new Map<string, string>();
        const otherIds = new Set<string>();
        for (const m of (dmMembers ?? []) as Array<{
          channel_id: string;
          profile_id: string;
        }>) {
          if (m.profile_id !== userId) {
            otherProfileByChannel.set(m.channel_id, m.profile_id);
            otherIds.add(m.profile_id);
          }
        }
        if (otherIds.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, full_name")
            .in("id", Array.from(otherIds));
          const profilesById = new Map<string, ProfileRow>();
          for (const p of (profiles ?? []) as ProfileRow[]) {
            profilesById.set(p.id, p);
          }
          for (const [channelId, profileId] of otherProfileByChannel) {
            const profile = profilesById.get(profileId);
            if (profile) dmOtherProfileByChannel.set(channelId, profile);
          }
        }
      }

      for (const ch of myChannels) {
        const label = labelForChannel(
          ch,
          peopleById,
          dmOtherProfileByChannel.get(ch.id),
        );
        channelLabelById.set(ch.id, label);
      }
    }
  } catch {
    // best-effort — skip unread + mentions
  }

  // ------------------------------------------------------------------
  // 3) Unread per channel (only channels with count > 0). Limit 5.
  // ------------------------------------------------------------------
  try {
    const unreadResults = await Promise.all(
      myChannels.map(async (ch) => {
        const lastRead = myLastReadByChannel.get(ch.id);
        let q = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", ch.id)
          .neq("sender_id", userId);
        if (lastRead) q = q.gt("created_at", lastRead);
        try {
          const { count } = await q;
          return { channel: ch, count: count ?? 0 };
        } catch {
          return { channel: ch, count: 0 };
        }
      }),
    );

    const unread = unreadResults
      .filter((r) => r.count > 0)
      .slice(0, 5);

    for (const { channel, count } of unread) {
      items.push({
        type: "chat_unread",
        channel_id: channel.id,
        channel_label: channelLabelById.get(channel.id) ?? "(ערוץ)",
        count,
        href: `/chat/${channel.id}`,
      });
    }
  } catch {
    // best-effort
  }

  // ------------------------------------------------------------------
  // 4) Mentions in the last 14 days. Search messages bodies for
  //    `@${displayName}` within channels the user belongs to, excluding
  //    self-authored messages.
  // ------------------------------------------------------------------
  try {
    if (
      displayName &&
      displayName.trim().length > 0 &&
      myChannels.length > 0
    ) {
      const cutoff = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
      const channelIds = myChannels.map((c) => c.id);
      // `ilike` with `%@displayName%` keeps it forgiving about trailing
      // punctuation. We then post-filter to drop self-authored messages.
      const { data: mentions } = await supabase
        .from("messages")
        .select("id, channel_id, sender_id, body, created_at")
        .in("channel_id", channelIds)
        .neq("sender_id", userId)
        .ilike("body", `%@${displayName}%`)
        .gt("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(5);

      const mentionRows = (mentions ?? []) as MessageRow[];
      const senderIds = Array.from(
        new Set(mentionRows.map((m) => m.sender_id)),
      );
      const senderNameById = new Map<string, string>();
      if (senderIds.length > 0) {
        try {
          const { data: senders } = await supabase
            .from("profiles")
            .select("id, display_name, full_name")
            .in("id", senderIds);
          for (const p of (senders ?? []) as ProfileRow[]) {
            senderNameById.set(
              p.id,
              p.display_name ?? p.full_name ?? "חבר/ת צוות",
            );
          }
        } catch {
          // names are nice-to-have
        }
      }

      for (const m of mentionRows) {
        const preview =
          m.body.length > 120 ? `${m.body.slice(0, 117)}...` : m.body;
        items.push({
          type: "chat_mention",
          message_id: m.id,
          channel_id: m.channel_id,
          channel_label: channelLabelById.get(m.channel_id) ?? "(ערוץ)",
          preview,
          sender_name: senderNameById.get(m.sender_id) ?? "חבר/ת צוות",
          created_at: m.created_at,
          href: `/chat/${m.channel_id}`,
        });
      }
    }
  } catch {
    // best-effort
  }

  return items;
}
